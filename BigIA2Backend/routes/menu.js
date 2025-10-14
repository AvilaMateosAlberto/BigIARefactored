const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorizePermission } = require('../middleware/auth');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

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
    const base = String(row.route || '').replace(/^\//,'').split('/').filter(Boolean).pop() || '';
    const effective = await buildEffectiveRoute(row.parent_id, base);
    if (!effective) throw new Error(`No se pudo recomputar la ruta del item ${row.id}`);
    await pool.query('UPDATE menu_items SET route = $1 WHERE id = $2', [effective, row.id]);
  }
}

// ============ LISTAR ============
router.get('/', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, p.name AS permission_name
       FROM menu_items m
       LEFT JOIN permissions p ON m.permission_id = p.id
       ORDER BY m.parent_id NULLS FIRST, m.position, m.id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/permissions', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM permissions');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ============ CREAR ============
router.post('/', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    let { label, url, route, icon, permission_id, type, parent_id } = req.body;
    if (!label) throw new BadRequestError('El campo "label" es obligatorio');

    type = (type === 'folder') ? 'folder' : 'link';
    const pid = (parent_id == null || parent_id === '') ? null : Number(parent_id);

    if (pid !== null) {
      const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
      if (!r.rowCount) throw new BadRequestError('La carpeta padre especificada no existe');
      if (r.rows[0].type !== 'folder') throw new BadRequestError('El parent_id debe referir a una carpeta');
    }

    if (type === 'folder') {
      url = null; route = null;
    } else {
      const effective = await buildEffectiveRoute(pid, route);
      if (!effective) throw new BadRequestError('La ruta (route) proporcionada no es válida o está vacía');
      route = effective;
    }

    const { rows } = await pool.query(
      `INSERT INTO menu_items (label, url, route, icon, position, permission_id, type, parent_id)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position),0)+1 FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $7), $5, $6, $7)
       RETURNING *`,
      [label, url || null, route, icon || null, permission_id, type, pid]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
      return next(new ConflictError('Ruta duplicada. Cambia el slug o su ubicación.'));
    }
    next(err);
  }
});

