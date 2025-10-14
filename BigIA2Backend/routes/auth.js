const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// <-- CAMBIO 1: Importamos las clases de error personalizadas.
const { BadRequestError, UnauthorizedError, NotFoundError, ValidationError } = require('../errors/customErrors');


/* =========================
   Secrets & TTLs
   ========================= */
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh';
const ACCESS_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10); //15m
const REFRESH_TTL_SEC = parseInt(process.env.REFRESH_TOKEN_TTL_SEC || '2592000', 10); // 30 days


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de tiempo: 15 minutos
  max: 5, // Límite de 5 peticiones por IP durante la ventana de tiempo
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo en 15 minutos.' },
  standardHeaders: true, // Envía las cabeceras estándar `RateLimit-*`
  legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
});


/* =========================
   Obtener datos a partir del rol
   ========================= */
async function getPermissionsByRol(role_id) {
  const res = await pool.query(
    `SELECT p.name from rol_permissions rp join permissions p on p.id = rp.permission_id where rp.role_id = $1`,
    [role_id]
  );
  return res.rows.map(r => r.name);
}
async function getMenuByRol(role_id) {
  const { rows } = await pool.query(
    `SELECT 
      m.id, m.label, m.url, m.route, m.icon, m.position, m.type, m.parent_id
    FROM menu_items m
    WHERE m.permission_id IN (
      SELECT permission_id 
      FROM rol_permissions 
      WHERE role_id = $1
    )
    OR m.permission_id IS NULL
    ORDER BY m.parent_id NULLS FIRST, m.position, m.id
    `,
    [role_id]
  );

  const byParent = new Map();
  for (const r of rows) {
    const key = r.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.position - b.position) || (a.id - b.id));
  }

  const build = (parentId = null) => {
    const arr = byParent.get(parentId) || [];
    return arr.map((it) => {
      const node = {
        id: it.id,
        label: it.label,
        url: it.url,
        route: it.route,
        icon: it.icon,
        position: it.position,
        type: it.type,
      };
      if (it.type === 'folder') node.children = build(it.id);
      return node;
    });
  };

  return build(null);
}

/* =========================
   Cookies helpers
   ========================= */
function buildCookieOptions() {
  const prod = process.env.NODE_ENV === 'production';
  const opts = {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'None' : 'Lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  };
  if (prod && process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
}

/* =========================
   JWT helpers
   ========================= */
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
    {
      sub: String(sub),
      jti,
      fid: familyId,
      type: 'refresh'
    },
    REFRESH_SECRET,
    { expiresIn: `${REFRESH_TTL_SEC}s` }
  );
}

/* =========================
   Sesiones (tabla 'sessions')
   ========================= */
async function issueSessionAndCookies(user, req, res) {
  const familyId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const rt = signRefreshToken({ sub: user.id, jti: sessionId, familyId });
  const hash = await bcrypt.hash(rt, 12);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await pool.query(
    `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, ip, user_agent, revoked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
    [sessionId, user.id, familyId, hash, expiresAt, req.ip || null, req.get('user-agent') || null]
  );

  res.cookie('rt', rt, buildCookieOptions());
  const accessToken = signAccessToken(user);
  return accessToken;
}

async function rotateRefresh(oldRt, payload, req, res) {
  const sessionId = payload.jti;
  const familyId = payload.fid;
  const userId = parseInt(payload.sub, 10);

  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  const current = rows[0];

  if (!current) {
    await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    // <-- CAMBIO: Lanzamos un error específico en lugar de un Error genérico.
    throw new UnauthorizedError('Posible reutilización de token de refresco detectada.');
  }

  const matches = await bcrypt.compare(oldRt, current.refresh_token_hash);
  if (!matches) {
    await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    throw new UnauthorizedError('Posible reutilización de token de refresco detectada.');
  }

  if (new Date(current.expires_at).getTime() <= Date.now()) {
    await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    throw new UnauthorizedError('El token de refresco ha expirado.');
  }

  await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);

  const newSessionId = crypto.randomUUID();
  const newRt = signRefreshToken({ sub: userId, jti: newSessionId, familyId });
  const newHash = await bcrypt.hash(newRt, 12);
  const newExpiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await pool.query(
    `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, ip, user_agent, revoked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
    [newSessionId, userId, familyId, newHash, newExpiresAt, req.ip || null, req.get('user-agent') || null]
  );

  res.cookie('rt', newRt, buildCookieOptions());

  const ures = await pool.query(`SELECT id, username, icon, role_id FROM users WHERE id = $1`, [userId]);
  const user = ures.rows[0];
  if (!user) throw new NotFoundError('Usuario asociado al token no encontrado.'); // Seguridad extra
  
  const accessToken = signAccessToken(user);
  return { accessToken, user };
}

