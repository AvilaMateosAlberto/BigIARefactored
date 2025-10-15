const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorizePermission } = require('../middleware/auth');
const menuService = require('../services/menuService');
const { BadRequestError } = require('../errors/customErrors');

// ============ LISTAR ============
router.get('/', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const menuItems = await menuService.getAllMenuItems();
    res.json(menuItems);
  } catch (err) {
    next(err);
  }
});

router.get('/permissions', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const permissions = await menuService.getAllPermissions();
    res.json(permissions);
  } catch (err) {
    next(err);
  }
});

// ============ CREAR ============
router.post('/', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const newItem = await menuService.createMenuItem(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

// ============ REORDENAR (RUTA ESPECÍFICA ANTES QUE LA GENÉRICA) ============

// Helper para obtener el label de una carpeta para mensajes de error
async function getFolderLabel(pid) {
    if (pid == null) return '(Top level)';
    const r = await pool.query('SELECT label FROM menu_items WHERE id = $1', [pid]);
    return r.rowCount ? r.rows[0].label : `(id:${pid})`;
}

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
      // Usamos una transacción para asegurar la consistencia de los datos
      for (const item of normalized) {
        await client.query(
            'UPDATE menu_items SET position = $1, parent_id = $2 WHERE id = $3',
            [item.position, item.parent_id, item.id]
        );
      }
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
});

// ============ ACTUALIZAR (RUTA GENÉRICA DESPUÉS) ============
router.put('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    const updatedItem = await menuService.updateMenuItem(req.params.id, req.body);
    res.json(updatedItem);
  } catch (err) {
    next(err);
  }
});

// ============ ELIMINAR ============
router.delete('/:id', verifyToken, authorizePermission("can_manage_endpoints"), async (req, res, next) => {
  try {
    await menuService.deleteMenuItem(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


module.exports = router;