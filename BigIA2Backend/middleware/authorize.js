// ESTE SE PODRÍA BORRAR ENTERO


const db = require('../db');

async function authorizeRoute(req, res, next) {
  try {
    const userLevel = req.user.level;
    const route = req.originalUrl.split('?')[0]; // Ruta sin parámetros

    const result = await db.query(
      `SELECT 1
       FROM menu_items
       WHERE route = $1 AND nivel_requerido <= $2`,
      [route, userLevel]
    );

    if (!result.rowCount) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    next();
  } catch (e) {
    console.error('❌ Error en authorizeRoute:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { authorizeRoute };
