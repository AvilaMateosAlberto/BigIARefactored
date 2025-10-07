// appReact/src/backend/routes/menu.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorizePermission } = require('../middleware/auth');

// Helpers
function normalizeRoute(route) {
  if (!route) return null;
  let r = route.trim();
  if (!r.startsWith('/')) r = '/' + r;
  r = r.replace(/\/{2,}/g, '/');
  return r;
}
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-_/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
async function getFolderLabel(pid) {
  if (pid == null) return '(Top level)';
  const r = await pool.query('SELECT label FROM menu_items WHERE id = $1', [pid]);
  return r.rowCount ? r.rows[0].label : `(id:${pid})`;
}

// ======== Helpers avanzados para subcarpetas ========
async function getFolderSlugChain(pid) {
  if (pid == null) return null;
  const slugs = [];
  let current = pid;
  while (current != null) {
    const r = await pool.query(
      'SELECT id, parent_id, label, type FROM menu_items WHERE id = $1',
      [current]
    );
    if (!r.rowCount || r.rows[0].type !== 'folder') return null;
    slugs.push(slugify(r.rows[0].label));
    current = r.rows[0].parent_id ?? null;
  }
  return slugs.reverse().join('/');
}
async function buildEffectiveRoute(parent_id, rawBase) {
  if (!rawBase) return null;
  const baseLastSeg = String(rawBase).replace(/^\//, '').split('/').filter(Boolean).pop();
  const pageSlug = slugify(baseLastSeg || '');
  if (!pageSlug) return null;
  if (parent_id == null) return normalizeRoute('/' + pageSlug);
  const chain = await getFolderSlugChain(parent_id);
  if (!chain) return null;
  return normalizeRoute(`/${chain}/${pageSlug}`);
}
async function wouldCreateCycle(candidateParentId, id) {
  // true si candidateParentId es el propio id o un descendiente suyo
  if (candidateParentId == null) return false;
  let current = candidateParentId;
  while (current != null) {
    if (current === Number(id)) return true;
    const r = await pool.query('SELECT parent_id FROM menu_items WHERE id = $1', [current]);
    if (!r.rowCount) break;
    current = r.rows[0].parent_id ?? null;
  }
  return false;
}
async function rebuildDescendantLinkRoutes(folderId) {
  // Recalcula la ruta de TODOS los links que cuelgan de esta carpeta (en cualquier profundidad).
  const res = await pool.query(`
    WITH RECURSIVE tree AS (
      SELECT id, parent_id, type, route
      FROM menu_items
      WHERE id = $1
      UNION ALL
      SELECT m.id, m.parent_id, m.type, m.route
      FROM menu_items m
      JOIN tree t ON m.parent_id = t.id
    )
    SELECT id, parent_id, route
    FROM tree
    WHERE type = 'link'
    ORDER BY id;
  `, [folderId]);

  for (const row of res.rows) {
    const base = String(row.route || '')
      .replace(/^\//,'')
      .split('/')
      .filter(Boolean)
      .pop() || '';
    const effective = await buildEffectiveRoute(row.parent_id, base);
    if (!effective) throw new Error(`No se pudo recomputar la ruta del item ${row.id}`);
    await pool.query('UPDATE menu_items SET route = $1 WHERE id = $2', [effective, row.id]);
  }
}

// ============ LISTAR ============
router.get('/', verifyToken, authorizePermission("can_manage_endpoints"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM menu_items
       ORDER BY parent_id NULLS FIRST, position, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /menu error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ CREAR ============
router.post('/', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res) => {
  try {
    let { label, url, route, icon, permission_id, type, parent_id } = req.body;
    if (!label) return res.status(400).json({ error: 'Falta "label"' });

    type = (type === 'folder') ? 'folder' : 'link';
    const pid = (parent_id === undefined || parent_id === null || parent_id === '') ? null : Number(parent_id);

    if (type === 'folder') {
      // Subcarpetas permitidas: si hay parent, debe ser otra carpeta
      if (pid !== null) {
        const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
        if (!r.rowCount) return res.status(400).json({ error: 'La carpeta indicada no existe' });
        if (r.rows[0].type !== 'folder') return res.status(400).json({ error: 'El parent_id debe referir a una carpeta' });
      }
      url = null; route = null;
    } else {
      if (pid !== null) {
        const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
        if (!r.rowCount) return res.status(400).json({ error: 'La carpeta indicada no existe' });
        if (r.rows[0].type !== 'folder') return res.status(400).json({ error: 'El parent_id debe referir a una carpeta' });
      }
      const effective = await buildEffectiveRoute(pid, route);
      if (!effective) return res.status(400).json({ error: 'La ruta indicada no es válida' });
      route = effective;
    }

    const { rows } = await pool.query(
      `INSERT INTO menu_items (label, url, route, icon, position, permission_id, type, parent_id)
       VALUES (
         $1, $2, $3, $4,
         (SELECT COALESCE(MAX(position),0)+1 FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $7),
         $5, $6, $7
       )
       RETURNING id, label, url, route, icon, position, permission_id, type, parent_id`,
      [ label, url || null, route, icon || null, permission_id, type, pid ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ POST /menu error:', err);
    if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
      return res.status(409).json({ error: 'Ruta duplicada. Cambia el slug o su ubicación.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ REORDENAR (multi-nivel) ============
router.put('/reorder', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Formato inválido: se espera items[] no vacío' });
    }

    // Normaliza
    const normalized = items.map((it, idx) => {
      const id = Number(it?.id);
      const position = Number(it?.position);
      const parent_id =
        it?.parent_id === null || it?.parent_id === undefined || it?.parent_id === ''
          ? null
          : Number(it.parent_id);
      if (!Number.isInteger(id)) throw new Error(`Item ${idx} id inválido: ${it?.id}`);
      if (!Number.isInteger(position) || position < 1) throw new Error(`Item ${idx} position inválida: ${it?.position}`);
      return { id, position, parent_id };
    });

    // Validaciones básicas
    const ids = normalized.map(x => x.id);
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ error: 'IDs duplicados en items[]' });
    }

    // Validar parent es carpeta
    const parentIds = Array.from(new Set(normalized.map(x => x.parent_id).filter(v => v !== null)));
    if (parentIds.length) {
      const parents = await pool.query('SELECT id, type FROM menu_items WHERE id = ANY($1::int[])', [parentIds]);
      const parentType = new Map(parents.rows.map(r => [r.id, r.type]));
      for (const pid of parentIds) {
        if (!parentType.has(pid)) return res.status(400).json({ error: `La carpeta destino (id:${pid}) no existe` });
        if (parentType.get(pid) !== 'folder') return res.status(400).json({ error: `El destino (id:${pid}) no es una carpeta` });
      }
    }

    // Validar posiciones únicas por grupo (antes de tocar BD)
    const mapGroup = new Map();
    for (const it of normalized) {
      const key = it.parent_id === null ? 'null' : String(it.parent_id);
      if (!mapGroup.has(key)) mapGroup.set(key, new Set());
      const s = mapGroup.get(key);
      if (s.has(it.position)) {
        const label = await getFolderLabel(it.parent_id);
        return res.status(400).json({
          error: `Hay posiciones duplicadas dentro del grupo "${label}". Reordena para que cada elemento tenga una posición única.`
        });
      }
      s.add(it.position);
    }

    // Transacción: 1) liberar posiciones; 2) aplicar destino final
    await client.query('BEGIN');
    await client.query(
      `UPDATE menu_items SET position = position + 1000000 WHERE id = ANY($1::int[])`,
      [ids]
    );
    await client.query(
      `
      UPDATE menu_items AS m
      SET position = u.position,
          parent_id = u.parent_id
      FROM (
        SELECT
          UNNEST($1::int[]) AS id,
          UNNEST($2::int[]) AS position,
          UNNEST($3::int[]) AS parent_id
      ) AS u
      WHERE m.id = u.id
      `,
      [
        normalized.map(x => x.id),
        normalized.map(x => x.position),
        normalized.map(x => x.parent_id)
      ]
    );
    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ PUT /menu/reorder error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

// ============ ACTUALIZAR ============
router.put('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res) => {
  try {
    const { id } = req.params;
    let { label, url, route, icon, permission_id, type, parent_id } = req.body;

    const currentRes = await pool.query(
      `SELECT id, route, type, parent_id, position FROM menu_items WHERE id = $1`,
      [id]
    );
    if (!currentRes.rowCount) return res.status(404).json({ error: 'Item no encontrado' });
    const current = currentRes.rows[0];

    type = (type === 'folder') ? 'folder' : 'link';
    const pid = (parent_id === null || parent_id === undefined || parent_id === '') ? null : Number(parent_id);

    // Validar parent
    if (type === 'folder') {
      // Subcarpetas permitidas
      if (pid !== null) {
        const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
        if (!r.rowCount) return res.status(400).json({ error: 'La carpeta indicada no existe' });
        if (r.rows[0].type !== 'folder') return res.status(400).json({ error: 'El parent_id debe referir a una carpeta' });
        if (await wouldCreateCycle(pid, id)) {
          return res.status(400).json({ error: 'No puedes mover una carpeta dentro de sí misma o de sus descendientes' });
        }
      }
    } else {
      if (pid !== null) {
        const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
        if (!r.rowCount) return res.status(400).json({ error: 'La carpeta indicada no existe' });
        if (r.rows[0].type !== 'folder') return res.status(400).json({ error: 'El parent_id debe referir a una carpeta' });
      }
    }

    // Ruta efectiva si es link
    let routeVal = null;
    let urlVal = null;
    if (type === 'folder') {
      routeVal = null; urlVal = null;
    } else {
      const base = route || (current.route ? current.route.replace(/^\//, '').split('/').pop() : '');
      const effective = await buildEffectiveRoute(pid, base);
      if (!effective) return res.status(400).json({ error: 'La ruta indicada no es válida' });
      routeVal = effective;
      urlVal = url === undefined ? null : (url || null);
    }

    const iconVal = icon === undefined ? null : (icon || null);

    // Si cambia de grupo, recolocar al final del grupo destino
    let newPos = null;
    const pidChanged = (pid ?? null) !== (current.parent_id ?? null);
    if (pidChanged) {
      const posRes = await pool.query(
        'SELECT COALESCE(MAX(position),0)+1 AS next_pos FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $1',
        [pid]
      );
      newPos = Number(posRes.rows[0].next_pos) || 1;
    }

    const { rows } = await pool.query(
      `UPDATE menu_items
       SET label = COALESCE($1, label),
           url = $2,
           route = $3,
           icon = $4,
           permission_id = $5
           type = $6,
           parent_id = $7,
           position = COALESCE($8, position)
       WHERE id = $9
       RETURNING id, label, url, route, icon, position, permission_id, type, parent_id`,
      [label || null, urlVal, routeVal, iconVal, permission_id, type, pid, newPos, id]
    );

    // Si hemos modificado una carpeta (nombre o parent), recalculamos las rutas de todos sus descendientes
    if (type === 'folder' || current.type === 'folder') {
      // Ojo: si era folder y sigue siendo folder
      const updated = rows[0];
      const isFolder = (updated.type === 'folder');
      if (isFolder) {
        try {
          await rebuildDescendantLinkRoutes(Number(id));
        } catch (e) {
          console.error('⚠️ Error reconstruyendo rutas de descendientes:', e);
          return res.status(409).json({
            error: 'Conflicto al recomputar rutas de descendientes. Revisa posibles duplicados de slug.'
          });
        }
      }
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('❌ PUT /menu/:id error:', err);
    if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
      return res.status(409).json({ error: 'Ruta duplicada. Cambia el slug o su ubicación.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============ ELIMINAR ============
router.delete('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res) => {
  try {
    const { id } = req.params;

    // si es carpeta y tiene hijos, bloquear (aunque el bloquea directos ya sirve con subcarpetas)
    const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Item no encontrado' });
    if (r.rows[0].type === 'folder') {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM menu_items WHERE parent_id = $1', [id]);
      if (Number(c.rows[0].n || 0) > 0) {
        return res.status(400).json({ error: 'No se puede borrar una carpeta no vacía. Mueve o elimina antes sus elementos.' });
      }
    }

    await pool.query(`DELETE FROM menu_items WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /menu/:id error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
