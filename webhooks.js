const crypto = require('crypto');
const fetch = require('node-fetch');
const logger = require('./logger');

class WebhookManager {
  constructor() {
    this.webhooks = new Map(); // id -> { url, events, secret }
  }

  // Регистрация нового вебхука
  register({ url, events = [], secret }) {
    const id = crypto.randomUUID();
    this.webhooks.set(id, { url, events, secret });
    logger.logWithContext('info', 'Webhook registered', { id, url, events });
    return id;
  }

  // Удаление вебхука
  unregister(id) {
    const existed = this.webhooks.delete(id);
    if (existed) {
      logger.logWithContext('info', 'Webhook unregistered', { id });
    }
    return existed;
  }

  // Получение списка вебхуков
  list() {
    return Array.from(this.webhooks.entries()).map(([id, data]) => ({ id, ...data }));
  }

  // Отправка события всем подходящим вебхукам
  async trigger(event, payload) {
    for (const [id, { url, events, secret }] of this.webhooks.entries()) {
      if (events.length === 0 || events.includes(event)) {
        await this.sendWebhook(url, event, payload, secret, id);
      }
    }
  }

  // Отправка HTTP POST запроса на вебхук
  async sendWebhook(url, event, payload, secret, id) {
    const body = JSON.stringify({ event, payload });
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Id': id
    };
    if (secret) {
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        timeout: 5000
      });
      logger.logWithContext('info', 'Webhook sent', { url, event, status: res.status });
    } catch (error) {
      logger.logError(error, { event: 'webhook_send_error', url });
    }
  }
}

const webhookManager = new WebhookManager();
module.exports = webhookManager;
