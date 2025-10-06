const db = require('../db');

async function findByUsername(username) {
  const res = await db.query(`
    SELECT 
      u.id, u.username, u.password, u.icon,
      r.nombre AS role,
      r.nivel AS level
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.username = $1
  `, [username]);

  return res.rows[0]; // Devuelve { id, username, password, icon, role, level }
}

async function createUser(username, passwordHash, roleName) {
  // Buscar el ID del rol por su nombre
  const roleRes = await db.query('SELECT id FROM roles WHERE nombre = $1', [roleName]);
  if (roleRes.rows.length === 0) {
    throw new Error(`Rol no encontrado: ${roleName}`);
  }

  const roleId = roleRes.rows[0].id;

  const res = await db.query(
    'INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id',
    [username, passwordHash, roleId]
  );

  return res.rows[0];
}

module.exports = { findByUsername, createUser };
