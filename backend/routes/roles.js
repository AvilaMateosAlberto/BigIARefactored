// BigIA2Backend/routes/roles.js
const express = require('express');
const router = express.Router();
const { verifyToken, authorizePermission } = require('../middleware/auth');
const rolesService = require('../services/rolesService');

// Usaremos un permiso de admin existente para proteger estas rutas
const ADMIN_PERMISSION = 'can_view_admin_dashboards';

// GET /api/roles - Obtiene todos los roles y sus permisos
router.get('/', verifyToken, authorizePermission(ADMIN_PERMISSION), async (req, res, next) => {
  try {
    const roles = await rolesService.getAllRolesWithPermissions();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// GET /api/roles/all-permissions - Obtiene la lista de todos los permisos posibles
router.get('/all-permissions', verifyToken, authorizePermission(ADMIN_PERMISSION), async (req, res, next) => {
  try {
    const permissions = await rolesService.getAllPermissions();
    res.json(permissions);
  } catch (err) {
    next(err);
  }
});

// POST /api/roles - Crea un nuevo rol
router.post('/', verifyToken, authorizePermission(ADMIN_PERMISSION), async (req, res, next) => {
  try {
    const { name } = req.body;
    const newRole = await rolesService.createRole(name);
    res.status(201).json(newRole);
  } catch (err) {
    next(err);
  }
});

// PUT /api/roles/:id/permissions - Actualiza los permisos de un rol
router.put('/:id/permissions', verifyToken, authorizePermission(ADMIN_PERMISSION), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;
    await rolesService.updateRolePermissions(id, permissionIds);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roles/:id - Elimina un rol
router.delete('/:id', verifyToken, authorizePermission(ADMIN_PERMISSION), async (req, res, next) => {
  try {
    const { id } = req.params;
    await rolesService.deleteRole(Number(id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;