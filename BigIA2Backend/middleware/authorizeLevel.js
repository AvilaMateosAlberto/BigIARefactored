// middleware/authorizeLevel.js
// ESTE SE PODRÍA BORRAR ENTERO
module.exports = function authorizeLevel(requiredLevel) {
  return function (req, res, next) {
    if (req.user && req.user.level >= requiredLevel) {
      return next();
    }
    return res.status(403).json({ error: 'No autorizado: nivel insuficiente' });
  };
};