/* =========================
   🔐 POST /auth/login
   ========================= */
// <-- CAMBIO: Añadimos 'next' a la firma de la función.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const rawUser = (req.body.username ?? '').trim();
    const password = req.body.password ?? '';

    // <-- CAMBIO: Usamos BadRequestError para validaciones de entrada.
    if (!rawUser || !password) {
      throw new BadRequestError('El nombre de usuario y la contraseña son obligatorios');
    }

    const result = await pool.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [rawUser]);
    const user = result.rows[0];

    // <-- CAMBIO: Usamos UnauthorizedError para credenciales incorrectas.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new ValidationError('Credenciales incorrectas');
    }

    const accessToken = await issueSessionAndCookies(user, req, res);
    const menu = await getMenuByRol(user.role_id);
    const permissions = await getPermissionsByRol(user.role_id);

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        icon: user.icon,
      },
      menu,
      permissions,
    });
  } catch (err) {
    // <-- CAMBIO: Pasamos cualquier error al manejador central.
    next(err);
  }
});

/* =========================
   🔐 POST /auth/refresh
   ========================= */
// <-- CAMBIO: Añadimos 'next'.
router.post('/refresh', async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    console.error("Cookie %s",rt);
    if (!rt) {
      throw new ValidationError('No se ha proporcionado token de refresco');
    }

    let payload;
    try {
      payload = jwt.verify(rt, REFRESH_SECRET);
    } catch {
      throw new ValidationError('Token de refresco inválido o malformado');
    }

    const { accessToken, user } = await rotateRefresh(rt, payload, req, res);

    const menu = await getMenuByRol(user.role_id);
    const permissions = await getPermissionsByRol(user.role_id);

    res.json({ accessToken, user, menu, permissions });
  } catch (err) {
    // <-- CAMBIO: Pasamos el error al manejador central.
    next(err);
  }
});

/* =========================
   🔐 POST /auth/logout
   ========================= */
// <-- CAMBIO: Añadimos 'next'.
router.post('/logout', async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (rt) {
      try {
        const p = jwt.verify(rt, REFRESH_SECRET);
        await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [p.fid]);
      } catch {
        // Ignoramos errores si el token ya es inválido, el objetivo es limpiar la cookie.
      }
    }
    const opts = buildCookieOptions();
    delete opts.maxAge;
    res.clearCookie('rt', opts);
    res.status(200).json({ ok: true });
  } catch (err) {
    // <-- CAMBIO: Pasamos el error al manejador central.
    next(err);
  }
});

/* =========================
   🔐 GET /auth/me
   ========================= */
// <-- CAMBIO: Añadimos 'next'.
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, username, icon, role_id FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    // <-- CAMBIO: Usamos NotFoundError si el usuario del token ya no existe.
    if (!user) {
      throw new NotFoundError('El usuario asociado a este token ya no existe');
    }
    await issueSessionAndCookies(user, req, res);
    const menu = await getMenuByRol(user.role_id);
    const permissions = await getPermissionsByRol(user.role_id);

    res.json({ user, menu, permissions });
  } catch (err) {
    // <-- CAMBIO: Pasamos el error al manejador central.
    next(err);
  }
});

module.exports = router;
