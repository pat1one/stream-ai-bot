
# Stream AI Bot

Многофункциональный AI-бот для Twitch/Youtube с современным dashboard, REST API, RBAC, webhooks, мониторингом, автотестами и расширяемой архитектурой.

## Быстрый старт

```bash
git clone https://github.com/pat1one/stream-ai-bot.git
cd stream-ai-bot
npm install
npm run dev
```

Откройте http://localhost:3000 для доступа к dashboard.

## Dashboard (панель управления)

Веб-интерфейс для управления ботом, пользователями, ролями, уведомлениями, командами, метриками и логами.

- Поддержка RBAC UI (назначение ролей)
- Мониторинг (метрики, логи, Prometheus)
- Управление командами и webhooks
- Локализация (RU/EN), тёмная/светлая тема
- Гибкая настройка через `dashboard-config.js`

### Скриншот
![dashboard screenshot](twitch-bot-dashboard/screenshot.png)

## Конфиг dashboard

Файл: `twitch-bot-dashboard/dashboard-config.js`

```js
export default {
  apiBaseUrl: '/api',
  wsDefaultUrl: 'ws://localhost:3000',
  defaultTheme: 'dark',
  defaultLang: 'ru',
  enableRbac: true,
  enableMetrics: true,
  enableNotifications: true,
  enableOAuth: false // включить после интеграции OAuth
};
```

## Документация REST API (Swagger UI)

- Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- OpenAPI спецификация: `openapi.js`

## Примеры API

### Получить команды
`GET /api/commands?page=1&pageSize=20`

### Назначить роль пользователю
`POST /api/rbac/role/:userId` body: `{ "role": "admin" }`

### Получить метрики
`GET /api/metrics` (JSON), `GET /metrics` (Prometheus)

### Управление webhooks
`POST /api/webhooks`, `GET /api/webhooks`, `DELETE /api/webhooks/:id`

## RBAC UI

В dashboard реализован UI для назначения ролей пользователям (admin/moderator/user/guest). Требуются права администратора.

## Мониторинг и логи

- Метрики: /api/metrics (JSON), /metrics (Prometheus)
- Логи: /api/logs
- Интеграция Sentry для отслеживания ошибок (DSN через переменную окружения)

## Webhooks

Система поддерживает регистрацию внешних вебхуков для интеграции с другими сервисами. Вебхуки вызываются при определённых событиях (например, при новых уведомлениях).

### Пример регистрации вебхука
```json
POST /api/webhooks
{
  "url": "https://your-service.com/webhook-endpoint",
  "events": ["notification"],
  "secret": "your-secret-key"
}
```

## Sentry

Для мониторинга ошибок используйте переменную окружения `SENTRY_DSN`.

## Тесты и CI

- Unit-тесты: `npm test`
- Покрытие: Codecov
- Pre-commit хуки: husky, lint-staged
- CI: GitHub Actions

## Roadmap

- [x] OpenAPI/Swagger UI
- [x] Sentry интеграция
- [x] RBAC UI
- [x] Конфиг dashboard
- [x] Мониторинг/метрики
- [x] Webhooks
- [x] Автотесты/CI
- [ ] OAuth/SSO

---

**Автор:** [pat1one](https://github.com/pat1one)

## Webhooks API

Система поддерживает регистрацию внешних вебхуков для интеграции с другими сервисами. Вебхуки вызываются при определённых событиях (например, при новых уведомлениях).

### Регистрация вебхука

POST `/api/webhooks`

**Тело запроса:**
```json
{
  "url": "https://your-service.com/webhook-endpoint",
  "events": ["notification"],
  "secret": "your-secret-key"
}
```

**Ответ:**
```json
{
  "id": "webhook-uuid"
}
```

### Удаление вебхука

DELETE `/api/webhooks/:id`

### Получение списка вебхуков

GET `/api/webhooks`

### Пример структуры события

```json
{
  "event": "notification",
  "payload": {
    "userId": "user123",
    "notification": {
      "id": "...",
      "type": "info",
      "message": "...",
      ...
    }
  }
}
```

**Заголовки:**
- `X-Webhook-Event` — тип события
- `X-Webhook-Id` — идентификатор вебхука
- `X-Webhook-Signature` — HMAC SHA256 подпись (если задан secret)

### Пример проверки подписи на стороне получателя (Node.js)
```js
const crypto = require('crypto');
const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
if (req.headers['x-webhook-signature'] !== expected) {
  // reject
}
```