const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken, authorizePermission } = require('../middleware/auth');

/* =========================
   Secrets & TTLs
   ========================= */
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh';
const ACCESS_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10); //15m
const REFRESH_TTL_SEC = parseInt(process.env.REFRESH_TOKEN_TTL_SEC || '2592000', 10); // 30 days

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
      m.id,
      m.label,
      m.url,
      m.route,
      m.icon,
      m.position,
      m.type,
      m.parent_id
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
  const opts = {
    httpOnly: true,
    secure: 'false', // Solo se permite enviar la cookie por HTTPS
    sameSite: 'Lax', //La cookie se envia a peticiones desde otros orígenes 
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  };
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
      role: user.role,
      level: user.level,
      type: 'access'
    },
    ACCESS_SECRET,
    { expiresIn: `${ACCESS_TTL}s` }
  );
}
function signRefreshToken({ sub, jti, familyId }) {
  return jwt.sign(
    { sub: String(sub), 
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
// Crea la sesion en base de datos y devuelve la cookie con el refresh token
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

// Rotación tolerante para varias pestañas
async function rotateRefresh(oldRt, payload, req, res) {
  const sessionId = payload.jti;
  const familyId = payload.fid;
  const userId = parseInt(payload.sub, 10);

  // Busca la sesión indicada en el token
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  const current = rows[0];

  // Si no existe → posible reutilización → revoca familia y falla
  if (!current) {
    await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    throw new Error('refresh_reuse_detected');
  }

  // Comprueba hash del refresh entregado
  const matches = await bcrypt.compare(oldRt, current.refresh_token_hash);
  if (!matches) {
    await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [familyId]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    throw new Error('refresh_reuse_detected');
  }

  // Expirado
  if (new Date(current.expires_at).getTime() <= Date.now()) {
    await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    throw new Error('refresh_expired');
  }

  // Marca actual como revocada (normal en rotación)
  await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [current.id]);

  // Emite nueva sesión y cookie
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

  // Carga del usuario para el access
  const ures = await pool.query(
    `SELECT id, username, icon, role_id FROM users
     WHERE id = $1`,
    [userId]
  );
  const user = ures.rows[0];
  const accessToken = signAccessToken(user);
  return { accessToken, user };
}

/* =========================
   🔐 POST /auth/login
   ========================= */
router.post('/login', async (req, res) => {
  try {
    const rawUser = (req.body.username ?? '').trim();
    const password = req.body.password ?? '';

    const result = await pool.query(
      `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
      [rawUser]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
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
    console.error('❌ Error en /auth/login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* =========================
   🔐 POST /auth/refresh
   ========================= */
router.post('/refresh', async (req, res) => {
  try {
    const rt = req.cookies?.rt;
    if (!rt) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try { payload = jwt.verify(rt, REFRESH_SECRET); }
    catch { return res.status(401).json({ error: 'Refresh inválido' }); }

    const { accessToken, user } = await rotateRefresh(rt, payload, req, res);

    // Devuelve TODO para hidratar de una
    const menu = await getMenuByRol(user.role_id);
    const permissions = await getPermissionsByRol(user.role_id);

    res.json({ accessToken, user, menu, permissions });
  } catch (err) {
    if (err.message === 'refresh_reuse_detected' || err.message === 'refresh_expired') {
      return res.status(401).json({ error: 'Refresh no válido' });
    }
    console.error('❌ Error en /auth/refresh:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* =========================
   🔐 POST /auth/logout
   ========================= */
router.post('/logout', async (req, res) => {
  try {
    const rt = req.cookies?.rt;
    if (rt) {
      try {
        const p = jwt.verify(rt, REFRESH_SECRET);
        // Revoca TODA la familia para cerrar sesión en pestañas abiertas
        await pool.query('UPDATE sessions SET revoked = true WHERE family_id = $1', [p.fid]);
      } catch {
        // ignora errores de verificación
      }
    }
    const opts = buildCookieOptions(); delete opts.maxAge;
    res.clearCookie('rt', opts);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error en /auth/logout:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* =========================
   🔐 GET /auth/me  (devuelve la identidad a partir de un token)
   ========================= */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, icon, role_id
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const menu = await getMenuByRol(user.role_id);
    const permissions = await getPermissionsByRol(user.role_id);

    res.json({ user, menu, permissions });
  } catch (err) {
    console.error('❌ Error en /auth/me:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
