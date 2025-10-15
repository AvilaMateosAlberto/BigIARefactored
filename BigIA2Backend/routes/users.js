const express = require('express');
const router = express.Router();
const { verifyToken, authorizePermission } = require('../middleware/auth');
const userService = require('../services/userService');

router.get('/', verifyToken, authorizePermission("can_view_users"), async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/roles', verifyToken, authorizePermission("can_view_users"), async (req, res, next) => {
  try {
    const roles = await userService.getAllRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, authorizePermission("can_create_users"), async (req, res, next) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json({ user: newUser });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', verifyToken, authorizePermission("can_create_users"), async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body);
    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', verifyToken, authorizePermission("can_delete_users"), async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;