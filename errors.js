const logger = require('./logger');

// Пользовательские классы ошибок
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

// Обработчик ошибок для Express
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Логируем ошибку
  logger.logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // В режиме разработки отправляем полную информацию об ошибке
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // В продакшене отправляем только необходимую информацию
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      code: err.errorCode
    });
  }

  // Для непредвиденных ошибок отправляем общее сообщение
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong',
    code: 'INTERNAL_ERROR'
  });
};

// Обработчик необработанных исключений
const handleUncaughtException = (err) => {
  logger.logError(err, { event: 'uncaught_exception' });
  
  // Даем время на логирование ошибки
  setTimeout(() => {
    process.exit(1);
  }, 1000);
};

// Обработчик необработанных промисов
const handleUnhandledRejection = (reason, promise) => {
  logger.logError(new Error('Unhandled Promise rejection'), {
    event: 'unhandled_rejection',
    reason,
    promise
  });
};

// Функция для валидации входных данных
const validateInput = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);
    }
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) throw new ValidationError(error.details[0].message);
    }
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) throw new ValidationError(error.details[0].message);
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Функция для асинхронного обработчика маршрутов
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Функция для обработки WebSocket ошибок
const handleWebSocketError = (ws, error) => {
  const errorMessage = {
    type: 'error',
    code: error.errorCode || 'WEBSOCKET_ERROR',
    message: error.message || 'WebSocket error occurred'
  };

  logger.logError(error, {
    event: 'websocket_error',
    isAuthed: ws.isAuthed
  });

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(errorMessage));
  }
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  errorHandler,
  handleUncaughtException,
  handleUnhandledRejection,
  validateInput,
  asyncHandler,
  handleWebSocketError
};