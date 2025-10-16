// BigIA2Backend/services/rolesService.js
const pool = require('../db');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

/**
 * Obtiene todos los roles junto con los IDs de sus permisos asociados.
 */
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

/**
 * Obtiene el listado completo de todos los permisos disponibles en el sistema.
 */
async function getAllPermissions() {
  const { rows } = await pool.query('SELECT id, name FROM permissions ORDER BY id');
  return rows;
}

/**
 * Crea un nuevo rol.
 * @param {string} name - El nombre del nuevo rol.
 */
async function createRole(name) {
  if (!name || name.trim().length < 3) {
    throw new BadRequestError('El nombre del rol debe tener al menos 3 caracteres.');
  }
  try {
    const { rows } = await pool.query(
      // --- CORRECCIÓN AQUÍ ---
      // Añadimos la columna 'description' con un valor por defecto.
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), ''] // Pasamos un string vacío para la descripción
    );
    // Devolvemos el nuevo rol con un array de permisos vacío
    return { ...rows[0], permissions: [] };
  } catch (err) {
    if (err.code === '23505') {
      throw new new ConflictError('Ya existe un rol con ese nombre.');
    }
    throw err;
  }
}

/**
 * Actualiza los permisos de un rol específico.
 * @param {number} roleId - El ID del rol a actualizar.
 * @param {number[]} permissionIds - Un array con los IDs de los nuevos permisos.
 */
async function updateRolePermissions(roleId, permissionIds = []) {
  if (roleId === 2) { // El ID 2 corresponde al rol de 'admin'
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

/**
 * Elimina un rol.
 * @param {number} roleId - El ID del rol a eliminar.
 */
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

module.exports = {
  getAllRolesWithPermissions,
  getAllPermissions,
  createRole,
  updateRolePermissions,
  deleteRole,
};