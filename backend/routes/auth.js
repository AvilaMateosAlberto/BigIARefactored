const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const menuService = require('../services/menuService');
const { verifyToken } = require('../middleware/auth');
const { BadRequestError } = require('../errors/customErrors');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Mantenemos esto para no contar los logins correctos
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.authenticate(username, password);
    const { accessToken, refreshToken } = await authService.createSession(user, req);

    // --- SOLUCIÓN DEFINITIVA ---
    // Reseteamos el contador para la IP del cliente actual.
    loginLimiter.resetKey(req.ip);

    res.cookie('rt', refreshToken, authService.buildCookieOptions());

    const [menu, permissions] = await Promise.all([
        menuService.getMenuByRol(user.role_id),
        menuService.getPermissionsByRol(user.role_id),
    ]);

    res.json({
      accessToken,
      user: { id: user.id, username: user.username, role_id: user.role_id, icon: user.icon },
      menu,
      permissions,
    });
  } catch (err) {
    next(err);
  }
});

// ... el resto del archivo no cambia

router.post('/refresh', async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies?.rt;
    if (!oldRefreshToken) {
        throw new BadRequestError('No se ha proporcionado token de refresco');
    }
    const { accessToken, user, newRefreshToken } = await authService.rotateSession(oldRefreshToken, req);

    res.cookie('rt', newRefreshToken, authService.buildCookieOptions());
    
    const [menu, permissions] = await Promise.all([
        menuService.getMenuByRol(user.role_id),
        menuService.getPermissionsByRol(user.role_id),
    ]);

    res.json({ accessToken, user, menu, permissions });
  } catch (err) {
    const opts = authService.buildCookieOptions();
    delete opts.maxAge;
    res.clearCookie('rt', opts);
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.rt;
    await authService.revokeSession(refreshToken);
    const opts = authService.buildCookieOptions();
    delete opts.maxAge;
    res.clearCookie('rt', opts);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', verifyToken, async (req, res, next) => {
    try {
        const user = req.user;
        const [menu, permissions] = await Promise.all([
            menuService.getMenuByRol(user.role_id),
            menuService.getPermissionsByRol(user.role_id),
        ]);
        res.json({ user, menu, permissions });
    } catch (err) {
        next(err);
    }
});

module.exports = router;