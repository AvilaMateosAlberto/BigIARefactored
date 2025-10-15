/**
 * Clase base para errores operacionales y previsibles en la aplicación.
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - El mensaje de error.
   * @param {number} statusCode - El código de estado HTTP.
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Marca el error como previsible, no un bug del sistema.

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error para peticiones mal formadas o con datos faltantes. (400 Bad Request)
 * @extends AppError
 */
class BadRequestError extends AppError {
  constructor(message = 'Petición incorrecta') {
    super(message, 400);
  }
}

/**
 * Error para intentos de acceso sin autenticación. (401 Unauthorized)
 * @extends AppError
 */
class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado o credenciales incorrectas') {
    super(message, 401);
  }
}

/**
 * Error para intentos de acceso a recursos sin los permisos necesarios. (403 Forbidden)
 * @extends AppError
 */
class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para acceder a este recurso') {
    super(message, 403);
  }
}

/**
 * Error para recursos que no han sido encontrados. (404 Not Found)
 * @extends AppError
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

/**
 * Error para acciones que crean un conflicto con el estado actual del servidor (ej. duplicados). (409 Conflict)
 * @extends AppError
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
  }
}

/**
 * Error para fallos de validación de datos. (422 Unprocessable Entity)
 * @extends AppError
 */
class ValidationError extends AppError {
  constructor(message = 'Los datos proporcionados no son válidos') {
    super(message, 422);
  }
}


module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
