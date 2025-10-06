// src/backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

// Lee token de Authorization: Bearer <token> o de cookie "session"
function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.split(/\s+/, 2)[1].trim();
  }
  return req.cookies?.session || null;
}

// Verifica JWT y devuelve el payload o null
function verifyJwt(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
}

// Middleware: exige token válido, adjunta req.user
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = auth.split(/\s+/,2)[1];
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware de autorización por nivel mínimo
function authorizeMinLevel(minLevel = 1) {
  return (req, res, next) => {
    const level = Number(req.user?.level ?? 0);
    if (Number.isNaN(level) || level < minLevel) {
      return res.status(403).json({ error: 'Prohibido' });
    }
    next();
  };
}

// (Opcional) Autorización por permiso nominal, por si lo usas en otras rutas
function authorizePermission(permissionName) {
  return (req, res, next) => {
    const perms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (!perms.includes(permissionName)) {
      return res.status(403).json({ error: 'Prohibido' });
    }
    next();
  };
}

module.exports = {
  extractToken,
  verifyJwt,
  verifyToken,
  authorizeMinLevel,
  authorizePermission,
};
