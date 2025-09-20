// --- Вложения и файлы в уведомлениях ---
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, 'attachments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// API: загрузить вложение
app.post('/api/notifications/attachment', (req, res) => {
  const { filename, filedata, notificationId } = req.body;
  if (!filename || !filedata || !notificationId) return res.status(400).json({ error: 'filename, filedata, notificationId обязательны' });
  try {
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(filedata, 'base64'));
    // Сохранить ссылку на вложение в уведомлении
    db.run('UPDATE notifications SET attachment = ? WHERE id = ?', [filePath, notificationId]);
    res.json({ success: true, url: `/api/notifications/attachment/${filename}` });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// API: получить вложение
app.get('/api/notifications/attachment/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Файл не найден');
  res.sendFile(filePath);
});
// --- Рендер шаблона с переменными ---
function renderTemplate(content, variables) {
  return content.replace(/\{(\w+)\}/g, (_, key) => variables[key] || '');
}

app.post('/api/notification-templates/render', (req, res) => {
  const { content, variables } = req.body;
  if (!content || typeof variables !== 'object') return res.status(400).json({ error: 'content и variables обязательны' });
  try {
    const rendered = renderTemplate(content, variables);
    res.json({ rendered });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка рендера шаблона' });
  }
});
// --- Webhook для событий аудита ---
const fetch = require('node-fetch');
let auditWebhookUrl = '';

// API: установить URL webhook для аудита
app.post('/api/webhook/audit', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL обязателен' });
  auditWebhookUrl = url;
  res.json({ success: true });
});

// Вызов webhook при подозрительных действиях (например, неудачный вход)
function sendAuditWebhook(payload) {
  if (auditWebhookUrl) {
    fetch(auditWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }
}

// ...existing code...
// Пример: логировать вход пользователя
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // ...existing code...
  if (username === 'admin' && password === 'admin') {
    const user = { username, role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '2h' });
    logAudit(username, 'login', 'Успешный вход');
    res.json({ token });
  } else {
    logAudit(username, 'login_failed', 'Ошибка входа');
    sendAuditWebhook({ event: 'login_failed', user: username, time: new Date().toISOString() });
    res.status(401).json({ error: 'Неверные данные' });
  }
});
// --- OAuth2 интеграция для корпоративных клиентов ---
app.get('/api/auth/oauth2/callback', async (req, res) => {
  // TODO: интеграция с Google/Microsoft OAuth2
  // Пример заглушки: обработка авторизации
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'Нет кода авторизации' });
  // Здесь должен быть обмен code на токен и получение профиля пользователя
  // ...
  // Пример ответа
  res.json({ success: true, info: `OAuth2 авторизация успешна (code: ${code}, state: ${state})` });
});
// --- ML-сегментация пользователей и персонализация уведомлений ---
app.get('/api/ai/segment/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // Получить историю уведомлений пользователя
    const history = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [userId]);
    // Примитивная ML-логика: если много "clicked" — сегмент "активный", если много "archived" — "пассивный", иначе "обычный"
    const clicked = history.filter(n => n.status === 'clicked').length;
    const archived = history.filter(n => n.status === 'archived').length;
    let segment = 'обычный';
    if (clicked > 10) segment = 'активный';
    else if (archived > 20) segment = 'пассивный';
    // Персонализация: рекомендация по типу уведомлений
    let recommendType = 'info';
    if (segment === 'активный') recommendType = 'warning';
    else if (segment === 'пассивный') recommendType = 'reminder';
    res.json({ segment, recommendType, stats: { clicked, archived } });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка ML-сегментации' });
  }
});
// --- Интеграция с голосовыми ассистентами (Google Assistant, Alexa) ---
app.post('/api/voice/command', async (req, res) => {
  const { userId, command } = req.body;
  // TODO: интеграция с Google Assistant/Alexa SDK
  // Пример заглушки: обработка команд
  let result = '';
  if (command === 'list_notifications') {
    // Получить последние уведомления пользователя
    const rows = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
    result = rows.map(n => `${n.type}: ${n.message}`).join('; ');
  } else if (command === 'mark_all_read') {
    await db.run('UPDATE notifications SET status = "read" WHERE user_id = ?', [userId]);
    result = 'Все уведомления отмечены как прочитанные.';
  } else {
    result = 'Команда не распознана.';
  }
  res.json({ success: true, result });
});
// --- Визуализация связей: граф событий и пользователей ---
app.get('/api/analytics/graph', async (req, res) => {
  try {
    // Получить пользователей и события
    const users = await db.all('SELECT DISTINCT user_id FROM notifications');
    const events = await db.all('SELECT id, user_id, type, status FROM notifications LIMIT 200');
    // Узлы: пользователи и события
    const nodes = users.map(u => ({ id: 'u_' + u.user_id, label: u.user_id, group: 'user' }))
      .concat(events.map(e => ({ id: 'e_' + e.id, label: e.type + ' (' + e.status + ')', group: 'event' })));
    // Связи: пользователь -> событие
    const edges = events.map(e => ({ from: 'u_' + e.user_id, to: 'e_' + e.id }));
    res.json({ nodes, edges });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка графа' });
  }
});
// --- Расширение RBAC: детализированные права для ролей ---
db.run(`CREATE TABLE IF NOT EXISTS rbac_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.run(`CREATE TABLE IF NOT EXISTS rbac_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  permission TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API: получить все роли
app.get('/api/rbac/roles', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM rbac_roles ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка получения ролей' });
  }
});

// API: создать роль
app.post('/api/rbac/roles', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Имя роли обязательно' });
  try {
    await db.run('INSERT INTO rbac_roles (name, description) VALUES (?, ?)', [name, description || '']);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка создания роли' });
  }
});

// API: удалить роль
app.delete('/api/rbac/roles/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM rbac_roles WHERE id = ?', [req.params.id]);
    await db.run('DELETE FROM rbac_permissions WHERE role_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка удаления роли' });
  }
});

// API: получить права роли
app.get('/api/rbac/permissions/:roleId', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM rbac_permissions WHERE role_id = ?', [req.params.roleId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка получения прав' });
  }
});

// API: добавить право роли
app.post('/api/rbac/permissions', async (req, res) => {
  const { role_id, permission } = req.body;
  if (!role_id || !permission) return res.status(400).json({ error: 'role_id и permission обязательны' });
  try {
    await db.run('INSERT INTO rbac_permissions (role_id, permission) VALUES (?, ?)', [role_id, permission]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка добавления права' });
  }
});

// API: удалить право роли
app.delete('/api/rbac/permissions/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM rbac_permissions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка удаления права' });
  }
});
// --- Кэширование и оптимизация SQL-запросов ---
const cache = {};
function getCache(key, ttl = 60) {
  const entry = cache[key];
  if (entry && (Date.now() - entry.time < ttl * 1000)) return entry.value;
  return null;
}
function setCache(key, value) {
  cache[key] = { value, time: Date.now() };
}

