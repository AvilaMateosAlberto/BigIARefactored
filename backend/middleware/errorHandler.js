/**
 * Middleware centralizado para el manejo de errores.
 * Este middleware se activa cuando se llama a `next(error)` en cualquier ruta.
 */
const errorHandler = (err, req, res, next) => {
  // Si el error es uno de nuestros errores personalizados (operacionales),
  // usamos su statusCode y mensaje.
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Si no, es un error inesperado del servidor (un bug, un fallo de BD, etc.).
  // Logueamos el error completo en la consola del servidor para poder depurarlo.
  console.error('❌ ERROR INESPERADO:', err);

  // Enviamos una respuesta genérica para no exponer detalles sensibles al cliente.
  return res.status(500).json({ error: 'Ha ocurrido un error inesperado en el servidor.' });
};

module.exports = errorHandler;
