const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../errors/customErrors');

// --- Constantes de Configuración ---
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh';
const ACCESS_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10); // 15m
const REFRESH_TTL_SEC = parseInt(process.env.REFRESH_TOKEN_TTL_SEC || '2592000', 10); // 30 days

// --- Funciones de Lógica de Negocio ---

/**
 * Autentica a un usuario por su nombre y contraseña.
 * @param {string} username - El nombre de usuario.
 * @param {string} password - La contraseña en texto plano.
 * @returns {Promise<object>} El objeto de usuario de la base de datos.
 * @throws {BadRequestError} Si faltan credenciales.
 * @throws {UnauthorizedError} Si las credenciales son incorrectas.
 */
async function authenticate(username, password) {
  if (!username || !password) {
    throw new BadRequestError('El nombre de usuario y la contraseña son obligatorios');
  }

  const result = await pool.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [username.trim()]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError('Credenciales incorrectas');
  }

  return user;
}

/**
 * Crea una nueva familia de sesión y devuelve los tokens.
 * @param {object} user - El objeto de usuario autenticado.
 * @param {object} req - El objeto de petición de Express.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function createSession(user, req) {
  const familyId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti: sessionId, familyId });
  const hash = await bcrypt.hash(refreshToken, 12);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

  await pool.query(
    `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, ip, user_agent, revoked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
    [sessionId, user.id, familyId, hash, expiresAt, req.ip || null, req.get('user-agent') || null]
  );

  const accessToken = signAccessToken(user);
  return { accessToken, refreshToken };
}

/**
 * Rota un refresh token, invalidando el antiguo y creando uno nuevo.
 * @param {string} oldRefreshToken - El refresh token recibido en la cookie.
 * @param {object} req - El objeto de petición de Express.
 * @returns {Promise<{accessToken: string, user: object, newRefreshToken: string}>}
 * @throws {UnauthorizedError} Si el token es inválido, ha expirado o se detecta reutilización.
 */
async function rotateSession(oldRefreshToken, req) {
    let payload;
    try {
      payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);
    } catch {
      throw new UnauthorizedError('Token de refresco inválido o malformado');
    }

    const sessionId = payload.jti;
    const familyId = payload.fid;
    const userId = parseInt(payload.sub, 10);
  
    const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    const current = rows[0];
  
    if (!current || current.revoked) {
      await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
      throw new UnauthorizedError('Posible reutilización de token de refresco detectada.');
    }
  
    const matches = await bcrypt.compare(oldRefreshToken, current.refresh_token_hash);
    if (!matches) {
      await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
      throw new UnauthorizedError('Posible reutilización de token de refresco detectada (hash incorrecto).');
    }
  
    if (new Date(current.expires_at).getTime() <= Date.now()) {
      await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);
      throw new UnauthorizedError('El token de refresco ha expirado.');
    }
  
    // Invalida el token actual y crea uno nuevo en la misma familia.
    await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);
  
    const newSessionId = crypto.randomUUID();
    const newRefreshToken = signRefreshToken({ sub: userId, jti: newSessionId, familyId });
    const newHash = await bcrypt.hash(newRefreshToken, 12);
    const newExpiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  
    await pool.query(
      `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, ip, user_agent, revoked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
      [newSessionId, userId, familyId, newHash, newExpiresAt, req.ip || null, req.get('user-agent') || null]
    );
  
    const userRes = await pool.query(`SELECT id, username, icon, role_id FROM users WHERE id = $1`, [userId]);
    const user = userRes.rows[0];
    if (!user) throw new NotFoundError('Usuario asociado al token no encontrado.');
  
    const accessToken = signAccessToken(user);
    return { accessToken, user, newRefreshToken };
}

/**
 * Revoca una familia de sesiones a partir de un refresh token.
 * @param {string} refreshToken - El refresh token a revocar.
 */
async function revokeSession(refreshToken) {
    if (!refreshToken) return;
    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [payload.fid]);
    } catch {
        // Ignorar errores si el token es inválido. El objetivo es invalidar si es posible.
    }
}

// --- Funciones Helper ---

function signAccessToken(user) {
    return jwt.sign(
      {
        sub: String(user.id),
        id: user.id,
        username: user.username,
        role_id: user.role_id ?? user.roleId ?? null,
        type: 'access',
      },
      ACCESS_SECRET,
      { expiresIn: `${ACCESS_TTL}s` }
    );
}
  
function signRefreshToken({ sub, jti, familyId }) {
    return jwt.sign(
      { sub: String(sub), jti, fid: familyId, type: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: `${REFRESH_TTL_SEC}s` }
    );
}

function buildCookieOptions() {
    const prod = process.env.NODE_ENV === 'production';
    const opts = {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? 'None' : 'Lax',
      path: '/api/auth', // Path debe ser el mismo donde se lee
      maxAge: REFRESH_TTL_SEC * 1000,
    };
    if (prod && process.env.COOKIE_DOMAIN) {
      opts.domain = process.env.COOKIE_DOMAIN;
    }
    return opts;
}

module.exports = {
    authenticate,
    createSession,
    rotateSession,
    revokeSession,
    buildCookieOptions,
};