// Пример: кэшировать /api/analytics/activity на 60 секунд
app.get('/api/analytics/activity', async (req, res) => {
  const cached = getCache('analytics_activity');
  if (cached) return res.json({ activity: cached });
  try {
    const activity = await db.all(`SELECT DATE(created_at) as day, COUNT(*) as count FROM notifications GROUP BY day ORDER BY day DESC LIMIT 30`);
    setCache('analytics_activity', activity);
    res.json({ activity });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// --- Интеграция с Prometheus/Grafana: endpoint /metrics ---
app.get('/metrics', async (req, res) => {
  try {
    const notifCount = await db.get('SELECT COUNT(*) as count FROM notifications');
    const errorCount = await db.get('SELECT COUNT(*) as count FROM errors');
    const userCount = await db.get('SELECT COUNT(DISTINCT user_id) as count FROM notifications');
    let metrics = '';
    metrics += `notifications_total ${notifCount.count}\n`;
    metrics += `errors_total ${errorCount.count}\n`;
    metrics += `users_total ${userCount.count}\n`;
    metrics += `uptime_seconds ${(Date.now() - serverStart) / 1000}\n`;
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (e) {
    res.status(500).send('# Ошибка метрик');
  }
});
// --- Мультиязычные push-уведомления ---
const pushMessages = {
  ru: {
    title: 'Новое уведомление',
    message: 'У вас новое сообщение!'
  },
  en: {
    title: 'New notification',
    message: 'You have a new message!'
  },
  es: {
    title: 'Nueva notificación',
    message: '¡Tienes un nuevo mensaje!'
  }
};

app.post('/api/mobile/push/i18n', async (req, res) => {
  const { userId, lang } = req.body;
  const msg = pushMessages[lang] || pushMessages['en'];
  // TODO: интеграция с push-сервисом
  res.json({ success: true, info: `Push-уведомление для ${userId} (${lang}) отправлено: ${msg.title} - ${msg.message}` });
});
// --- Гибкая настройка шаблонов уведомлений ---
db.run(`CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  type TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API: получить все шаблоны
app.get('/api/notification-templates', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM notification_templates ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка получения шаблонов' });
  }
});

// API: создать шаблон
app.post('/api/notification-templates', async (req, res) => {
  const { name, type, content } = req.body;
  if (!name || !type || !content) return res.status(400).json({ error: 'Заполните все поля' });
  try {
    await db.run('INSERT INTO notification_templates (name, type, content) VALUES (?, ?, ?)', [name, type, content]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка создания шаблона' });
  }
});

// API: удалить шаблон
app.delete('/api/notification-templates/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM notification_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка удаления шаблона' });
  }
});
// --- Аудит-логика: отслеживание действий пользователей и администраторов ---
db.run(`CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

function logAudit(userId, action, details) {
  db.run('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)', [userId, action, details]);
}

// Пример использования: логировать вход пользователя
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // ...existing code...
  if (username === 'admin' && password === 'admin') {
    const user = { username, role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '2h' });
    logAudit(username, 'login', 'Успешный вход');
    res.json({ token });
  } else {
    logAudit(username, 'login_failed', 'Ошибка входа');
    res.status(401).json({ error: 'Неверные данные' });
  }
});

// API: получить аудит-историю пользователя
app.get('/api/audit/user/:userId', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.params.userId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка аудита' });
  }
});
// --- AI-аналитика: рекомендации и прогнозы ---
// Пример: простая генерация рекомендаций на основе истории уведомлений
app.get('/api/notifications/ai-recommend/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // Получить историю уведомлений пользователя
    const history = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);
    // Примитивная логика: если много "warning" или "error" — рекомендовать повысить внимание
    const warnCount = history.filter(n => n.type === 'warning').length;
    const errorCount = history.filter(n => n.type === 'error').length;
    let recommendation = 'Всё нормально.';
    if (errorCount > 3) recommendation = 'Рекомендуем срочно проверить ошибки.';
    else if (warnCount > 5) recommendation = 'Обратите внимание на предупреждения.';
    // Прогноз: если много новых уведомлений — ожидается высокая активность
    const newCount = history.filter(n => n.status === 'new').length;
    let forecast = 'Активность стабильна.';
    if (newCount > 10) forecast = 'Ожидается высокая активность.';
    res.json({ recommendation, forecast, stats: { warnCount, errorCount, newCount } });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка AI-аналитики' });
  }
});
// --- Push-уведомления для мобильных клиентов ---
app.post('/api/mobile/push', async (req, res) => {
  const { userId, title, message } = req.body;
  // TODO: интеграция с push-сервисом (Firebase, OneSignal и др.)
  // Пример заглушки
  res.json({ success: true, info: `Push-уведомление для ${userId} отправлено (заглушка)` });
});
// --- Интеграции: Viber, WhatsApp, BI-системы ---
// Viber
app.post('/api/integration/viber', async (req, res) => {
  const { userId, message } = req.body;
  // TODO: интеграция с Viber API
  // Пример заглушки
  res.json({ success: true, info: `Сообщение для ${userId} отправлено в Viber (заглушка)` });
});

// WhatsApp
app.post('/api/integration/whatsapp', async (req, res) => {
  const { userId, message } = req.body;
  // TODO: интеграция с WhatsApp API
  // Пример заглушки
  res.json({ success: true, info: `Сообщение для ${userId} отправлено в WhatsApp (заглушка)` });
});

// BI-системы
app.post('/api/integration/bi', async (req, res) => {
  const { data } = req.body;
  // TODO: интеграция с внешней BI-системой
  // Пример заглушки
  res.json({ success: true, info: `Данные переданы в BI-систему (заглушка)` });
});
// --- Автоматизация: автоархивация уведомлений, автоочистка логов/ошибок ---
const ARCHIVE_DAYS = 90;
const CLEANUP_DAYS = 30;
const schedule = require('node-schedule');

// Архивация уведомлений старше ARCHIVE_DAYS
function archiveOldNotifications() {
  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.run('UPDATE notifications SET status = "archived" WHERE created_at < ? AND status != "archived"', [cutoff]);
}

// Очистка логов и ошибок старше CLEANUP_DAYS
function cleanupLogsAndErrors() {
  const cutoff = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.run('DELETE FROM logs WHERE created_at < ?', [cutoff]);
  db.run('DELETE FROM errors WHERE created_at < ?', [cutoff]);
}

// Планировщик: ежедневно в 03:00
schedule.scheduleJob('0 3 * * *', () => {
  archiveOldNotifications();
  cleanupLogsAndErrors();
});

