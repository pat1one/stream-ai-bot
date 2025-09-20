const Joi = require('joi');
const logger = require('./logger');

// Регулярные выражения и константы для валидации
const PATTERNS = {
    NAME: /^[a-zA-Z0-9_-]{3,30}$/,
    TITLE_MAX_LENGTH: 100,
    MESSAGE_MAX_LENGTH: 1000,
    TEMPLATE_VARS: /\${([^}]+)}/g,
    PARAM_TYPES: ['string', 'number', 'boolean', 'date']
};

// Схемы Joi для валидации
const notificationSchemas = {
    // Схема параметра
    parameter: Joi.object({
        name: Joi.string().pattern(PATTERNS.NAME).required()
            .messages({
                'string.pattern.base': 'Parameter name must contain only letters, numbers, underscores and dashes'
            }),
        type: Joi.string().valid(...PATTERNS.PARAM_TYPES).required(),
        required: Joi.boolean().default(true),
        default: Joi.any().optional()
    }),

  // Схема шаблона уведомления
  template: Joi.object({
    name: Joi.string().pattern(PATTERNS.NAME).required()
      .messages({
        'string.pattern.base': 'Template name must contain only letters, numbers, underscores and dashes'
      }),
    title: Joi.string().max(PATTERNS.TITLE_MAX_LENGTH).required()
      .messages({
        'string.max': `Title cannot be longer than ${PATTERNS.TITLE_MAX_LENGTH} characters`
      }),
    message: Joi.string().max(PATTERNS.MESSAGE_MAX_LENGTH).required()
      .messages({
        'string.max': `Message cannot be longer than ${PATTERNS.MESSAGE_MAX_LENGTH} characters`
      }),
    parameters: Joi.array().items(notificationSchemas.parameter).default([]),
    important: Joi.boolean().default(false),
    category: Joi.string().max(40).allow(null, ''),
    priority: Joi.string().valid('low', 'normal', 'high', 'critical').allow(null, ''),
    tags: Joi.array().items(Joi.string().max(32)).allow(null)
  }),

    // Схема для отправки уведомления
    send: Joi.object({
        userId: Joi.string().required(),
        parameters: Joi.object().pattern(
            Joi.string(),
            Joi.any()
        ).default({})
    })
};

// Схемы валидации для аутентификации
const authSchemas = {
  register: {
    body: Joi.object({
      username: Joi.string().min(3).max(30).required(),
      password: Joi.string().min(6).required()
    })
  },
  login: {
    body: Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required()
    })
  }
};

// Схемы валидации для команд
const commandSchemas = {
  create: {
    body: Joi.object({
      name: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/).required(),
      payload: Joi.string().max(1000).required()
    })
  },
  delete: {
    params: Joi.object({
      name: Joi.string().required()
    })
  }
};

// Схемы валидации для настроек
const settingsSchemas = {
  update: {
    body: Joi.object({
      autoReconnect: Joi.boolean(),
      persistLogs: Joi.boolean(),
      theme: Joi.string().valid('light', 'dark'),
      notifications: Joi.boolean()
    }).min(1)
  }
};

// Схемы валидации для WebSocket сообщений
const wsSchemas = {
  message: Joi.object({
    type: Joi.string().valid('say', 'announce', 'custom', 'auth').required(),
    text: Joi.when('type', {
      is: Joi.string().valid('say', 'announce'),
      then: Joi.string().max(500).required()
    }),
    cmd: Joi.when('type', {
      is: 'custom',
      then: Joi.string().max(50).required()
    }),
    token: Joi.when('type', {
      is: 'auth',
      then: Joi.string().required()
    })
  })
};

module.exports = {
  authSchemas,
  commandSchemas,
  settingsSchemas,
  wsSchemas,
  notificationSchemas
};