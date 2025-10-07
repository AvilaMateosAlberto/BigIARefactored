// src/backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;

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
  } catch (err){
    console.error('❌ JWT verification error:', err.message);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Autorización por permiso nominal
// Verifica que el rol del usuario que lanza la petición tenga el permiso permission Name
function authorizePermission(permissionName) {
  // TO-DO
  return (req, res, next) => {
    // const perms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    // if (!perms.includes(permissionName)) {
    //   return res.status(403).json({ error: 'Prohibido' });
    // }
    next();
  };
}

module.exports = {
  verifyToken,
  authorizePermission,
};