// API: ручной запуск автоархивации и очистки
app.post('/api/automation/archive', (req, res) => {
  archiveOldNotifications();
  res.json({ success: true });
});
app.post('/api/automation/cleanup', (req, res) => {
  cleanupLogsAndErrors();
  res.json({ success: true });
});
// --- Аналитика: отчёты по сегментам, графики активности и отклика ---
// Сегменты пользователей по статусу, активности, роли
app.get('/api/analytics/segments', async (req, res) => {
  try {
    const segments = await db.all(`SELECT status, COUNT(*) as count FROM notifications GROUP BY status`);
    const roles = await db.all(`SELECT role, COUNT(*) as count FROM users GROUP BY role`);
    res.json({ segments, roles });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// График активности: уведомления по дням
app.get('/api/analytics/activity', async (req, res) => {
  try {
    const activity = await db.all(`SELECT DATE(created_at) as day, COUNT(*) as count FROM notifications GROUP BY day ORDER BY day DESC LIMIT 30`);
    res.json({ activity });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// График отклика: количество прочитанных/откликнувшихся
app.get('/api/analytics/response', async (req, res) => {
  try {
    const response = await db.all(`SELECT status, COUNT(*) as count FROM notifications WHERE status IN ('read','clicked') GROUP BY status`);
    res.json({ response });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// --- JWT-аутентификация: безопасность API ---
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Недействительный токен' });
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Требуется авторизация' });
  }
}

// Пример: выдача токена (логин)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Примитивная проверка, заменить на реальную
  if (username === 'admin' && password === 'admin') {
    const user = { username, role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Неверные данные' });
  }
});

// Ограничить доступ к чувствительным маршрутам
app.use('/api/notifications', authenticateJWT);
app.use('/api/integration/webhook', authenticateJWT);
app.use('/api/report/email', authenticateJWT);
// --- Swagger/OpenAPI и справка: backend ---
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stream AI Bot API',
      version: '1.0.0',
      description: 'Документация API для Stream AI Bot'
    },
    servers: [{ url: '/' }]
  },
  apis: ['./server.js']
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// --- Мониторинг и health-check: backend API ---
const os = require('os');
let serverStart = Date.now();

app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await db.get('SELECT 1');
  } catch (e) {
    dbStatus = 'error';
  }
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - serverStart) / 1000),
    db: dbStatus,
    memory: process.memoryUsage(),
    load: os.loadavg(),
    timestamp: new Date().toISOString()
  });
});

