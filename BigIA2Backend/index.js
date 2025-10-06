/* =========================
   Importamos dependencias
   ========================= */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Pool + waitForDb()
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const settingsRoutes = require('./routes/settings');
const revealjsApiRoutes = require('./routes/revealjsapi');
const app = express();

/* =========================
   Config básica y middlewares
   ========================= */
app.set('trust proxy', true);            // detrás de Nginx/proxy → IPs/cookies correctas
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());                 // <- para leer cookie 'rt' en /auth/refresh

/* =========================
   Utilidades de Autenticación (JWT)
   ========================= */
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;

// Extrae access token del header Authorization (Bearer)
function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.split(/\s+/, 2)[1].trim();
  }
  return null;
}
// Coteja el token con ACECESS_SECRET
function verifyJwt(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
}
/* =========================
   Endpoints públicos
   ========================= */
const PUBLIC = [
  // AUTH
  { method: 'POST', rx: /^\/api\/auth\/login$/ },
  { method: 'POST', rx: /^\/api\/auth\/refresh$/ },   // <- refresh NO requiere access token
  { method: 'POST', rx: /^\/api\/auth\/logout$/ },    // <- logout debe poder hacerse sin token válido
  { method: 'GET',  rx: /^\/api\/auth\/verify$/ },    // <- verificación basada en cookie rt

  // Ajustes públicos y health
  { method: 'GET',  rx: /^\/api\/settings\/public$/ },
  { method: 'GET',  rx: /^\/api\/health$/ },
];

/* =========================
   Guard global /api/*
   ========================= */
app.use((req, res, next) => {
  // Deja pasar preflights siempre (CORS)
  if (req.method === 'OPTIONS') return next();

  if (!req.path.startsWith('/api')) return next();

  const isPublic = PUBLIC.some(p => p.method === req.method && p.rx.test(req.path));
  if (isPublic) return next();

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'No autorizado' });

  req.user = payload;
  res.setHeader('X-Auth-User', payload.sub || payload.id || '');
  return next();
});

/* =========================
   Healthcheck
   ========================= */
app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message });
  }
});

/* =========================
   Rutas API
   ========================= */
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/revealjsapi', revealjsApiRoutes); // fuera de /api => no le afecta el guard

/* =========================
   404 y handler de errores
   ========================= */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});


/* =========================
   Arranque con espera a Postgres
   ========================= */
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
async function bootstrap() {
  try {
    // Esperamos a que arranque la base de datos
    await db.waitForDb();

    app.listen(PORT, HOST, () => {
      console.log(`✅ Backend corriendo en http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Fallo arrancando el backend:', err);
    process.exit(1);
  }
}

bootstrap();

/* =========================
   Parada limpia
   ========================= */
function shutdown(signal) {
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando...`);
  if (typeof db.end === 'function') {
    db.end().then(() => {
      console.log('👋 Pool Postgres cerrado.');
      process.exit(0);
    }).catch((e) => {
      console.error('⚠️ Error al cerrar pool:', e);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
