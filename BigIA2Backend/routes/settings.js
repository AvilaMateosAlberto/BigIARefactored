// src/backend/routes/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorizeMinLevel } = require('../middleware/auth');

const DEFAULTS = {
  topbar_color: '#c40000',
  theme_mode: 'light',
  topbar_text: 'BigIA 2.0',
  document_title: 'BigIA 2.0',
  login_message: 'Acceso a BigIA 2.0',
};

// Extrae la configuración de la aplicación de base de datos
async function getAppConfig() {
  const { rows } = await pool.query(
    `SELECT topbar_color, theme_mode, topbar_text, document_title, login_message
     FROM app_config WHERE id = 1`
  );
  const cfg = rows[0] || DEFAULTS;
  return {
    topbar_color: isHex(cfg.topbar_color) ? cfg.topbar_color : DEFAULTS.topbar_color,
    theme_mode: cfg.theme_mode === 'dark' ? 'dark' : 'light',
    topbar_text: clampStr(cfg.topbar_text, 60) || DEFAULTS.topbar_text,
    document_title: clampStr(cfg.document_title, 60) || DEFAULTS.document_title,
    login_message: clampStr(cfg.login_message, 120) || DEFAULTS.login_message,
  };
}

// Utilidades de saneado
const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '');
const clampStr = (s, n) => (s ?? '').toString().slice(0, n);

// ====== PÚBLICO: lo usamos en el login/pre-bootstrap ======
router.get('/public', async (_req, res) => {
  try {
    res.json(await getAppConfig());
  } catch (e) {
    console.error(e);
    res.json(DEFAULTS);
  }
});

// ====== PRIVADO (admin) ======
router.get('/', verifyToken, authorizeMinLevel(2), async (_req, res) => {
  try {
    res.json(await getAppConfig());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'settings_read_failed' });
  }
});
router.put('/', verifyToken, authorizeMinLevel(2), async (req, res) => {
  try {
    const {
      topbar_color,
      theme_mode,
      topbar_text,
      document_title,
      login_message,
    } = req.body || {};

    const color = isHex(topbar_color) ? topbar_color : DEFAULTS.topbar_color;
    const theme = theme_mode === 'dark' ? 'dark' : 'light';
    const text = clampStr(topbar_text, 60) || DEFAULTS.topbar_text;
    const title = clampStr(document_title, 60) || DEFAULTS.document_title;
    const loginMsg = clampStr(login_message, 120) || DEFAULTS.login_message;

    const { rows } = await pool.query(
      `UPDATE app_config
         SET topbar_color = $1,
             theme_mode = $2,
             topbar_text = $3,
             document_title = $4,
             login_message = $5
       WHERE id = 1
       RETURNING topbar_color, theme_mode, topbar_text, document_title, login_message`,
      [color, theme, text, title, loginMsg]
    );

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'settings_write_failed' });
  }
});

module.exports = router;