// Пример метрик: количество уведомлений, ошибок, пользователей
app.get('/api/monitoring', async (req, res) => {
  try {
    const notifCount = await db.get('SELECT COUNT(*) as count FROM notifications');
    const userCount = await db.get('SELECT COUNT(DISTINCT user_id) as count FROM notifications');
    const errorCount = await db.get('SELECT COUNT(*) as count FROM errors');
    res.json({
      notifications: notifCount.count,
      users: userCount.count,
      errors: errorCount.count,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// --- Email отчёты: backend API ---
const nodemailer = require('nodemailer');

db.run(`CREATE TABLE IF NOT EXISTS email_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  subject TEXT,
  body TEXT,
  status TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API: отправить отчёт на email
app.post('/api/report/email', async (req, res) => {
  const { email, subject, body } = req.body;
  if (!email || !subject || !body) return res.status(400).json({ error: 'Заполните все поля' });
  let status = 'sent', error = '';
  try {
    // Настройка SMTP (пример: Gmail, заменить на свой)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html: body
    });
  } catch (e) {
    status = 'error';
    error = e.message;
  }
  await db.run('INSERT INTO email_reports (email, subject, body, status, error) VALUES (?, ?, ?, ?, ?)', [email, subject, body, status, error]);
  res.json({ success: status === 'sent', error });
});

// API: история отправок email-отчётов
app.get('/api/report/email/history', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM email_reports ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// --- Планировщик уведомлений: backend API и задачи ---
const schedule = require('node-schedule');

// Таблица для задач планировщика
db.run(`CREATE TABLE IF NOT EXISTS notification_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  message TEXT,
  user_id TEXT,
  cron TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API: получить все задачи планировщика
app.get('/api/scheduler', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM notification_schedule ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: создать задачу планировщика
app.post('/api/scheduler', async (req, res) => {
  try {
    const { title, message, user_id, cron } = req.body;
    if (!title || !message || !cron) return res.status(400).json({ error: 'Заполните все поля' });
    await db.run('INSERT INTO notification_schedule (title, message, user_id, cron) VALUES (?, ?, ?, ?)', [title, message, user_id || '', cron]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: удалить задачу планировщика
app.delete('/api/scheduler/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM notification_schedule WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск задач планировщика
async function startScheduler() {
  const jobs = await db.all('SELECT * FROM notification_schedule WHERE status = "active"');
  jobs.forEach(job => {
    schedule.scheduleJob(job.cron, async () => {
      await db.run('INSERT INTO notifications (title, message, user_id, status, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [job.title, job.message, job.user_id, 'scheduled']);
    });
  });
}
startScheduler();
// --- API для мобильных приложений: выдача уведомлений ---
app.get('/api/mobile/notifications', async (req, res) => {
  try {
    const userId = req.query.userId;
    const status = req.query.status;
    let sql = 'SELECT * FROM notifications';
    const params = [];
    if (userId || status) {
      sql += ' WHERE ';
      if (userId) {
        sql += 'user_id = ?';
        params.push(userId);
      }
      if (userId && status) sql += ' AND ';
      if (status) {
        sql += 'status = ?';
        params.push(status);
      }
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// --- API: Webhook для внешних систем (Slack, Teams) ---
app.post('/api/integration/webhook', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const { type, url } = req.body;
  // Сохранить webhook в БД
  await db.run('INSERT OR REPLACE INTO webhooks (type, url) VALUES (?, ?)', [type, url]);
  res.json({ success: true });
}));

app.get('/api/integration/webhook', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT * FROM webhooks');
  res.json({ webhooks: rows });
}));

// Пример отправки события в Slack/Teams
async function sendWebhookEvent(type, message) {
  const row = await db.get('SELECT url FROM webhooks WHERE type=?', [type]);
  if (row && row.url) {
    await fetch(row.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  }
}
// --- API: AI-тренды и прогнозы оттока ---
app.get('/api/analytics/trends', rbacManager.requirePermission(PERMISSIONS.VIEW_ANALYTICS), asyncHandler(async (req, res) => {
  // Пример: тренды по каналам и сегментам
  const trends = [
    { channel: 'Email', segment: 'VIP', trend: 'Рост отклика', value: '+12%', period: '7 дней' },
    { channel: 'Telegram', segment: 'Inactive', trend: 'Снижение активности', value: '-8%', period: '7 дней' },
    { channel: 'Push', segment: 'New Users', trend: 'Стабильный рост', value: '+5%', period: '7 дней' }
  ];
  res.json({ trends });
}));

app.get('/api/analytics/churn', rbacManager.requirePermission(PERMISSIONS.VIEW_ANALYTICS), asyncHandler(async (req, res) => {
  // Пример: прогноз оттока по сегментам
  const churn = [
    { segment: 'VIP', forecast: '3% пользователей могут уйти в течение месяца.' },
    { segment: 'New Users', forecast: '10% пользователей требуют дополнительной мотивации.' },
    { segment: 'Inactive', forecast: 'Отток выше нормы, требуется реактивация.' }
  ];
  res.json({ churn });
}));
// --- API: Персонализированные AI-рекомендации для сегментов ---
app.get('/api/notifications/ai-recommend/segment', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { segment } = req.query;
  // Пример: рекомендации для сегмента
  const recommendations = {
    VIP: [
      { type: 'Рекомендация', text: 'Используйте персонализированные email-рассылки для VIP.' },
      { type: 'Оптимизация', text: 'Увеличьте частоту push-уведомлений.' }
    ],
    'New Users': [
      { type: 'Рекомендация', text: 'Приветственное сообщение в Telegram увеличивает конверсию.' },
      { type: 'Аналитика', text: 'A/B тестирование показало рост отклика на 10%.' }
    ],
    Inactive: [
      { type: 'Рекомендация', text: 'Реактивируйте пользователей через Discord.' },
      { type: 'Аналитика', text: 'Сегмент требует дополнительной мотивации.' }
    ]
  };
  res.json({ recommendations: recommendations[segment] || [] });
}));
// --- API: Логирование подозрительных действий и интеграция с SIEM ---
app.post('/api/audit/suspicious', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const { user_id, action, details } = req.body;
  // Логировать подозрительное действие в БД
  await db.run('INSERT INTO suspicious_actions (user_id, action, details, created_at) VALUES (?, ?, ?, ?)', [user_id, action, details, new Date().toISOString()]);
  // Интеграция с SIEM (пример: отправка webhook)
  // await fetch('https://siem.example.com/webhook', { method: 'POST', body: JSON.stringify({ user_id, action, details }) });
  res.json({ success: true });
}));

app.get('/api/audit/suspicious', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT * FROM suspicious_actions ORDER BY created_at DESC LIMIT 100');
  res.json({ actions: rows });
}));
// --- API: Двухфакторная аутентификация для админов ---
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Генерация секрета и QR для 2FA
app.get('/api/auth/2fa/setup', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const secret = speakeasy.generateSecret({ name: 'StreamAI Admin' });
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  // Сохранить secret для пользователя (пример: req.user.id)
  // await db.run('UPDATE users SET twofa_secret=? WHERE id=?', [secret.base32, req.user.id]);
  res.json({ secret: secret.base32, qr });
}));

// Проверка 2FA-кода
app.post('/api/auth/2fa/verify', rbacManager.requireAdmin, asyncHandler(async (req, res) => {
  const { token } = req.body;
  // Получить secret пользователя (пример: req.user.id)
  // const row = await db.get('SELECT twofa_secret FROM users WHERE id=?', [req.user.id]);
  // const secret = row?.twofa_secret;
  const secret = 'JBSWY3DPEHPK3PXP'; // пример, заменить на реальный
  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });
  res.json({ success: verified });
}));
// --- API: FAQ для поддержки пользователей ---
app.get('/api/support/faq', asyncHandler(async (req, res) => {
  // Пример: статический FAQ
  const faq = [
    { q: 'Как добавить новый шаблон уведомления?', a: 'Перейдите в раздел шаблонов и используйте кнопку "Добавить".' },
    { q: 'Как настроить интеграцию с Telegram?', a: 'В разделе интеграций выберите Telegram и следуйте инструкции.' },
    { q: 'Как получить BI-отчёты?', a: 'BI-отчёты доступны в соответствующем разделе dashboard.' }
  ];
  res.json({ faq });
}));

// --- API: Обратная связь от пользователя ---
app.post('/api/support/feedback', asyncHandler(async (req, res) => {
  const { text } = req.body;
  // Пример: логировать отзыв, можно добавить запись в БД или отправку на email
  if (!text || typeof text !== 'string') return res.json({ success: false });
  console.log('Feedback:', text);
  res.json({ success: true });
}));
// --- API: BI-отчёты с фильтрами ---
app.get('/api/bi/reports', rbacManager.requirePermission(PERMISSIONS.VIEW_ANALYTICS), asyncHandler(async (req, res) => {
  const { channel, segment } = req.query;
  // Пример: фильтрация отчётов
  let reports = [
    { channel: 'Email', segment: 'VIP', stats: 'Отклик 18%', date: '2025-09-19' },
    { channel: 'Telegram', segment: 'New Users', stats: 'Отклик 12%', date: '2025-09-18' },
    { channel: 'Discord', segment: 'Inactive', stats: 'Отклик 7%', date: '2025-09-17' },
    { channel: 'Push', segment: 'VIP', stats: 'Отклик 15%', date: '2025-09-16' }
  ];
  if (channel) reports = reports.filter(r => r.channel === channel);
  if (segment) reports = reports.filter(r => r.segment === segment);
  res.json({ reports });
}));

// --- API: Экспорт BI-отчётов ---
app.get('/api/bi/export', rbacManager.requirePermission(PERMISSIONS.EXPORT_DATA), asyncHandler(async (req, res) => {
  const { channel, segment } = req.query;
  let reports = [
    { channel: 'Email', segment: 'VIP', stats: 'Отклик 18%', date: '2025-09-19' },
    { channel: 'Telegram', segment: 'New Users', stats: 'Отклик 12%', date: '2025-09-18' },
    { channel: 'Discord', segment: 'Inactive', stats: 'Отклик 7%', date: '2025-09-17' },
    { channel: 'Push', segment: 'VIP', stats: 'Отклик 15%', date: '2025-09-16' }
  ];
  if (channel) reports = reports.filter(r => r.channel === channel);
  if (segment) reports = reports.filter(r => r.segment === segment);
  const json = JSON.stringify(reports, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="bi_reports.json"');
  res.send(json);
}));
// --- API: Получение A/B отчётов для рассылок ---
app.get('/api/notifications/ab-reports', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: отчёты по сегментам
  const reports = [
    { segment: 'VIP', result: 'Вариант B показал лучший отклик (+15%)', date: '2025-09-19' },
    { segment: 'New Users', result: 'Вариант A эффективнее (+8%)', date: '2025-09-18' },
    { segment: 'Inactive', result: 'Оба варианта равны', date: '2025-09-17' }
  ];
  res.json({ reports });
}));

// --- API: AI-оптимизация рассылок ---
app.get('/api/notifications/ai-optimize', rbacManager.requirePermission(PERMISSIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: рекомендация по оптимизации
  res.json({ success: true, recommendation: 'Рекомендуется использовать вариант B для сегмента VIP и увеличить частоту рассылок для новых пользователей.' });
}));
// --- API: Экспорт данных для CRM/ERP ---
app.get('/api/integration/export', rbacManager.requirePermission(PERMISSIONS.EXPORT_DATA), asyncHandler(async (req, res) => {
  // Пример: экспортировать все шаблоны и сегменты
  const templates = await db.all('SELECT * FROM templates');
  const segments = await db.all('SELECT * FROM segments');
  const data = { templates, segments };
  const json = JSON.stringify(data, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="exported_data.json"');
  res.send(json);
}));

// --- API: Импорт данных из CRM/ERP ---
const multer = require('multer');
const upload = multer();
app.post('/api/integration/import', rbacManager.requirePermission(PERMISSIONS.IMPORT_DATA), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.json({ success: false, error: 'Нет файла' });
    const data = JSON.parse(file.buffer.toString());
    // Импортировать шаблоны
    if (Array.isArray(data.templates)) {
      for (const tpl of data.templates) {
        await db.run('INSERT OR REPLACE INTO templates (id, name, content, order_index) VALUES (?, ?, ?, ?)', [tpl.id, tpl.name, tpl.content, tpl.order_index]);
      }
    }
    // Импортировать сегменты
    if (Array.isArray(data.segments)) {
      for (const seg of data.segments) {
        await db.run('INSERT OR REPLACE INTO segments (id, name, order_index) VALUES (?, ?, ?)', [seg.id, seg.name, seg.order_index]);
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
}));
// --- API: Получение уведомлений о событиях и ошибках ---
app.get('/api/notifications/events', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: события и ошибки
  const events = [
    { type: 'Email', text: 'Успешно отправлено 120 писем', created_at: '2025-09-20 10:12' },
    { type: 'Telegram', text: 'Ошибка доставки сообщения', created_at: '2025-09-20 10:15' },
    { type: 'Push', text: 'Push-уведомление отправлено 80 пользователям', created_at: '2025-09-20 10:18' },
    { type: 'Discord', text: 'Ошибка авторизации бота', created_at: '2025-09-20 10:20' }
  ];
  res.json({ events });
}));
// --- API: Получение AI-рекомендаций (GET для dashboard) ---
app.get('/api/notifications/ai-recommend', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: автоматические прогнозы, выявление аномалий, рекомендации
  const recommendations = [
    { type: 'Прогноз', text: 'Ожидается рост отклика в сегменте VIP на 12%.' },
    { type: 'Аномалия', text: 'Обнаружено снижение активности в канале Telegram.' },
    { type: 'Оптимизация', text: 'Рекомендуется увеличить частоту рассылок для новых пользователей.' },
    { type: 'Рекомендация', text: 'Используйте A/B тестирование для Push-уведомлений.' }
  ];
  res.json({ recommendations });
}));
// --- API: Корреляции для тепловой карты ---
app.get('/api/notifications/stats/correlations', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: вычислить корреляции между каналами и сегментами
  // matrix: двумерный массив корреляций, labels: названия каналов/сегментов
  const labels = ['Email', 'Telegram', 'Discord', 'Push'];
  const matrix = [
    [1, 0.6, 0.3, 0.2],
    [0.6, 1, 0.5, 0.4],
    [0.3, 0.5, 1, 0.7],
    [0.2, 0.4, 0.7, 1]
  ];
  res.json({ labels, matrix });
}));

