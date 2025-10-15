const jwt = require('jsonwebtoken');
const pool = require('../db');
// <-- 1. Importamos los errores que vamos a necesitar
const { UnauthorizedError, ForbiddenError } = require('../errors/customErrors');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access';

function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.split(/\s+/, 2)[1].trim();
  }
  return null;
}

// Middleware para verificar el Access Token
const verifyToken = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    // <-- 2. Si no hay token, lanzamos un error 401
    return next(new UnauthorizedError('Se requiere un token de autenticación'));
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    // <-- 3. Si el token es inválido o ha expirado, lanzamos un error 401
    return next(new UnauthorizedError('Token inválido o expirado'));
  }
};

// Middleware para verificar permisos específicos
const authorizePermission = (permission) => async (req, res, next) => {
  if (!req.user || !req.user.role_id) {
    return next(new UnauthorizedError('No se pudo verificar el rol del usuario'));
  }

  try {
    const { rows } = await pool.query(
      `SELECT p.name 
       FROM rol_permissions rp 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE rp.role_id = $1`,
      [req.user.role_id]
    );

    const userPermissions = rows.map(r => r.name);

    if (userPermissions.includes(permission)) {
      return next();
    } else {
      // <-- 4. Si el usuario está autenticado pero no tiene el permiso, lanzamos un error 403
      return next(new ForbiddenError('No tienes permiso para realizar esta acción'));
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  verifyToken,
  authorizePermission,
};
