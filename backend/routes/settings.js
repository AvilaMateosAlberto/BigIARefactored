const express = require('express');
const router = express.Router();
const { verifyToken, authorizePermission } = require('../middleware/auth');
const settingsService = require('../services/settingsService');

// GET /api/settings/public
router.get('/public', async (req, res, next) => {
  try {
    const config = await settingsService.getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// GET /api/settings (privado)
router.get('/', verifyToken, authorizePermission('can_view_admin_dashboards'), async (req, res, next) => {
  try {
    const config = await settingsService.getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings - Actualizar configuración
router.put('/', verifyToken, authorizePermission('can_view_admin_dashboards'), async (req, res, next) => {
  try {
    const updatedConfig = await settingsService.updateConfig(req.body);
    res.json(updatedConfig);
  } catch (err) {
    next(err);
  }
});

module.exports = router;