// --- API: Граф связей каналов и сегментов ---
app.get('/api/notifications/stats/network', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Пример: nodes — каналы и сегменты, edges — связи между ними
  const nodes = [
    { id: 1, label: 'Email', group: 'channel' },
    { id: 2, label: 'Telegram', group: 'channel' },
    { id: 3, label: 'Discord', group: 'channel' },
    { id: 4, label: 'Push', group: 'channel' },
    { id: 101, label: 'VIP', group: 'segment' },
    { id: 102, label: 'New Users', group: 'segment' },
    { id: 103, label: 'Inactive', group: 'segment' }
  ];
  const edges = [
    { from: 1, to: 101 },
    { from: 2, to: 102 },
    { from: 3, to: 103 },
    { from: 4, to: 101 },
    { from: 2, to: 101 },
    { from: 3, to: 102 }
  ];
  res.json({ nodes, edges });
}));
// --- API: Получение списка сегментов для drag-and-drop редактора ---
app.get('/api/notifications/segments', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT id, name FROM segments ORDER BY order_index ASC');
  res.json(rows);
}));

// --- API: Сохранение порядка шаблонов и сегментов после drag-and-drop ---
app.post('/api/notifications/templates/reorder', rbacManager.requirePermission(PERMISSIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { templateOrder, segmentOrder } = req.body;
  if (Array.isArray(templateOrder)) {
    for (let i = 0; i < templateOrder.length; i++) {
      await db.run('UPDATE templates SET order_index = ? WHERE id = ?', [i, templateOrder[i]]);
    }
  }
  if (Array.isArray(segmentOrder)) {
    for (let i = 0; i < segmentOrder.length; i++) {
      await db.run('UPDATE segments SET order_index = ? WHERE id = ?', [i, segmentOrder[i]]);
    }
  }
  res.json({ success: true });
}));
// --- API: аудит действий пользователей ---
app.get('/api/audit/history', rbacManager.requirePermission(PERMISSIONS.VIEW_SYSTEM), asyncHandler(async (req, res) => {
  // Пример: получить историю аудита из БД
  const rows = await require('./db').query('SELECT user_id, action, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT 100');
  res.json({ history: rows });
}));
// --- API: AI-прогнозы и рекомендации по рассылкам ---
app.post('/api/notifications/ai-recommend', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { segment, channel, template, stats } = req.body;
  // Пример: вызов AI-модели (OpenAI, локально, etc)
  // Здесь можно использовать ML/AI для прогноза и рекомендаций
  // Для примера — простая логика
  let recommendation = 'Рекомендуется использовать канал с наибольшей конверсией.';
  let predictedConversion = Math.random() * 100;
  // TODO: интеграция с реальной AI-моделью
  if (stats && stats.length) {
    const best = stats.reduce((a, b) => (a.conversion > b.conversion ? a : b));
    recommendation = `Лучший канал: ${best.channel}, ожидаемая конверсия: ${best.conversion}%`;
    predictedConversion = best.conversion;
  }
  res.json({ recommendation, predictedConversion });
}));
// --- API: получить текущего пользователя и его роль/права ---
app.get('/api/rbac/users/me', asyncHandler(async (req, res) => {
  // req.user должен быть установлен после аутентификации
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await require('./db').query('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!user[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: {
    id: user[0].id,
    username: user[0].username,
    role: rbacManager.getUserRole(user[0].id),
    permissions: rbacManager.getUserPermissions(user[0].id)
  }});
}));
// --- API для управления ролями и правами пользователей (RBAC) ---
const { rbacManager, ROLES, PERMISSIONS } = require('./rbac');

// Получить список всех пользователей и их ролей
app.get('/api/rbac/users', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  // Пример: получить из БД
  const users = await require('./db').query('SELECT id, username FROM users');
  const result = users.map(u => ({
    id: u.id,
    username: u.username,
    role: rbacManager.getUserRole(u.id),
    permissions: rbacManager.getUserPermissions(u.id)
  }));
  res.json({ users: result });
}));

// Назначить роль пользователю
app.post('/api/rbac/assign-role', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId, role } = req.body;
  rbacManager.assignRole(userId, role);
  res.json({ ok: true });
}));

// Добавить разрешение пользователю
app.post('/api/rbac/add-permission', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId, permission } = req.body;
  rbacManager.addUserPermission(userId, permission);
  res.json({ ok: true });
}));

// Удалить разрешение у пользователя
app.post('/api/rbac/remove-permission', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId, permission } = req.body;
  rbacManager.removeUserPermission(userId, permission);
  res.json({ ok: true });
}));

// Получить список всех ролей и разрешений
app.get('/api/rbac/roles', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  res.json({ roles: ROLES, permissions: PERMISSIONS });
}));
// ...existing code...
const http = require('http');
const { initWebSocket, broadcastAnalyticsUpdate } = require('./ws-server');
// ...existing code...
// ...existing code...
const server = http.createServer(app);
initWebSocket(server);
server.listen(PORT, () => {
  logger.logWithContext('info', `Server started on port ${PORT}`, {
    event: 'server_start'
  });
});
// --- API для A/B тестирования уведомлений ---
app.post('/api/notifications/abtest/start', rbacManager.requirePermission(PERMISSIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { testName, variants, userSegment } = req.body;
  // Сохраняем тест в БД (упрощённо)
  await require('./db').query(
    `INSERT INTO ab_tests (test_name, variants, user_segment, started_at) VALUES (?, ?, ?, ?)`,
    [testName, JSON.stringify(variants), JSON.stringify(userSegment), new Date().toISOString()]
  );
  res.json({ ok: true });
}));

