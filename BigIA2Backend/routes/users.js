// appReact/src/backend/routes/menu.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { verifyToken, authorizePermission } = require('../middleware/auth');

/* =========================
   👥 Gestión de usuarios (nivel ≥ 2)
   ========================= */
router.get('/', verifyToken, authorizePermission("can_view_users"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.icon, r.name AS role_name, u.role_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.username
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error en GET /users:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/roles', verifyToken, authorizePermission("can_view_users"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM roles
    `);
    console.debug('Me pidieron los roles.');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error en GET /users/roles:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verifyToken, authorizePermission("can_create_users"), async (req, res) => {
  const { username, password, role_id, icon } = req.body;
  if (!username || !password || !role_id) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const roleRes = await pool.query('SELECT id FROM roles WHERE id = $1', [role_id]);
    if (roleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    const roleId = roleRes.rows[0].id;

    const result = await pool.query(
      'INSERT INTO users (username, password, role_id, icon) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashedPassword, roleId, icon]
    );

    res.status(201).json({ user: { id: result.rows[0].id, username, role_id, icon } });
  } catch (err) {
    console.error('❌ Error al crear usuario:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verifyToken, authorizePermission("can_delete_users"), async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;