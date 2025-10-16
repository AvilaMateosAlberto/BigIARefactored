// BigIA2Backend/routes/roles.js
const express = require('express');
const router = express.Router();
const { verifyToken, authorizePermission } = require('../middleware/auth');
const rolesService = require('../services/rolesService');

// Usamos el permiso que creamos en el init.sql
const ROLES_PERMISSION = 'can_manage_roles';

// --- RUTAS DE ROLES ---

router.get('/', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
  try {
    const roles = await rolesService.getAllRolesWithPermissions();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
  try {
    const { name } = req.body;
    const newRole = await rolesService.createRole(name);
    res.status(201).json(newRole);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/permissions', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;
    await rolesService.updateRolePermissions(id, permissionIds);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
  try {
    const { id } = req.params;
    await rolesService.deleteRole(Number(id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


// --- RUTAS DE PERMISOS ---

router.get('/all-permissions', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
  try {
    const permissions = await rolesService.getAllPermissions();
    res.json(permissions);
  } catch (err) {
    next(err);
  }
});

router.post('/permissions', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
    try {
        const { name } = req.body;
        const newPermission = await rolesService.createPermission(name);
        res.status(201).json(newPermission);
    } catch (err) {
        next(err);
    }
});

router.put('/permissions/:id', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const updatedPermission = await rolesService.updatePermission(id, name);
        res.json(updatedPermission);
    } catch (err) {
        next(err);
    }
});

router.delete('/permissions/:id', verifyToken, authorizePermission(ROLES_PERMISSION), async (req, res, next) => {
    try {
        const { id } = req.params;
        await rolesService.deletePermission(id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});


module.exports = router;