app.get('/api/notifications/abtest/results/:testName', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { testName } = req.params;
  // Получить результаты по каждому варианту
  const sql = `SELECT variant, COUNT(*) as sent, COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened, COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked FROM ab_test_results WHERE test_name = ? GROUP BY variant`;
  const rows = await require('./db').query(sql, [testName]);
  res.json({ results: rows });
}));
// --- Экспорт статистики для BI/аналитических систем ---
const { Parser } = require('json2csv');
app.get('/api/notifications/stats/export', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { format = 'csv', from, to } = req.query;
  let where = [];
  let params = [];
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT * FROM notification_history ${whereSql} ORDER BY created_at DESC`;
  const rows = await require('./db').query(sql, params);
  if (format === 'json') {
    res.header('Content-Type', 'application/json');
    res.send(JSON.stringify(rows));
  } else {
    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('notification_stats.csv');
    res.send(csv);
  }
}));
// --- История изменений шаблонов уведомлений ---
app.get('/api/notifications/templates/history/:name', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { name } = req.params;
  const sql = `SELECT version, updated_at, updated_by, changes FROM notification_template_history WHERE template_name = ? ORDER BY version DESC`;
  const rows = await require('./db').query(sql, [name]);
  res.json({ history: rows });
}));
// --- Анализ причин ошибок и неудачных рассылок ---
app.get('/api/notifications/failures/analyze', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Анализируем ошибки и неудачные рассылки по истории
  const sql = `SELECT channel, status, COUNT(*) as count, MIN(created_at) as first, MAX(created_at) as last FROM notification_history WHERE status IN ('error','failed','undelivered') GROUP BY channel, status ORDER BY count DESC`;
  const rows = await require('./db').query(sql, []);
  // Автоматические рекомендации
  const recommendations = [];
  rows.forEach(r => {
    if (r.channel === 'email' && r.status === 'undelivered') recommendations.push('Проверьте корректность email-адресов и настройки SMTP.');
    if (r.channel === 'telegram' && r.status === 'error') recommendations.push('Проверьте токен Telegram-бота и права доступа.');
    if (r.channel === 'discord' && r.status === 'error') recommendations.push('Проверьте токен Discord-бота и права доступа к каналу.');
    if (r.status === 'failed') recommendations.push('Проверьте логи сервера и сетевое соединение.');
  });
  res.json({ failures: rows, recommendations });
}));
// --- Формирование и отправка расширенного отчёта (PDF, email, Telegram) ---
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
app.post('/api/notifications/report', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { email, telegramChatId, stats, summary } = req.body;
  // PDF генерация
  const doc = new PDFDocument();
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', async () => {
    const pdfData = Buffer.concat(buffers);
    // Email отправка
    if (email && process.env.SMTP_HOST) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: 'AI-отчёт по рассылкам',
          text: summary,
          attachments: [{ filename: 'report.pdf', content: pdfData }]
        });
      } catch (e) { /* логировать ошибку */ }
    }
    // Telegram отправка (если настроено)
    if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const fetch = require('node-fetch');
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: JSON.stringify({ chat_id: telegramChatId, document: pdfData.toString('base64'), caption: summary }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) { /* логировать ошибку */ }
    }
    res.json({ ok: true });
  });
  // PDF контент
  doc.fontSize(18).text('AI-отчёт по рассылкам', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(summary);
  doc.moveDown();
  doc.text('Статистика:', { underline: true });
  if (Array.isArray(stats)) {
    stats.forEach(s => {
      doc.text(`Шаблон: ${s.template}, Канал: ${s.channel}, Отправлено: ${s.sent}, Открыто: ${s.opened}, Клики: ${s.clicked}, CTR: ${(s.ctr*100).toFixed(1)}%`);
    });
  }
  doc.end();
}));
// --- AI-предсказания и гипотезы по рассылкам ---
app.post('/api/notifications/ai-predict', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { template, channel, stats } = req.body;
  // Простая эвристика: если CTR < 10% — рекомендация улучшить CTA, если > 25% — успех
  let prediction = '';
  let hypothesis = '';
  if (stats && typeof stats.ctr === 'number') {
    if (stats.ctr < 0.1) prediction = 'Ожидается низкая кликабельность. Рекомендуется улучшить call-to-action.';
    else if (stats.ctr > 0.25) prediction = 'Ожидается высокая кликабельность. Шаблон эффективен.';
    else prediction = 'Ожидается средняя кликабельность.';
  }
  // Hook для внешнего AI (OpenAI)
  let aiHypothesis = '';
  if (process.env.OPENAI_API_KEY && stats) {
    try {
      const fetch = require('node-fetch');
      const prompt = `Дай краткую гипотезу по эффективности рассылки: шаблон "${template}", канал "${channel}", статистика: ${JSON.stringify(stats)}`;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        })
      });
      const json = await resp.json();
      aiHypothesis = json.choices?.[0]?.message?.content || '';
    } catch (e) {
      aiHypothesis = 'AI-гипотеза недоступна.';
    }
  }
  res.json({ prediction, hypothesis, aiHypothesis });
}));
// --- Статистика по каналам доставки ---
app.get('/api/notifications/stats/channels', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let where = [];
  let params = [];
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `
    SELECT channel,
      COUNT(*) as sent,
      COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened,
      COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked
    FROM notification_history
    ${whereSql}
    GROUP BY channel
    ORDER BY sent DESC
  `;
  const result = await require('./db').query(sql, params);
  const stats = result.map(row => ({
    channel: row.channel,
    sent: Number(row.sent),
    opened: Number(row.opened),
    clicked: Number(row.clicked),
    conversion: row.sent > 0 ? (row.opened / row.sent) : 0,
    ctr: row.sent > 0 ? (row.clicked / row.sent) : 0
  }));
  res.json({ stats });
}));
// --- Сегментированная статистика уведомлений ---
app.get('/api/notifications/stats/segmented', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { userId, role, user_group, channel, from, to } = req.query;
  let where = [];
  let params = [];
  if (userId) { where.push('user_id = ?'); params.push(userId); }
  if (role) { where.push('role = ?'); params.push(role); }
  if (user_group) { where.push('user_group = ?'); params.push(user_group); }
  if (channel) { where.push('channel = ?'); params.push(channel); }
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `
    SELECT user_id, role, user_group, channel, template_name, category,
      COUNT(*) as sent,
      COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened,
      COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked,
      MIN(created_at) as first_sent,
      MAX(created_at) as last_sent
    FROM notification_history
    ${whereSql}
    GROUP BY user_id, role, user_group, channel, template_name, category
    ORDER BY user_id, template_name
  `;
  const result = await require('./db').query(sql, params);
  const stats = result.map(row => ({
    user_id: row.user_id,
    role: row.role,
    user_group: row.user_group,
    channel: row.channel,
    template: row.template_name,
    category: row.category,
    sent: Number(row.sent),
    opened: Number(row.opened),
    clicked: Number(row.clicked),
    conversion: row.sent > 0 ? (row.opened / row.sent) : 0,
    ctr: row.sent > 0 ? (row.clicked / row.sent) : 0,
    first_sent: row.first_sent,
    last_sent: row.last_sent
  }));
  res.json({ stats });
}));
// --- Аналитика по истории AI-отчётов ---
app.get('/api/ai-report/history/stats', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  // Количество отчётов по дням, успешность, динамика
  const sql = `
    SELECT 
      DATE(created_at) as day,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
    FROM ai_report_history
    GROUP BY day
    ORDER BY day DESC
    LIMIT 30
  `;
  const rows = await require('./db').query(sql, []);
  // Общая статистика
  const totalSql = `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error FROM ai_report_history`;
  const [totalStats] = await require('./db').query(totalSql, []);
  res.json({
    daily: rows,
    total: totalStats
  });
}));
// --- История AI-отчётов: фильтры и экспорт ---
const { Parser } = require('json2csv');

// Получить историю AI-отчётов с фильтрами
app.get('/api/ai-report/history', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { from, to, email, status } = req.query;
  let where = [];
  let params = [];
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  if (email) { where.push('email LIKE ?'); params.push(`%${email}%`); }
  if (status) { where.push('status = ?'); params.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT id, created_at, email, status, summary FROM ai_report_history ${whereSql} ORDER BY created_at DESC`;
  const rows = await require('./db').query(sql, params);
  res.json({ history: rows });
}));

