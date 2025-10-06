/* =========================
   Importamos el cliente de Postgres
   ========================= */
const { Pool } = require('pg');

/* =========================
   Configuramos el cliente
   ========================= */
function buildConfig() {
  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'bigia',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: 'bigia-backend',
  };
}

/* =========================
   Creamos el pool
   ========================= */
const pool = new Pool(buildConfig());
// Añadimos un handler de errores
pool.on('error', (err) => {
  console.error('❌ PG Pool error:', err);
});

/* =========================
   Función que espera a que la base de datos esté operativa
   ========================= */
async function waitForDb({
  retries = parseInt(process.env.DB_RETRIES || '30', 10),
  baseDelayMs = parseInt(process.env.DB_RETRY_DELAY || '1000', 10),
  maxDelayMs = 5000,
} = {}) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 0) {
        console.log(`✅ Postgres OK tras ${attempt} reintento(s).`);
      }
      return;
    } catch (err) {
      attempt++;
      const isConnRefused =
        err?.code === 'ECONNREFUSED' || /ECONNREFUSED|no pg_hba|terminating connection/i.test(String(err?.message || ''));
      const delay = Math.min(baseDelayMs * Math.pow(1.25, attempt - 1), maxDelayMs);
      console.warn(`⏳ Esperando Postgres (intento ${attempt}/${retries})${isConnRefused ? ' [conn refused]' : ''}…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Un último intento con error visible
  await pool.query('SELECT 1');
}

/* =========================
   Exportamos recursos
   ========================= */
// Export del pool
module.exports = pool;
// Export de la función de espera
module.exports.waitForDb = waitForDb;