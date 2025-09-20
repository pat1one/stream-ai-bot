// openapi.js — генерация OpenAPI спецификации для stream-ai-bot
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stream AI Bot API',
      version: '1.0.0',
      description: 'Документация REST API для Stream AI Bot',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local server' }
    ],
  },
  apis: ['./server.js', './rbac_new.js', './notifications.js', './webhooks.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