// Экспорт истории AI-отчётов в CSV
app.get('/api/ai-report/history/export', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { from, to, email, status } = req.query;
  let where = [];
  let params = [];
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }
  if (email) { where.push('email LIKE ?'); params.push(`%${email}%`); }
  if (status) { where.push('status = ?'); params.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT id, created_at, email, status, summary FROM ai_report_history ${whereSql} ORDER BY created_at DESC`;
  const rows = await require('./db').query(sql, params);
  const parser = new Parser({ fields: ['id', 'created_at', 'email', 'status', 'summary'] });
  const csv = parser.parse(rows);
  res.header('Content-Type', 'text/csv');
  res.attachment('ai_report_history.csv');
  res.send(csv);
}));
// --- Google Analytics Measurement Protocol ---
const fetch = require('node-fetch');
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;
async function sendAnalyticsEvent(eventName, eventParams = {}) {
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) return;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;
  const body = {
    client_id: 'stream-ai-bot',
    events: [
      {
        name: eventName,
        params: eventParams
      }
    ]
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('GA event error:', e);
  }
}
// --- Notification Statistics API ---
app.get('/api/notifications/stats', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { template, userId, from, to } = req.query;
  let where = [];
  let params = [];
  if (template) { where.push('template_name = $' + (params.length + 1)); params.push(template); }
  if (userId) { where.push('user_id = $' + (params.length + 1)); params.push(userId); }
  if (from) { where.push('created_at >= $' + (params.length + 1)); params.push(from); }
  if (to) { where.push('created_at <= $' + (params.length + 1)); params.push(to); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  // Группировка по шаблону
  const sql = `
    SELECT template_name,
      COUNT(*) as sent,
      COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened,
      COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked,
      MIN(created_at) as first_sent,
      MAX(created_at) as last_sent
    FROM notification_history
    ${whereSql}
    GROUP BY template_name
    ORDER BY template_name
  `;
  const result = await require('./db').query(sql, params);
  // Конверсия = opened/sent, CTR = clicked/sent
  const stats = result.map(row => ({
    template: row.template_name,
    sent: Number(row.sent),
    opened: Number(row.opened),
    clicked: Number(row.clicked),
    conversion: row.sent > 0 ? (row.opened / row.sent) : 0,
    ctr: row.sent > 0 ? (row.clicked / row.sent) : 0,
    first_sent: row.first_sent,
    last_sent: row.last_sent
  }));
  res.json({ stats });
}));
// --- Notification Templates API ---
const customNotificationManager = new CustomNotificationManager(notificationManager);
const { notificationSchemas } = require('./validation');

// Получить список шаблонов
app.get('/api/notifications/templates', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const templates = await customNotificationManager.listTemplates();
  res.json({ templates });
}));

// Получить шаблон по имени
app.get('/api/notifications/templates/:name', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const template = await customNotificationManager.getTemplate(req.params.name);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json({ template });
}));

// Создать или обновить шаблон
app.post('/api/notifications/templates', rbacManager.requirePermission(PERMISSIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const { error } = notificationSchemas.template.validate(req.body);
  if (error) return res.status(400).json({ error: error.details.map(e => e.message).join(', ') });
  // Получить предыдущую версию шаблона
  const prev = await customNotificationManager.getTemplate(req.body.name);
  const saved = await customNotificationManager.saveTemplate(req.body);
  // Сохраняем историю изменений
  if (prev) {
    const changes = JSON.stringify({ before: prev, after: req.body });
    await require('./db').query(
      `INSERT INTO notification_template_history (template_name, version, updated_at, updated_by, changes) VALUES (?, ?, ?, ?, ?)`,
      [req.body.name, (prev.version || 1) + 1, new Date().toISOString(), req.user?.id || 'system', changes]
    );
  }
  res.json({ template: saved });
}));

// Удалить шаблон
app.delete('/api/notifications/templates/:name', rbacManager.requirePermission(PERMISSIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  await customNotificationManager.deleteTemplate(req.params.name);
  res.json({ success: true });
}));
const Sentry = require('@sentry/node');
const DiscordBot = require('./discord-bot');
const TelegramBot = require('./telegram-bot');
const CustomNotificationManager = require('./custom-notifications');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
Sentry.init({
  dsn: process.env.SENTRY_DSN || '', // Укажите DSN через переменную окружения
  tracesSampleRate: 1.0,
});

// --- Discord Integration ---
const discordBot = process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID ? 
  new DiscordBot(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_CHANNEL_ID) : null;

// Инициализируем Telegram бота
const telegramBot = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ?
  new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID) : null;

if (telegramBot) {
  telegramBot.start().catch(error => {
    logger.logError(error, { event: 'telegram_bot_error' });
  });
}

if (discordBot) {
  discordBot.start().then(() => {
    logger.logWithContext('info', 'Discord bot connected', { event: 'discord_bot_start' });
    
    // Перехватываем отправку уведомлений и отправляем в подключенные платформы
    const origSendNotification = notificationManager.sendNotification.bind(notificationManager);
    notificationManager.sendNotification = async function(userId, notification) {
      const notif = origSendNotification(userId, notification);
      
      // Отправляем в Discord если это важное уведомление
      if (notification.important) {
        // Отправляем в Discord
        if (discordBot) {
          try {
            await discordBot.sendMessage(`🔔 New notification for ${userId}:\n${notification.title}\n${notification.message}`);
          } catch (error) {
            logger.logError(error, { event: 'discord_notification_error' });
          }
        }
        
        // Отправляем в Telegram
        if (telegramBot) {
          try {
            await telegramBot.sendMessage(`🔔 <b>New notification for ${userId}</b>\n\n<b>${notification.title}</b>\n${notification.message}`);
          } catch (error) {
            logger.logError(error, { event: 'telegram_notification_error' });
          }
        }
      }
      
      return notif;
    };
  }).catch(error => {
    logger.logError(error, { event: 'discord_bot_error' });
  });
}

// --- OAuth/SSO ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'stream-ai-bot-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  // Здесь можно найти/создать пользователя в БД
  return done(null, profile);
}));

// GitHub OAuth strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || 'GITHUB_CLIENT_ID',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'GITHUB_CLIENT_SECRET',
  callbackURL: '/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  // Здесь можно найти/создать пользователя в БД
  return done(null, profile);
}));

// OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  // Можно выдать JWT или редиректить в dashboard сессией
  res.redirect('/');
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
  // Можно выдать JWT или редиректить в dashboard сессией
  res.redirect('/');
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.use(Sentry.Handlers.requestHandler());
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./openapi');
// Swagger UI endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// --- COMMANDS API ---
// Получить список команд с пагинацией и фильтрацией
app.get('/api/commands', rbacManager.requirePermission(PERMISSIONS.VIEW_COMMANDS), asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 100);
  const offset = (page - 1) * pageSize;
  const filters = [];
  const params = [];
  if (req.query.name) {
    filters.push('name LIKE ?');
    params.push(`%${req.query.name}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `SELECT name, payload FROM commands ${where} ORDER BY name LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as count FROM commands ${where}`;
  const commands = await require('./db').query(sql, [...params, pageSize, offset]);
  const countRes = await require('./db').query(countSql, params);
  const total = countRes[0]?.count || 0;
  res.json({
    commands,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  });
}));
// --- USERS API ---
// Получить список пользователей с пагинацией и фильтрацией
app.get('/api/users', rbacManager.requirePermission(PERMISSIONS.VIEW_USERS), asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 100);
  const offset = (page - 1) * pageSize;
  const filters = [];
  const params = [];
  if (req.query.username) {
    filters.push('username LIKE ?');
    params.push(`%${req.query.username}%`);
  }
  if (req.query.role) {
    filters.push('role = ?');
    params.push(req.query.role);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `SELECT id, username, email, role FROM users ${where} ORDER BY id LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as count FROM users ${where}`;
  const users = await require('./db').query(sql, [...params, pageSize, offset]);
  const countRes = await require('./db').query(countSql, params);
  const total = countRes[0]?.count || 0;
  res.json({
    users,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  });
}));
// --- RBAC API ---
// Получить роль пользователя
app.get('/api/rbac/role/:userId', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  res.json({ userId, role: rbacManager.getUserRole(userId) });
}));

