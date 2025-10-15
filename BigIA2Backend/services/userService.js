const pool = require('../db');
const bcrypt = require('bcrypt');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

async function getAllUsers() {
  const result = await pool.query(`
    SELECT u.id, u.username, u.icon, r.name AS role_name, u.role_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.username
  `);
  return result.rows;
}

async function getAllRoles() {
  const result = await pool.query(`SELECT * FROM roles ORDER BY id`);
  return result.rows;
}

async function createUser({ username, password, role_id, icon }) {
  if (!username || !password || !role_id) {
    throw new BadRequestError('Faltan campos obligatorios: nombre de usuario, contraseña y rol son requeridos.');
  }

  const roleRes = await pool.query('SELECT id FROM roles WHERE id = $1', [role_id]);
  if (roleRes.rows.length === 0) {
    throw new BadRequestError('El rol proporcionado no es válido.');
  }
  const roleId = roleRes.rows[0].id;

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, role_id, icon) VALUES ($1, $2, $3, $4) RETURNING id, username, role_id, icon',
      [username, hashedPassword, roleId, icon]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') { // Error de unicidad de PostgreSQL
      throw new ConflictError('El nombre de usuario ya existe.');
    }
    throw err; // Relanza otros errores para que los capture el manejador central
  }
}

async function updateUser(id, { username, password, role_id, icon }) {
    if (isNaN(id)) {
        throw new BadRequestError('El ID del usuario debe ser un número.');
    }

    if (!username && !password && !role_id && icon === undefined) {
        throw new BadRequestError('No se proporcionaron campos para actualizar.');
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (username) {
        updates.push(`username = $${idx++}`);
        values.push(username);
    }
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push(`password = $${idx++}`);
        values.push(hashedPassword);
    }
    if (role_id) {
        const roleRes = await pool.query('SELECT id FROM roles WHERE id = $1', [role_id]);
        if (roleRes.rows.length === 0) {
            throw new BadRequestError('El rol proporcionado no es válido.');
        }
        updates.push(`role_id = $${idx++}`);
        values.push(role_id);
    }
    if (icon !== undefined) {
        updates.push(`icon = $${idx++}`);
        values.push(icon);
    }

    if (updates.length === 0) {
        throw new BadRequestError('No hay campos válidos para actualizar.');
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, role_id, icon`;
    
    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            throw new NotFoundError(`Usuario con ID ${id} no encontrado.`);
        }
        return result.rows[0];
    } catch (err) {
        if (err.code === '23505') {
            throw new ConflictError('El nombre de usuario ya existe.');
        }
        throw err;
    }
}

async function deleteUser(id) {
  if (isNaN(id)) {
    throw new BadRequestError('El ID del usuario debe ser un número.');
  }
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  if (rowCount === 0) {
    throw new NotFoundError(`Usuario con ID ${id} no encontrado.`);
  }
  return true; // Éxito
}

module.exports = {
  getAllUsers,
  getAllRoles,
  createUser,
  updateUser,
  deleteUser,
};