// ============ REORDENAR (multi-nivel) ============
router.put('/reorder', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Formato inválido: se espera un array `items` no vacío.');
    }

    const normalized = items.map((it, idx) => {
      const id = Number(it?.id);
      const position = Number(it?.position);
      const parent_id = (it?.parent_id == null || it?.parent_id === '') ? null : Number(it.parent_id);
      if (!Number.isInteger(id)) throw new BadRequestError(`Item ${idx} con ID inválido: ${it?.id}`);
      if (!Number.isInteger(position) || position < 1) throw new BadRequestError(`Item ${idx} con posición inválida: ${it?.position}`);
      return { id, position, parent_id };
    });

    const ids = normalized.map(x => x.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestError('IDs duplicados en el array `items`.');
    }

    const parentIds = Array.from(new Set(normalized.map(x => x.parent_id).filter(v => v !== null)));
    if (parentIds.length) {
      const parents = await pool.query('SELECT id, type FROM menu_items WHERE id = ANY($1::int[])', [parentIds]);
      const parentType = new Map(parents.rows.map(r => [r.id, r.type]));
      for (const pid of parentIds) {
        if (!parentType.has(pid)) throw new BadRequestError(`La carpeta destino (id:${pid}) no existe`);
        if (parentType.get(pid) !== 'folder') throw new BadRequestError(`El destino (id:${pid}) no es una carpeta`);
      }
    }

    const mapGroup = new Map();
    for (const it of normalized) {
      const key = it.parent_id === null ? 'null' : String(it.parent_id);
      if (!mapGroup.has(key)) mapGroup.set(key, new Set());
      const s = mapGroup.get(key);
      if (s.has(it.position)) {
        const label = await getFolderLabel(it.parent_id);
        throw new BadRequestError(`Posiciones duplicadas dentro del grupo "${label}". Cada elemento debe tener una posición única por grupo.`);
      }
      s.add(it.position);
    }

    await client.query('BEGIN');
    await client.query(`UPDATE menu_items SET position = position + 1000000 WHERE id = ANY($1::int[])`, [ids]);
    await client.query(
      `UPDATE menu_items AS m SET position = u.position, parent_id = u.parent_id
       FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS position, UNNEST($3::int[]) AS parent_id) AS u
       WHERE m.id = u.id`,
      [normalized.map(x => x.id), normalized.map(x => x.position), normalized.map(x => x.parent_id)]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============ ACTUALIZAR ============
router.put('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const { id } = req.params;
    let { label, url, route, icon, permission_id, type, parent_id } = req.body;

    if (isNaN(id)) throw new BadRequestError('El ID del item debe ser un número.');

    const currentRes = await pool.query(`SELECT * FROM menu_items WHERE id = $1`, [id]);
    if (!currentRes.rowCount) throw new NotFoundError(`Ítem de menú con ID ${id} no encontrado.`);
    const current = currentRes.rows[0];

    type = (type === 'folder') ? 'folder' : 'link';
    const pid = (parent_id == null || parent_id === '') ? null : Number(parent_id);

    if (pid !== null) {
      const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [pid]);
      if (!r.rowCount) throw new BadRequestError('La carpeta padre especificada no existe.');
      if (r.rows[0].type !== 'folder') throw new BadRequestError('El parent_id debe referir a una carpeta.');
      if (await wouldCreateCycle(pid, id)) {
        throw new BadRequestError('No puedes mover una carpeta dentro de sí misma o de sus descendientes.');
      }
    }

    let routeVal = null;
    let urlVal = url === undefined ? current.url : (url || null);
    if (type === 'folder') {
      urlVal = null;
    } else {
      const base = route || (current.route ? current.route.replace(/^\//, '').split('/').pop() : '');
      const effective = await buildEffectiveRoute(pid, base);
      if (!effective) throw new BadRequestError('La ruta indicada no es válida o está vacía.');
      routeVal = effective;
    }

    let newPos = current.position;
    const pidChanged = (pid ?? null) !== (current.parent_id ?? null);
    if (pidChanged) {
      const posRes = await pool.query(
        'SELECT COALESCE(MAX(position),0)+1 AS next_pos FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $1 AND id != $2',
        [pid, id]
      );
      newPos = Number(posRes.rows[0].next_pos) || 1;
    }

    const { rows } = await pool.query(
      `UPDATE menu_items
       SET label = $1, url = $2, route = $3, icon = $4, permission_id = $5, type = $6, parent_id = $7, position = $8
       WHERE id = $9 RETURNING *`,
      [label, urlVal, routeVal, icon, permission_id, type, pid, newPos, id]
    );

    if (rows[0].type === 'folder' || current.type === 'folder') {
        try {
            await rebuildDescendantLinkRoutes(Number(id));
        } catch (e) {
            console.error('⚠️ Error reconstruyendo rutas de descendientes:', e);
            throw new ConflictError('Conflicto al recomputar rutas de descendientes. Revisa posibles duplicados de slug.');
        }
    }

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
      return next(new ConflictError('Ruta duplicada. Cambia el slug o su ubicación.'));
    }
    next(err);
  }
});

// ============ ELIMINAR ============
router.delete('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) throw new BadRequestError('El ID debe ser un número.');

    const r = await pool.query('SELECT type FROM menu_items WHERE id = $1', [id]);
    if (!r.rowCount) throw new NotFoundError(`Ítem de menú con ID ${id} no encontrado.`);

    if (r.rows[0].type === 'folder') {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM menu_items WHERE parent_id = $1', [id]);
      if (Number(c.rows[0].n || 0) > 0) {
        throw new BadRequestError('No se puede borrar una carpeta no vacía. Mueve o elimina antes sus elementos.');
      }
    }

    await pool.query(`DELETE FROM menu_items WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