// Назначить роль пользователю
app.post('/api/rbac/role/:userId', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  rbacManager.assignRole(userId, role);
  res.json({ userId, role });
}));

// Получить права пользователя
app.get('/api/rbac/permissions/:userId', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  res.json({ userId, permissions: rbacManager.getUserPermissions(userId) });
}));

// Добавить кастомное право пользователю
app.post('/api/rbac/permissions/:userId', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { permission } = req.body;
  rbacManager.addUserPermission(userId, permission);
  res.json({ userId, permission });
}));

// Удалить кастомное право пользователя
app.delete('/api/rbac/permissions/:userId', rbacManager.requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { permission } = req.body;
  rbacManager.removeUserPermission(userId, permission);
  res.json({ userId, permission, removed: true });
}));
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('./logger');
const notificationManager = require('./notifications');
const metrics = require('./metrics');
const { rbacManager, PERMISSIONS } = require('./rbac_new');
const webhookManager = require('./webhooks');
const logsApi = require('./logs_api');
// --- API для логов (dashboard monitoring) ---
app.use('/api/logs', logsApi);
// --- API для управления вебхуками ---
app.get('/api/webhooks', rbacManager.requirePermission(PERMISSIONS.VIEW_WEBHOOKS), asyncHandler(async (req, res) => {
  res.json({ webhooks: webhookManager.list() });
}));

app.post('/api/webhooks', rbacManager.requirePermission(PERMISSIONS.MANAGE_WEBHOOKS), asyncHandler(async (req, res) => {
  const { url, events, secret } = req.body;
  if (!url) throw new ValidationError('Webhook url required');
  const id = webhookManager.register({ url, events, secret });
  res.status(201).json({ id });
}));

app.delete('/api/webhooks/:id', rbacManager.requirePermission(PERMISSIONS.MANAGE_WEBHOOKS), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ok = webhookManager.unregister(id);
  if (!ok) return res.status(404).json({ error: 'Webhook not found' });
  res.json({ success: true });
}));
const { 
  errorHandler, 
  handleUncaughtException, 
  handleUnhandledRejection,
  asyncHandler,
  handleWebSocketError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('./errors');

// Обработка необработанных исключений
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const app = express();
// ...existing code...

// Базовая защита заголовков
app.use(helmet());

// Настройка CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  maxAge: 86400 // 24 часа кэширования preflight
};
app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Лимит 100 запросов с одного IP
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Middleware для логирования HTTP запросов и сбора метрик
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logger.logHttpRequest(req, res, responseTime);
    metrics.trackRequest(req, res, responseTime);
  });
  next();
});

// Парсинг JSON с лимитом размера
app.use(express.json({ limit: '10kb' }));


// Эндпоинты для работы с уведомлениями

// Предпросмотр шаблона уведомления
app.post('/api/notifications/preview', asyncHandler(async (req, res) => {
  try {
    const { template, parameters, options } = req.body;
    if (!template || !template.message) {
      return res.status(400).json({ error: 'Template with message required' });
    }
    // Для предпросмотра не требуется сохранение шаблона
    const TemplateProcessor = require('./template-processor');
    const processor = new TemplateProcessor();
    const result = await processor.processTemplate(template, parameters || {}, options || {});
    res.json({ result });
  } catch (error) {
    logger.logError(error, { event: 'notification_preview_error' });
    res.status(400).json({ error: error.message });
  }
}));

// Пагинация и фильтрация уведомлений
app.get('/api/notifications', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  let notifications = notificationManager.notifications.get(userId) || [];

  // Фильтрация по типу
  if (req.query.type) {
    notifications = notifications.filter(n => n.type === req.query.type);
  }
  // Фильтрация по статусу (прочитанные/непрочитанные)
  if (req.query.read === 'true') {
    notifications = notifications.filter(n => n.read === true);
  } else if (req.query.read === 'false') {
    notifications = notifications.filter(n => n.read === false);
  }

  // Пагинация
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 20, 100);
  const total = notifications.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = notifications.slice(start, end);

  res.json({
    notifications: items,
    page,
    pageSize,
    total,
    totalPages
  });
}));

app.post('/api/notifications/:id/read', rbacManager.requirePermission(PERMISSIONS.VIEW_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const success = notificationManager.markAsRead(userId, id);
  if (!success) {
    res.status(404).json({ error: 'Notification not found' });
  } else {
    res.json({ success: true });
  }
}));

// Интеграция: отправка события вебхука при новом уведомлении
const origSendNotification = notificationManager.sendNotification.bind(notificationManager);
notificationManager.sendNotification = function(userId, notification) {
  const notif = origSendNotification(userId, notification);
  webhookManager.trigger('notification', { userId, notification: notif });
  return notif;
};

// Метрики в формате JSON (для внутреннего использования)
app.get('/api/metrics', 
  rbacManager.requirePermission(PERMISSIONS.VIEW_METRICS),
  asyncHandler(async (req, res) => {
    const currentMetrics = metrics.collectMetrics();
    res.json(currentMetrics);
  })
);

// Метрики в формате Prometheus (для систем мониторинга)
app.get('/metrics', 
  rbacManager.requirePermission(PERMISSIONS.MANAGE_METRICS),
  asyncHandler(async (req, res) => {
    const prometheusMetrics = metrics.getPrometheusMetrics();
    res.type('text/plain').send(prometheusMetrics);
  })
);

// ...existing code...

// Запуск сервера
server.listen(PORT, () => {
  logger.logWithContext('info', `Server started on port ${PORT}`, {
    event: 'server_start'
  });
});

CREATE TABLE commands (
  name TEXT PRIMARY KEY,
  payload TEXT
);

DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id