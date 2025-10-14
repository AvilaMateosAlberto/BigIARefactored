const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorizePermission } = require('../middleware/auth');
const { BadRequestError } = require('../errors/customErrors');

const DEFAULTS = {
  topbar_color: '#c40000',
  topbar_text: 'BigIA 2.0',
  document_title: 'BigIA 2.0',
  login_message: 'Acceso a BigIA 2.0',
};

// Utilidades de saneado
const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '');
const clampStr = (s, n) => (s ?? '').toString().slice(0, n);

async function getAppConfig() {
  const { rows } = await pool.query(
    `SELECT topbar_color, topbar_text, document_title, login_message FROM app_config WHERE id = 1`
  );
  const cfg = rows[0] || DEFAULTS;
  return {
    topbar_color: isHex(cfg.topbar_color) ? cfg.topbar_color : DEFAULTS.topbar_color,
    topbar_text: clampStr(cfg.topbar_text, 60) || DEFAULTS.topbar_text,
    document_title: clampStr(cfg.document_title, 60) || DEFAULTS.document_title,
    login_message: clampStr(cfg.login_message, 120) || DEFAULTS.login_message,
  };
}

// GET /api/settings/public
router.get('/public', async (req, res, next) => {
  try {
    res.json(await getAppConfig());
  } catch (err) {
    // Si la BD falla aquí, es mejor que devuelva un 500 que los defaults
    next(err);
  }
});

// GET /api/settings (privado)
router.get('/', verifyToken, authorizePermission('can_view_admin_dashboards'), async (req, res, next) => {
  try {
    res.json(await getAppConfig());
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings - Actualizar configuración (protegido)
// Cambiado de POST a PUT por ser una acción idempotente de actualización
router.put('/', verifyToken, authorizePermission('can_view_admin_dashboards'), async (req, res, next) => {
  try {
    const { topbar_color, topbar_text, document_title, login_message } = req.body || {};

    // Validaciones
    if (!topbar_color || !topbar_text || !document_title || !login_message) {
      throw new BadRequestError('Todos los campos de configuración son obligatorios.');
    }
    if (!isHex(topbar_color)) {
      throw new BadRequestError('El color de la barra superior no es un código hexadecimal válido.');
    }

    const text = clampStr(topbar_text, 60);
    const title = clampStr(document_title, 60);
    const loginMsg = clampStr(login_message, 120);

    const { rows } = await pool.query(
      `UPDATE app_config 
       SET topbar_color = $1, topbar_text = $2, document_title = $3, login_message = $4 
       WHERE id = 1 
       RETURNING *`,
      [topbar_color, text, title, loginMsg]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

