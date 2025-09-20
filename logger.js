const winston = require('winston');
const path = require('path');

// Создаем форматтер для логов
const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

// Создаем логгер
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Записываем все логи в файл
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// В режиме разработки также выводим в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }));
}

// Создаем папку для логов, если её нет
const fs = require('fs');
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Хелперы для логирования с контекстом
logger.logWithContext = (level, message, context = {}) => {
  logger.log(level, message, { ...context });
};

// Функция для логирования HTTP запросов
logger.logHttpRequest = (req, res, responseTime) => {
  const { method, originalUrl, ip } = req;
  logger.info('HTTP Request', {
    method,
    url: originalUrl,
    ip,
    statusCode: res.statusCode,
    responseTime,
  });
};

// Функция для логирования ошибок с контекстом
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
  });
};

// Функция для логирования действий пользователя
logger.logUserAction = (userId, action, details = {}) => {
  logger.info(`User Action: ${action}`, {
    userId,
    action,
    ...details,
  });
};

// Функция для логирования WebSocket событий
logger.logWebSocketEvent = (eventType, details = {}) => {
  logger.info(`WebSocket Event: ${eventType}`, {
    eventType,
    ...details,
  });
};

module.exports = logger;