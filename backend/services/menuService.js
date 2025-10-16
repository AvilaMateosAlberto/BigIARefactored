const pool = require('../db');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

// --- Helpers Internos (no se exportan) ---
// (Estas funciones no cambian)
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-_/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function getFolderSlugChain(pid) {
  if (pid == null) return null;
  const slugs = [];
  let current = pid;
  while (current != null) {
    const r = await pool.query('SELECT id, parent_id, label, type FROM menu_items WHERE id = $1', [current]);
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
  if (parent_id == null) return `/${pageSlug}`;
  const chain = await getFolderSlugChain(parent_id);
  if (!chain) return null;
  return `/${chain}/${pageSlug}`;
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
        SELECT id, parent_id, type, route FROM menu_items WHERE id = $1
        UNION ALL
        SELECT m.id, m.parent_id, m.type, m.route FROM menu_items m JOIN tree t ON m.parent_id = t.id
      )
      SELECT id, parent_id, route FROM tree WHERE type = 'link' ORDER BY id;
    `, [folderId]);
  
    for (const row of res.rows) {
      const base = String(row.route || '').replace(/^\//,'').split('/').filter(Boolean).pop() || '';
      const effective = await buildEffectiveRoute(row.parent_id, base);
      if (!effective) throw new Error(`No se pudo recomputar la ruta del item ${row.id}`);
      await pool.query('UPDATE menu_items SET route = $1 WHERE id = $2', [effective, row.id]);
    }
}


// --- Funciones Exportadas del Servicio ---

async function getPermissionsByRol(role_id) {
    const res = await pool.query(
      `SELECT p.name from rol_permissions rp join permissions p on p.id = rp.permission_id where rp.role_id = $1`,
      [role_id]
    );
    return res.rows.map(r => r.name);
}
  
// --- FUNCIÓN MODIFICADA ---
async function getMenuByRol(role_id) {
  // 1. Obtenemos TODOS los items del menú y TODOS los permisos del rol.
  const { rows: allItems } = await pool.query('SELECT * FROM menu_items ORDER BY position');
  const { rows: rolePerms } = await pool.query('SELECT permission_id FROM rol_permissions WHERE role_id = $1', [role_id]);
  
  const itemsById = new Map(allItems.map(item => [item.id, item]));
  const userPermissions = new Set(rolePerms.map(p => p.permission_id));
  const memo = new Map(); // Caché para no recalcular permisos

  // 2. Función recursiva que comprueba si se tiene acceso a un item y a TODOS sus padres.
  function hasAccess(itemId) {
    if (memo.has(itemId)) return memo.get(itemId);

    const item = itemsById.get(itemId);
    if (!item) {
      memo.set(itemId, false);
      return false;
    }

    // Un item es visible si es público (sin permiso) O si el usuario tiene el permiso.
    const canSeeItem = item.permission_id === null || userPermissions.has(item.permission_id);
    if (!canSeeItem) {
      memo.set(itemId, false);
      return false;
    }
    
    // Si el item no tiene padre y podemos verlo, el camino es válido.
    if (item.parent_id === null) {
      memo.set(itemId, true);
      return true;
    }
    
    // Si tiene padre, comprobamos recursivamente el acceso al padre.
    const parentHasAccess = hasAccess(item.parent_id);
    memo.set(itemId, parentHasAccess);
    return parentHasAccess;
  }

  // 3. Filtramos la lista completa de items, quedándonos solo con los que superan la validación.
  const accessibleItems = allItems.filter(item => hasAccess(item.id));

  // 4. Construimos el árbol final solo con los items a los que se tiene acceso.
  const byParent = new Map();
  for (const item of accessibleItems) {
    const key = item.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  }

  const build = (parentId = null) => {
    const arr = byParent.get(parentId) || [];
    arr.sort((a, b) => a.position - b.position);
    return arr.map((it) => {
      const node = { id: it.id, label: it.label, url: it.url, route: it.route, icon: it.icon, position: it.position, type: it.type };
      if (it.type === 'folder') node.children = build(it.id);
      return node;
    });
  };

  return build(null);
}

async function getAllMenuItems() {
    const { rows } = await pool.query(
        `SELECT m.*, p.name AS permission_name
         FROM menu_items m
         LEFT JOIN permissions p ON m.permission_id = p.id
         ORDER BY m.parent_id NULLS FIRST, m.position, m.id`
    );
    return rows;
}

async function getAllPermissions() {
    const { rows } = await pool.query('SELECT * FROM permissions ORDER BY name');
    return rows;
}

async function createMenuItem({ label, url, route, icon, permission_id, type, parent_id }) {
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

    try {
        const { rows } = await pool.query(
            `INSERT INTO menu_items (label, url, route, icon, position, permission_id, type, parent_id)
             VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position),0)+1 FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $7), $5, $6, $7)
             RETURNING *`,
            [label, url || null, route, icon || null, permission_id, type, pid]
        );
        return rows[0];
    } catch (err) {
        if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
            throw new ConflictError('Ruta duplicada. Cambia el slug o su ubicación.');
        }
        throw err;
    }
}

async function updateMenuItem(id, { label, url, route, icon, permission_id, type, parent_id }) {
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
        const posRes = await pool.query('SELECT COALESCE(MAX(position),0)+1 AS next_pos FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $1 AND id != $2', [pid, id]);
        newPos = Number(posRes.rows[0].next_pos) || 1;
    }

    try {
        const { rows } = await pool.query(
            `UPDATE menu_items SET label = $1, url = $2, route = $3, icon = $4, permission_id = $5, type = $6, parent_id = $7, position = $8
             WHERE id = $9 RETURNING *`,
            [label, urlVal, routeVal, icon, permission_id, type, pid, newPos, id]
        );

        if (rows[0].type === 'folder' || current.type === 'folder') {
            await rebuildDescendantLinkRoutes(Number(id));
        }
        return rows[0];
    } catch(err) {
        if (err.code === '23505' && /route/.test(String(err.constraint || ''))) {
            throw new ConflictError('Ruta duplicada. Cambia el slug o su ubicación.');
        }
        if (err.message.includes('No se pudo recomputar')) {
            throw new ConflictError('Conflicto al recomputar rutas de descendientes. Revisa posibles duplicados de slug.');
        }
        throw err;
    }
}

async function deleteMenuItem(id) {
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
    return true;
}

module.exports = {
    getPermissionsByRol,
    getMenuByRol,
    getAllMenuItems,
    getAllPermissions,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
};