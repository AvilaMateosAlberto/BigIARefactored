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
const { verifyToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./errors/customErrors'); // <-- CAMBIO 1: Importamos el error específico para 404
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
   Endpoints públicos
   ========================= */
const PUBLIC = [
  // AUTH
  { method: 'POST', rx: /^\/api\/auth\/login$/ },
  { method: 'POST', rx: /^\/api\/auth\/refresh$/ },   // <- refresh NO requiere access token
  { method: 'POST', rx: /^\/api\/auth\/logout$/ },    // <- logout debe poder hacerse sin token válido
  { method: 'GET', rx: /^\/api\/auth\/verify$/ },    // <- verificación basada en cookie rt

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

  // Aquí usamos el middleware directamente
  verifyToken(req, res, () => {
    // Opcional: mantener cabecera X-Auth-User
    res.setHeader('X-Auth-User', req.user.sub || req.user.id || '');
    next();
  });
});


/* =========================
   Healthcheck
   ========================= */
app.get('/api/health', async (_req, res, next) => { // Añadimos 'next' para el manejo de errores
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    // Si la base de datos falla, pasamos el error al manejador central
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
app.use('/api/roles', rolesRoutes); // <-- AÑADIR ESTA LÍNEA

/* =========================
   404 y handler de errores
   ========================= */

// <-- CAMBIO 2: Lógica de 404 y error handler modificada
// Si ninguna ruta anterior coincide, este middleware se ejecuta y crea un error 404.
app.use((req, res, next) => {
  next(new NotFoundError(`No se puede encontrar ${req.originalUrl} en este servidor.`));
});

// El manejador de errores centralizado se encarga de todos los errores pasados a través de next().
// ¡Debe ser el último middleware!
app.use(errorHandler);


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
