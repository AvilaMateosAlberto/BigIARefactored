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
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'dev_access';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh';
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_SEC = parseInt(process.env.REFRESH_TOKEN_TTL_SEC || '2592000', 10); // 30 days

/* =========================
   Helpers de permisos/menú
   ========================= */
async function getPermissionsByRol(role_id) {
  const res = await pool.query(
    `SELECT p.name from rol_permissions rp join permissions p on p.id = rp.permission_id where rp.role_id = $1`,
    [level]
  );
  return res.rows.map(r => r.name);
}

// Construye menú EN ÁRBOL filtrado por nivel
async function getMenuByRol(role_id) {
  const { rows } = await pool.query(
    `SELECT id, label, url, route, icon, position, type, parent_id
     FROM menu_items
     WHERE nivel_requerido <= $1
     ORDER BY parent_id NULLS FIRST, position, id`,
    [level]
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
  const isProd = process.env.NODE_ENV === 'production';
  const crossSite = process.env.COOKIES_CROSS_SITE === 'true';

  const opts = {
    httpOnly: true,
    secure: isProd && (crossSite ? true : false), // Secure si SameSite=None en prod
    sameSite: crossSite ? 'None' : 'Lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  };

  // Solo aplica domain si parece FQDN (no IP/localhost)
  const dom = (process.env.COOKIE_DOMAIN || '').trim();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(dom);
  const looksFqdn = dom && dom.includes('.') && !isIp && dom.toLowerCase() !== 'localhost';
  if (looksFqdn) opts.domain = dom;

  return opts;
}

function clearLegacySessionCookie(res) {
  const opts = { httpOnly: true, sameSite: 'Lax', path: '/api/auth' };
  const dom = (process.env.COOKIE_DOMAIN || '').trim();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(dom);
  const looksFqdn = dom && dom.includes('.') && !isIp && dom.toLowerCase() !== 'localhost';
  if (looksFqdn) opts.domain = dom;
  res.clearCookie('session', opts); // cookie vieja
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
      type: 'access',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefreshToken({ sub, jti, familyId }) {
  return jwt.sign(
    { sub: String(sub), jti, fid: familyId, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: `${REFRESH_TTL_SEC}s` }
  );
}

/* =========================
   Sesiones (tabla 'sessions')
   ========================= */
// Crea familia+sesión, setea cookie 'rt' y devuelve access
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
    `SELECT u.id, u.username, u.icon, r.nombre AS role, r.nivel AS level
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
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
      `SELECT u.id, u.username, u.password, u.icon,
              r.nombre AS role, r.nivel AS level
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [rawUser]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const accessToken = await issueSessionAndCookies(user, req, res);
    clearLegacySessionCookie(res);

    const menu = await getMenuByLevel(user.level);
    const permissions = await getPermissionsByLevel(user.level);

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        icon: user.icon,
        level: user.level,
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
    clearLegacySessionCookie(res);

    // Devuelve TODO para hidratar de una
    const menu = await getMenuByLevel(user.level);
    const permissions = await getPermissionsByLevel(user.level);

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
    clearLegacySessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error en /auth/logout:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* =========================
   🔐 GET /auth/me  (requiere access)
   ========================= */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.icon, r.nombre AS role, r.nivel AS level
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const menu = await getMenuByLevel(user.level);
    const permissions = await getPermissionsByLevel(user.level);

    res.json({ user, menu, permissions });
  } catch (err) {
    console.error('❌ Error en /auth/me:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* =========================
   👥 Gestión de usuarios (nivel ≥ 2)
   ========================= */
router.get('/users', verifyToken, authorizePermission("can_view_users"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.icon, r.nombre AS role, r.nivel AS level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.username
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error en GET /users:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/users', verifyToken, authorizePermission("can_create_users"), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const roleRes = await pool.query('SELECT id FROM roles WHERE nombre = $1', [role]);
    if (roleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    const roleId = roleRes.rows[0].id;

    const result = await pool.query(
      'INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, roleId]
    );

    res.status(201).json({ user: { id: result.rows[0].id, username, role } });
  } catch (err) {
    console.error('❌ Error al crear usuario:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/users/:id', verifyToken, authorizePermission("can_delete_users"), async (req, res) => {
  const { id } = req.params;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
