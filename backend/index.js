/* =========================
   Importamos dependencias
   ========================= */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const db = require('./db'); // Pool + waitForDb()
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const menuRoutes = require('./routes/menu');
const settingsRoutes = require('./routes/settings');
const rolesRoutes = require('./routes/roles');
const revealjsApiRoutes = require('./routes/revealjsapi'); // <- Asegúrate de que esta ruta esté importada
const { verifyToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./errors/customErrors');
const app = express();

/* =========================
   Config básica y middlewares
   ========================= */
// --- CAMBIO 1: Ajuste del 'trust proxy' para seguridad del rate-limiter ---
// Le decimos que confíe en la primera IP de proxy (ej. Nginx)
app.set('trust proxy', 1);

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());                 // <- para leer cookie 'rt' en /auth/refresh

/* =========================
   Endpoints públicos
   ========================= */
const PUBLIC = [
  // AUTH
  { method: 'POST', rx: /^\/api\/auth\/login$/ },
  { method: 'POST', rx: /^\/api\/auth\/refresh$/ },   // <- refresh NO requiere access token
  { method: 'POST', rx: /^\/api\/auth\/logout$/ },    // <- logout debe poder hacerse sin token válido
  // { method: 'GET', rx: /^\/api\/auth\/verify$/ }, // Esta ruta no la estamos usando, se puede comentar o quitar

  // Ajustes públicos y health
  { method: 'GET', rx: /^\/api\/settings\/public$/ },
  { method: 'GET', rx: /^\/api\/health$/ },
];

/* =========================
   Guard global /api/*
   ========================= */
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (!req.path.startsWith('/api')) return next();

  const isPublic = PUBLIC.some(p => p.method === req.method && p.rx.test(req.path));
  if (isPublic) return next();

  // --- CAMBIO 2: Manejo de error robusto en la verificación del token ---
  verifyToken(req, res, (err) => {
    // Si verifyToken devuelve un error (ej. token caducado o inválido),
    // lo pasamos al manejador de errores central y detenemos la ejecución aquí.
    if (err) {
      return next(err);
    }
    
    // Esta línea solo se ejecutará si el token es válido y req.user existe,
    // evitando el crash "Cannot read properties of undefined".
    res.setHeader('X-Auth-User', req.user.sub || req.user.id || '');
    next();
  });
});


/* =========================
   Healthcheck
   ========================= */
app.get('/api/health', async (_req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    next(e);
  }
});

/* =========================
   Rutas API
   ========================= */
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/revealjsapi', revealjsApiRoutes); // <- Asegúrate de que esta ruta esté registrada

/* =========================
   404 y handler de errores
   ========================= */
app.use((req, res, next) => {
  next(new NotFoundError(`No se puede encontrar ${req.originalUrl} en este servidor.`));
});

app.use(errorHandler);

/* =========================
   Arranque con espera a Postgres
   ========================= */
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
async function bootstrap() {
  try {
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