// BigIA2Backend/services/rolesService.js
const pool = require('../db');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

// --- ROLES ---

async function getAllRolesWithPermissions() {
  const { rows } = await pool.query(`
    SELECT 
      r.id, 
      r.name,
      r.description,
      COALESCE(
        (SELECT json_agg(rp.permission_id) FROM rol_permissions rp WHERE rp.role_id = r.id),
        '[]'::json
      ) AS permissions
    FROM roles r
    ORDER BY r.id;
  `);
  return rows;
}

async function createRole(name) {
  if (!name || name.trim().length < 3) {
    throw new BadRequestError('El nombre del rol debe tener al menos 3 caracteres.');
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), '']
    );
    return { ...rows[0], permissions: [] };
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Ya existe un rol con ese nombre.');
    }
    throw err;
  }
}

async function updateRolePermissions(roleId, permissionIds = []) {
  if (roleId === 2) {
    throw new BadRequestError('Los permisos del rol de administrador no se pueden modificar.');
  }
  if (!Array.isArray(permissionIds)) {
    throw new BadRequestError('Los permisos deben ser un array de IDs.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM rol_permissions WHERE role_id = $1', [roleId]);
    if (permissionIds.length > 0) {
      const values = permissionIds.map(pId => `(${parseInt(roleId, 10)}, ${parseInt(pId, 10)})`).join(',');
      await client.query(`INSERT INTO rol_permissions (role_id, permission_id) VALUES ${values}`);
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteRole(roleId) {
  if (roleId === 1 || roleId === 2) {
    throw new BadRequestError('No se pueden eliminar los roles base del sistema.');
  }
  const { rowCount } = await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
  if (rowCount === 0) {
    throw new NotFoundError(`No se encontró el rol con ID ${roleId}.`);
  }
  return { success: true };
}


// --- PERMISOS ---

async function getAllPermissions() {
  const { rows } = await pool.query('SELECT id, name FROM permissions ORDER BY name');
  return rows;
}

async function createPermission(name) {
  if (!name || !name.trim()) {
    throw new BadRequestError('El nombre del permiso no puede estar vacío.');
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO permissions (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Ya existe un permiso con ese nombre.');
    }
    throw err;
  }
}

async function updatePermission(id, name) {
    if (!name || !name.trim()) {
        throw new BadRequestError('El nombre del permiso no puede estar vacío.');
    }
    const { rows } = await pool.query(
        'UPDATE permissions SET name = $1 WHERE id = $2 RETURNING *',
        [name.trim(), id]
    );
    if (rows.length === 0) {
        throw new NotFoundError(`No se encontró el permiso con ID ${id}.`);
    }
    return rows[0];
}

async function deletePermission(id) {
    const { rowCount } = await pool.query('DELETE FROM permissions WHERE id = $1', [id]);
    if (rowCount === 0) {
        throw new NotFoundError(`No se encontró el permiso con ID ${id}.`);
    }
    return { success: true };
}


module.exports = {
  getAllRolesWithPermissions,
  createRole,
  updateRolePermissions,
  deleteRole,
  getAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
};