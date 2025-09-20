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
  const saved = await customNotificationManager.saveTemplate(req.body);
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
const PORT = process.env.PORT || 3000;

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

// Создаем HTTP сервер
const server = http.createServer(app);

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Обработка WebSocket подключений
wss.on('connection', async (ws, req) => {
  try {
    // Начинаем отслеживать метрики WebSocket соединения
    metrics.trackWebSocketConnection(ws);

    // Здесь должна быть аутентификация WebSocket подключения
    // Для примера используем заголовок x-auth-token
    const token = req.headers['x-auth-token'];
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    // Здесь должна быть верификация токена и получение userId
    // Для примера просто используем token как userId
    const userId = token;

    // Регистрируем клиента для получения уведомлений
    notificationManager.registerClient(userId, ws);

    // Обработка сообщений от клиента
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'mark_read':
            if (message.notificationId) {
              notificationManager.markAsRead(userId, message.notificationId);
            }
            break;
          // Можно добавить другие типы сообщений
        }
      } catch (error) {
        logger.logError(error, {
          event: 'websocket_message_processing_error',
          userId
        });
      }
    });

    // Обработка ошибок WebSocket
    ws.on('error', (error) => {
      handleWebSocketError(error, ws);
    });

  } catch (error) {
    logger.logError(error, {
      event: 'websocket_connection_error'
    });
    ws.close(4000, 'Internal server error');
  }
});

// Периодическая проверка соединений
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Проверка каждые 30 секунд

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