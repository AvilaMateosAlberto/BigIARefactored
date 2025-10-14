const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { verifyToken, authorizePermission } = require('../middleware/auth');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors/customErrors');

/* =========================
   👥 Gestión de usuarios (nivel ≥ 2)
   ========================= */
router.get('/', verifyToken, authorizePermission("can_view_users"), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.icon, r.name AS role_name, u.role_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.username
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/roles', verifyToken, authorizePermission("can_view_users"), async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM roles`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, authorizePermission("can_create_users"), async (req, res, next) => {
  try {
    const { username, password, role_id, icon } = req.body;
    if (!username || !password || !role_id) {
      throw new BadRequestError('Faltan campos obligatorios: nombre de usuario, contraseña y rol son requeridos.');
    }

    const roleRes = await pool.query('SELECT id FROM roles WHERE id = $1', [role_id]);
    if (roleRes.rows.length === 0) {
      throw new BadRequestError('El rol proporcionado no es válido.');
    }
    const roleId = roleRes.rows[0].id;

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role_id, icon) VALUES ($1, $2, $3, $4) RETURNING id, username, role_id, icon',
      [username, hashedPassword, roleId, icon]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return next(new ConflictError('El nombre de usuario ya existe.'));
    }
    next(err);
  }
});

router.put('/:id', verifyToken, authorizePermission("can_create_users"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, password, role_id, icon } = req.body;

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
      // This case might be redundant given the initial check, but it's safe to keep.
      throw new BadRequestError('No hay campos válidos para actualizar.');
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, role_id, icon`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Usuario con ID ${id} no encontrado.`);
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return next(new ConflictError('El nombre de usuario ya existe.'));
    }
    next(err);
  }
});

router.delete('/:id', verifyToken, authorizePermission("can_delete_users"), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isNaN(id)) {
      throw new BadRequestError('El ID del usuario debe ser un número.');
    }

    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (rowCount === 0) {
      throw new NotFoundError(`Usuario con ID ${id} no encontrado.`);
    }

    res.status(204).send(); // 204 No Content es apropiado para un DELETE exitoso
  } catch (err) {
    next(err);
  }
});

module.exports = router;

