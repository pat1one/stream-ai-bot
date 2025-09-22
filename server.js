// --- AI-генератор челленджей ---
async function generateChallenge(theme = 'стрим', lang = 'ru') {
  const apiKey = process.env.OPENAI_KEY;
  if (!apiKey) throw new Error('No OpenAI API key');
  const prompt = lang === 'ru'
    ? `Придумай уникальный челлендж для стримера или зрителей по теме: ${theme}. Кратко, весело, не повторяйся.`
    : `Come up with a unique challenge for a streamer or viewers on the topic: ${theme}. Be brief, fun, and original.`;
  const axios = require('axios');
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 60,
    temperature: 0.9
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content.trim();
}

// Команда !challenge <тема> (только премиум)
// ...existing code...
      // AI-генератор челленджей: !challenge <тема>
      if(ws.user && ws.user.premium && lower.startsWith('!challenge')) {
        const theme = txt.split(' ').slice(1).join(' ') || 'стрим';
        try {
          const challenge = await generateChallenge(theme, 'ru');
          ws.send(JSON.stringify({type:'reply', text:`[Челлендж]: ${challenge}`}));
        } catch(e) {
          ws.send(JSON.stringify({type:'error', text:'Ошибка генерации челленджа: ' + e.message}));
        }
        return;
      }
// API: сгенерировать челлендж (только премиум)
app.post('/api/challenge', checkToken, async (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  const { theme, lang } = req.body;
  try {
    const challenge = await generateChallenge(theme || 'стрим', lang || 'ru');
    res.json({challenge});
  } catch (e) {
    res.status(500).json({error:'challenge error', details: e.message});
  }
});
// API: получить хайлайты (только премиум)
app.get('/api/highlights', checkToken, (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  res.json(highlights);
});
// API: сбросить хайлайты (только премиум)
app.post('/api/highlights/reset', checkToken, (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  highlights = [];
  res.json({ok:true});
});
// --- Автоматический клипмейкер (AI хайлайты) ---
let highlights = [];
const HIGHLIGHT_WINDOW = 30; // секунд
const HIGHLIGHT_THRESHOLD = 10; // сообщений за окно
let recentMessages = [];

function addHighlight(reason) {
  const now = new Date();
  highlights.push({ time: now.toISOString(), reason });
  if (highlights.length > 100) highlights.shift();
  console.log('[HIGHLIGHT]', now.toLocaleTimeString(), reason);
}

function checkHighlightActivity(message, userstate) {
  const now = Date.now();
  recentMessages.push({ time: now, user: userstate.username, text: message });
  // Удаляем старые сообщения
  recentMessages = recentMessages.filter(m => now - m.time < HIGHLIGHT_WINDOW * 1000);
  // Всплеск сообщений
  if (recentMessages.length >= HIGHLIGHT_THRESHOLD) {
    addHighlight('Всплеск активности в чате');
    recentMessages = [];
  }
  // Смех (по ключевым словам)
  if (/\b(ахах|lol|lmao|xd|😂|🤣)\b/i.test(message)) {
    addHighlight('Смех в чате');
  }
}

async function onDonationHighlight(data) {
  addHighlight(`Донат: ${data.username} — ${data.amount}₽`);
}
// --- Интеграция с DonationAlerts (донаты) ---
// Для работы нужен DONATIONALERTS_TOKEN и DONATIONALERTS_SECRET в .env
let donationStats = { total: 0, count: 0, last: null, top: [] };

// Webhook для DonationAlerts (укажите этот URL в личном кабинете DonationAlerts)
app.post('/api/donationalerts/webhook', express.json(), async (req, res) => {
  // Проверка секрета (опционально)
  const secret = process.env.DONATIONALERTS_SECRET;
  if (secret && req.headers['x-donationalerts-signature'] !== secret) {
    return res.status(403).json({error:'invalid secret'});
  }
  const data = req.body;
  if (!data || !data.username || !data.amount) return res.status(400).json({error:'bad payload'});
  // Реакция: отправить сообщение в чат, уведомление, озвучка
  donationStats.total += Number(data.amount);
  donationStats.count++;
  donationStats.last = data;
  // Топ донатеров (по сумме)
  let found = donationStats.top.find(u => u.username === data.username);
  if (found) found.amount += Number(data.amount);
  else donationStats.top.push({ username: data.username, amount: Number(data.amount) });
  donationStats.top.sort((a,b) => b.amount - a.amount);
  if (donationStats.top.length > 10) donationStats.top = donationStats.top.slice(0,10);
  // Уведомление премиум-пользователям
  await notifyDonation({ username: data.username, amount: data.amount, message: data.message || '' });
  // Озвучка доната (если включено)
  if (process.env.ENABLE_DONATE_TTS === '1' && data.message) {
    try {
      const audio = await generateSpeech(data.message, 'ru');
      const fileName = `donate_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`;
      const filePath = path.join(__dirname, 'logs', fileName);
      fs.writeFileSync(filePath, audio);
      // Можно отправить ссылку на аудио в чат или на фронт
    } catch(e) { console.warn('TTS donate error:', e.message); }
  }
  // Хайлайт по донату
  await onDonationHighlight(data);
  res.json({ok:true});
});

// API: статистика донатов (только для премиум)
app.get('/api/donations/stats', checkToken, (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  res.json(donationStats);
});
// --- Премиум-уведомления (push/webhook) ---
// Универсальная функция отправки webhook (Discord, Telegram, кастомный URL)
async function sendPremiumNotification({text, type = 'info', user = null}) {
  // Discord Webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await axios.post(process.env.DISCORD_WEBHOOK_URL, { content: `[${type}] ${text}` });
    } catch (e) { console.warn('Discord webhook error:', e.message); }
  }
  // Telegram Bot API (если задан TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await axios.post(url, { chat_id: process.env.TELEGRAM_CHAT_ID, text: `[${type}] ${text}` });
    } catch (e) { console.warn('Telegram notify error:', e.message); }
  }
  // Можно добавить другие webhook/URL по желанию
}

// Пример: отправка уведомления о донате (вызывать из донат-интеграции)
async function notifyDonation({username, amount, message}) {
  await sendPremiumNotification({
    text: `Донат от ${username}: ${amount}₽\n${message}`,
    type: 'donation',
    user: username
  });
}

// Пример: уведомление о VIP (вызывать при выдаче VIP)
async function notifyVIP({username}) {
  await sendPremiumNotification({
    text: `Пользователь ${username} получил VIP!`,
    type: 'vip',
    user: username
  });
}

// Пример: уведомление о рейде (вызывать при рейде)
async function notifyRaid({from, viewers}) {
  await sendPremiumNotification({
    text: `Рейд от ${from} на ${viewers} зрителей!`,
    type: 'raid',
    user: from
  });
}

// API для ручной отправки уведомления (только премиум)
app.post('/api/premium/notify', checkToken, async (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  const { text, type } = req.body;
  if (!text) return res.status(400).json({ error: 'no text' });
  try {
    await sendPremiumNotification({text, type: type || 'info', user: req.user.username});
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error:'notify error', details: e.message});
  }
});
// --- Голосовые уведомления через ElevenLabs ---
const fs = require('fs');
const FormData = require('form-data');

// Получить аудиофайл через ElevenLabs API
async function generateSpeech(text, lang = 'ru') {
  const apiKey = process.env.ELEVENLABS_KEY;
  if (!apiKey) throw new Error('No ElevenLabs API key');
  // Выбор голоса по языку (можно расширить)
  const voiceId = lang === 'ru' ? 'EXAVITQu4vr4xnSDxMaL' : '21m00Tcm4TlvDq8ikWAM';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const payload = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.7 }
  };
  const axios = require('axios');
  const response = await axios.post(url, payload, {
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    responseType: 'arraybuffer'
  });
  return response.data; // Buffer с mp3
}

// API: POST /api/tts { text, lang } => mp3 (только для премиум)
app.post('/api/tts', checkToken, async (req, res) => {
  if (!req.user || !req.user.premium) return res.status(403).json({ error: 'premium only' });
  const { text, lang } = req.body;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'no text' });
  try {
    const audio = await generateSpeech(text, lang || 'ru');
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (e) {
    res.status(500).json({ error: 'tts error', details: e.message });
  }
});

// Команда в чате/WS: !tts <язык> <текст> (пример: !tts ru Привет мир)
// Только для премиум
// ...existing code...
      // Голосовые уведомления: !tts ru|en <текст>
      if(ws.user && ws.user.premium && lower.startsWith('!tts ')) {
        const parts = txt.split(' ');
        const lang = (parts[1] === 'en' || parts[1] === 'ru') ? parts[1] : 'ru';
        const ttsText = parts.slice(2).join(' ');
        if(!ttsText) {
          ws.send(JSON.stringify({type:'reply', text:'Использование: !tts ru|en <текст>'}));
          return;
        }
        try {
          const audio = await generateSpeech(ttsText, lang);
          // Сохраняем временный файл и отправляем ссылку (или base64)
          const fileName = `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`;
          const filePath = path.join(__dirname, 'logs', fileName);
          fs.writeFileSync(filePath, audio);
          ws.send(JSON.stringify({type:'tts', url:`/logs/${fileName}`}));
        } catch(e) {
          ws.send(JSON.stringify({type:'error', text:'Ошибка генерации озвучки: ' + e.message}));
        }
        return;
      }

// --- Render deployment optimization ---
const path = require('path');
let express, http, WebSocket, tmi, axios;
try {
  express = require('express');
  http = require('http');
  WebSocket = require('ws');
  tmi = require('tmi.js');
  axios = require('axios');
} catch (e) {
  console.error('Missing dependency:', e.message);
  process.exit(1);
}
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

const app = express();
const PORT = process.env.PORT || 10000; // Render uses 10000 by default
app.use(express.json());

// Serve static files for dashboard
app.use('/', express.static(path.join(__dirname, 'twitch-bot-dashboard')));

// Настройки Twitch-бота (заменить на свои значения)
let twitchConfig = {
  options: { debug: true, logging: 'info' },
  connection: { reconnect: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME || 'pattmsc_bot',
    password: process.env.TWITCH_OAUTH_TOKEN || 'oauth:invalid_token'
  },
  channels: [ process.env.TWITCH_CHANNEL || 'your_channel' ]
};

// Автообновление OAuth-токена через twitch-auth.js
const twitchAuth = require('./twitch-auth');
twitchAuth.refreshAccessToken().then(token => {
  if(token && token.startsWith('oauth:')) {
    twitchConfig.identity.password = token;
    console.log('OAuth-токен Twitch обновлён автоматически');
  } else {
    console.log('Не удалось обновить OAuth-токен Twitch');
  }
});

// <-- Добавлена закрывающая фигурная скобка для Express/WebSocket блока
// Загрузка каналов из БД (PostgreSQL)
async function loadManagedChannels() {
  try {
    const rows = await db.all('SELECT name FROM managed_channels');
    return rows.map(r => r.name);
  } catch(e) { return [...twitchConfig.channels]; }
}
let managedChannels = [];
loadManagedChannels().then(channels => { managedChannels = channels; });

async function addChannel(name) {
  if(!managedChannels.includes(name)) {
    managedChannels.push(name);
    twitchClient.join(name);
    try { await db.run('INSERT INTO managed_channels (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]); } catch(e) {}
  }
}

async function removeChannel(name) {
  if(managedChannels.includes(name)) {
    managedChannels = managedChannels.filter(c => c !== name);
    twitchClient.part(name);
    try { await db.run('DELETE FROM managed_channels WHERE name = $1', [name]); } catch(e) {}
  }
}
// Автоматизация расписания для VIP
const userSchedule = [];
function addSchedule(date, event) {
  userSchedule.push({date, event});
}
function getSchedule() {
  return userSchedule;
}
// Персональные напоминания для VIP-пользователей
const userReminders = {};
function addReminder(username, text) {
  if(!userReminders[username]) userReminders[username] = [];
  userReminders[username].push({text, time: new Date().toISOString()});
}
function getReminders(username) {
  return userReminders[username] || [];
}
// Розыгрыши и конкурсы
let giveawayActive = false;
let giveawayEntries = [];

function startGiveaway() {
  giveawayActive = true;
  giveawayEntries = [];
}
function enterGiveaway(username) {
  if(!giveawayActive) return false;
  if(!giveawayEntries.includes(username)) giveawayEntries.push(username);
  return true;
}
function drawGiveaway() {
  if(!giveawayActive || giveawayEntries.length === 0) return null;
  const winner = giveawayEntries[Math.floor(Math.random()*giveawayEntries.length)];
  giveawayActive = false;
  return winner;
}
// Кастомные фильтры: поддержка regexp
const chatFilters = [];
const chatRegexFilters = [];
function addFilter(word) {
  if(!chatFilters.includes(word)) chatFilters.push(word);
}
function addRegexFilter(regexp) {
  try {
    const re = new RegExp(regexp, 'i');
    chatRegexFilters.push(re);
  } catch(e) {}
}
function checkFilters(message) {
  if(chatFilters.some(f => message.includes(f))) return true;
  if(chatRegexFilters.some(re => re.test(message))) return true;
  return false;
}
// Проверка токена (перемещено выше всех использований)
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
function checkToken(req, res, next){
  const token = req.headers['x-auth-token'] || req.query.token;
  if(token && token === (process.env.EXAMPLE_TOKEN || 'secret-token')) return next();
  const auth = req.headers['authorization'];
  if(auth && auth.startsWith('Bearer ')){
    const t = auth.slice(7);
    try{ const payload = jwt.verify(t, JWT_SECRET); req.user = payload; return next(); }catch(e){}
  }
  return res.status(401).json({error:'unauthorized'});
}

// Middleware для проверки роли
function requireRole(role) {
  return function(req, res, next) {
    if(req.user && (req.user.role === role || req.user.role === 'admin')) return next();
    return res.status(403).json({error:'forbidden'});
  };
}

// Пример: добавить роль moderator вручную через API (для теста)
app.post('/api/users/:username/role', checkToken, requireRole('admin'), (req, res) => {
  const username = req.params.username;
  const { role } = req.body;
  if(!['admin','moderator','user'].includes(role)) return res.status(400).json({error:'invalid role'});
  db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
  res.json({ok:true, username, role});
});
const twitchClient = new tmi.Client(twitchConfig);
twitchClient.connect().catch(console.error);


function sendDiscordNotification(text) {
  if(!DISCORD_WEBHOOK_URL) return;
  axios.post(DISCORD_WEBHOOK_URL, { content: text }).catch(() => {});
twitchClient.on('connected', (addr, port) => {
  console.log(`Twitch bot connected: ${addr}:${port}`);
});

// Автофильтрация сообщений в чате Twitch
twitchClient.on('message', (channel, userstate, message, self) => {
  if(self) return;
  // Хайлайты: анализ активности
  checkHighlightActivity(message, userstate);
  if(checkFilters(message)) {
    // Удалить сообщение
    twitchClient.deletemessage(channel, userstate.id);
    // Отправить предупреждение
    twitchClient.say(channel, `@${userstate.username}, запрещённые слова!`);
    logModeration('auto', 'filter', userstate.username, message);
  }
});

// Модерация: удаление сообщений, бан, тайм-аут
function moderateChat(action, username, reason, duration) {
  const channel = twitchConfig.channels[0];
  switch(action) {
    case 'ban':
      twitchClient.ban(channel, username, reason || 'Banned by bot');
      break;
    case 'timeout':
      twitchClient.timeout(channel, username, duration || 600, reason || 'Timeout by bot');
      break;
    case 'delete':
      twitchClient.deletemessage(channel, username);
      break;
    default:
      break;
  }
}

// Антиспам и лимиты
const userCommandTimestamps = {};
const COMMAND_LIMIT_MS = 3000; // минимум 3 секунды между командами

function checkSpam(username) {
  const now = Date.now();
  if(!userCommandTimestamps[username]) {
    userCommandTimestamps[username] = now;
    return false;
  }
  if(now - userCommandTimestamps[username] < COMMAND_LIMIT_MS) {
    return true;
  }
  userCommandTimestamps[username] = now;
  return false;
}

// Twitch OAuth auto-refresh
const twitchAuth = require('./twitch-auth');

// Автообновление токена при запуске сервера
twitchAuth.refreshAccessToken().then(token => {
  if(token) console.log('Twitch access_token обновлён');
  else console.log('Не удалось обновить Twitch access_token');
});

const db = require('./db');

// PostgreSQL: миграция refresh_token не требуется, поле уже есть
// REST API: получить логи модерации
app.get('/api/moderation/logs', checkToken, requireRole('moderator'), (req, res) => {
  res.json({logs: getModerationLogs()});
});
// Twitch OAuth2 endpoints
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'nmc2e44r8mfx9agmqi8p339tboq7e2';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'szezmr7n2mo6xoh5v4qwdqowj0sjkx';
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/api/auth/twitch/callback';

app.get('/api/auth/twitch', (req, res) => {
  const url = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}&response_type=code&scope=user:read:email+chat:read+chat:edit`;
  res.redirect(url);
});

app.get('/api/auth/twitch/callback', async (req, res) => {
  const code = req.query.code;
  if(!code) return res.status(400).send('No code');
  try {
    const axios = require('axios');
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TWITCH_REDIRECT_URI
      }
    });
    const access_token = tokenRes.data.access_token;
    // Получить инфо о пользователе
    const userRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${access_token}`, 'Client-Id': TWITCH_CLIENT_ID }
    });
    const twitchUser = userRes.data.data[0];
    // Сохранить/обновить пользователя в БД
    let user = db.prepare('SELECT id,role FROM users WHERE username = ?').get(twitchUser.login);
    if(!user) {
      // Первый пользователь — admin, остальные — user
      const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const role = count === 0 ? 'admin' : 'user';
      db.prepare('INSERT INTO users (username,role) VALUES (?,?)').run(twitchUser.login, role);
      user = db.prepare('SELECT id,role FROM users WHERE username = ?').get(twitchUser.login);
    }
    // Вернуть JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({id: user.id, username: twitchUser.login, role: user.role}, JWT_SECRET, {expiresIn:'8h'});
    res.json({token, role: user.role, username: twitchUser.login});
  } catch(e) {
    res.status(500).send('OAuth error: ' + (e.response?.data?.message || e.message));
  }
});
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function checkToken(req, res, next){
  const token = req.headers['x-auth-token'] || req.query.token;
  if(token && token === (process.env.EXAMPLE_TOKEN || 'secret-token')) return next();
  const auth = req.headers['authorization'];
  if(auth && auth.startsWith('Bearer ')){
    const t = auth.slice(7);
    try{ const payload = jwt.verify(t, JWT_SECRET); req.user = payload; return next(); }catch(e){}
  }
  return res.status(401).json({error:'unauthorized'});
}

function requireAdmin(req, res, next){ if(req.user && req.user.role === 'admin') return next(); return res.status(403).json({error:'forbidden'}); }

// Commands API

app.get('/api/commands', checkToken, async (req, res) => {
  try {
    const rows = await db.all('SELECT name,payload FROM commands');
    const obj = {};
    for(const r of rows) obj[r.name] = r.payload;
    res.json(obj);
  } catch(e) { res.status(500).json({error:'db error'}); }
});


app.post('/api/commands', checkToken, requireAdmin, async (req, res) => {
  const { name, payload } = req.body;
  if(!name || !payload) return res.status(400).json({error:'invalid'});
  try {
    await db.run('INSERT INTO commands (name,payload) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET payload = $2', [name, payload]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:'db error'}); }
});

// Ограничение доступа к определённым командам (пример)
app.post('/api/secure-command', checkToken, requireRole('moderator'), (req, res) => {
  // Только moderator и admin
  res.json({ok:true, message:'Выполнена защищённая команда'});
});


app.delete('/api/commands/:name', checkToken, requireAdmin, async (req, res) => {
  const name = req.params.name;
  try {
    await db.run('DELETE FROM commands WHERE name = $1', [name]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:'db error'}); }
});

// Auth: register + login

app.post('/api/register', express.json(), async (req, res) =>{
  const {username, password, email} = req.body;
  if(!username||!password||!email) return res.status(400).json({error:'invalid'});
  const hashed = await bcrypt.hash(password, 8);
  try{
    const countRow = await db.get('SELECT COUNT(*) as c FROM users');
    const count = countRow ? countRow.c : 0;
    const role = count === 0 ? 'admin' : 'user';
    const refresh_token = Buffer.from(username + Date.now()).toString('base64');
    const now = new Date().toISOString();
    const info = await db.get('INSERT INTO users (username,password,role,email,refresh_token,last_login) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [username, hashed, role, email, refresh_token, now]);
    const token = jwt.sign({id: info.id, username, role}, JWT_SECRET, {expiresIn:'8h'});
    return res.json({ok:true, token, refresh_token});
  }catch(e){ return res.status(400).json({error:'exists'}); }
});

// Settings API

app.get('/api/settings', checkToken, async (req, res) => {
  try {
    const rows = await db.all('SELECT key,value FROM settings');
    const obj = {};
    for(const r of rows){
      try{ obj[r.key] = JSON.parse(r.value); }catch(e){ obj[r.key] = r.value; }
    }
    res.json(obj);
  } catch(e) { res.status(500).json({error:'db error'}); }
});


app.put('/api/settings', checkToken, requireAdmin, express.json(), async (req, res) => {
  const body = req.body || {};
  try {
    for(const k of Object.keys(body)) {
      await db.run('INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2', [k, JSON.stringify(body[k])]);
    }
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:'failed'}); }
});


app.post('/api/login', express.json(), async (req,res)=>{
  const {username,password} = req.body; if(!username||!password) return res.status(400).json({error:'invalid'});
  const row = await db.get('SELECT id,username,password,role,refresh_token,premium FROM users WHERE username = $1', [username]);
  if(!row) return res.status(401).json({error:'invalid'});
  const ok = await bcrypt.compare(password, row.password);
  if(!ok) return res.status(401).json({error:'invalid'});
  const token = jwt.sign({id:row.id,username:row.username,role:row.role}, JWT_SECRET, {expiresIn:'8h'});
  // Если refresh_token отсутствует, генерируем новый
  let refresh_token = row.refresh_token;
  if(!refresh_token) {
    refresh_token = Buffer.from(row.username + Date.now()).toString('base64');
    await db.run('UPDATE users SET refresh_token = $1 WHERE id = $2', [refresh_token, row.id]);
  }
  await db.run('UPDATE users SET last_login = $1 WHERE id = $2', [new Date().toISOString(), row.id]);
  res.json({token, refresh_token, premium: row.premium});
});
// API: активация премиум-функций

app.post('/api/premium/activate', checkToken, async (req, res) => {
  if(!req.user) return res.status(401).json({error:'unauthorized'});
  await db.run('UPDATE users SET premium = 1 WHERE id = $1', [req.user.id]);
  await db.run('INSERT INTO premium_features (user_id, feature, created_at) VALUES ($1, $2, $3)', [req.user.id, req.body.feature || 'default', new Date().toISOString()]);
  res.json({ok:true, premium: true});
});

// API: проверка премиум-статуса

app.get('/api/premium/status', checkToken, async (req, res) => {
  if(!req.user) return res.status(401).json({error:'unauthorized'});
  const row = await db.get('SELECT premium FROM users WHERE id = $1', [req.user.id]);
  res.json({premium: !!(row && row.premium)});
});

// Current user info


// Автоматическая сессия: возвращает данные пользователя, если токен валиден

app.get('/api/session', async (req, res) => {
  const token = req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')
    ? req.headers['authorization'].slice(7)
    : req.query.token || req.headers['x-auth-token'];
  if(!token) return res.status(401).json({error:'no token'});
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({id: payload.id, username: payload.username, role: payload.role});
  } catch(e) {
    return res.status(401).json({error:'invalid token'});
  }
});

// Endpoint для автообновления JWT токена через refresh_token

app.post('/api/refresh', express.json(), async (req, res) => {
  const { refresh_token } = req.body;
  if(!refresh_token) return res.status(400).json({error:'no refresh_token'});
  // Найти пользователя по refresh_token
  const row = await db.get('SELECT id,username,role FROM users WHERE refresh_token = $1', [refresh_token]);
  if(!row) return res.status(401).json({error:'invalid refresh_token'});
  const newToken = jwt.sign({id: row.id, username: row.username, role: row.role}, JWT_SECRET, {expiresIn:'8h'});
  // Генерируем новый refresh_token
  const newRefreshToken = Buffer.from(row.username + Date.now()).toString('base64');
  await db.run('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, row.id]);
  return res.json({token: newToken, refresh_token: newRefreshToken});
});

// serve dashboard statics
// --- API статистики для фронтенда ---
let stats = {
  messages: 0,
  commands: 0,
  activeUsers: 0,
  activity: { labels: [], data: [] }
};
let userActivity = {};
function updateStats(type, username) {
  if(type === 'message') stats.messages++;
  if(type === 'command') stats.commands++;
  if(username) {
    userActivity[username] = (userActivity[username] || 0) + 1;
    stats.activeUsers = Object.keys(userActivity).length;
  }
  // График активности (по минутам)
  const now = new Date();
  const label = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  if(stats.activity.labels[stats.activity.labels.length-1] !== label) {
    stats.activity.labels.push(label);
    stats.activity.data.push(1);
    if(stats.activity.labels.length > 30) { stats.activity.labels.shift(); stats.activity.data.shift(); }
  } else {
    stats.activity.data[stats.activity.data.length-1]++;
  }
}

app.get('/api/stats', (req, res) => {
  res.json(stats);
});
  updateStats('message', userstate.username);
  // Для статистики команд
  updateStats('command', username);
app.use('/', express.static(path.join(__dirname, 'twitch-bot-dashboard')));

// Пример использования актуального Twitch access_token:
// const twitchToken = twitchAuth.getAccessToken();
// Используйте twitchToken для запросов к Twitch API

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const VALID_TOKEN = process.env.EXAMPLE_TOKEN || 'secret-token';

wss.on('connection', (ws) => {
  // Для модерации: логировать действия
  ws.on('message', async (m) => {
    // ...existing code...
    if(data.type === 'moderation') {
      // Логировать модерацию для фронта
      if(data.action && data.target) {
        updateStats('command', data.target);
        if(!stats.modLogs) stats.modLogs = [];
        stats.modLogs.push({ time: new Date().toLocaleTimeString(), action: data.action, target: data.target, reason: data.reason });
        if(stats.modLogs.length > 50) stats.modLogs.shift();
      }
    }
    // ...existing code...
  });
app.get('/api/modlogs', (req, res) => {
  res.json(stats.modLogs || []);
});
  ws.isAuthed = false;
  ws.send(JSON.stringify({type:'info', text:'Connected to integrated server.'}));
  ws.on('message', async (m) => {
    // Получить имя пользователя из токена (если есть)
    let username = ws.user && ws.user.username ? ws.user.username : 'anonymous';
    let data = null;
    try { data = JSON.parse(m); } catch(e){ ws.send(JSON.stringify({type:'error', text:'invalid json'})); return; }
    if(data.type === 'auth'){ if(data.token === VALID_TOKEN){ ws.isAuthed = true; ws.send(JSON.stringify({type:'auth', ok:true})); } else ws.send(JSON.stringify({type:'auth', ok:false, reason:'invalid token'})); return; }
    if(!ws.isAuthed){ ws.send(JSON.stringify({type:'error', text:'not authenticated'})); return; }
      // Антиспам: проверка лимита
      if(checkSpam(username)) {
        ws.send(JSON.stringify({type:'error', text:'Слишком часто! Подождите несколько секунд.'}));
        console.log(`[antispam] user ${username} заблокирован на ${COMMAND_LIMIT_MS}ms`);
        return;
      }
      // Модераторские команды через WebSocket
      if(data.type === 'moderation') {
        if(!ws.user || (ws.user.role !== 'admin' && ws.user.role !== 'moderator')) {
          ws.send(JSON.stringify({type:'error', text:'Недостаточно прав для модерации.'}));
          return;
        }
        const { action, target, reason, duration } = data;
        moderateChat(action, target, reason, duration);
        ws.send(JSON.stringify({type:'info', text:`Модераторская команда ${action} для ${target} выполнена.`}));
        return;
      }
      // Премиум-команда: статистика активности
      if(ws.user && ws.user.premium && lower === '!stats') {
        // Топ-10 активных пользователей
        const top = Object.entries(userActivity)
          .sort((a,b) => b[1]-a[1])
          .slice(0,10)
          .map(([u,c],i) => `${i+1}. ${u}: ${c} сообщений`)
          .join('\n');
        ws.send(JSON.stringify({type:'reply', text:`[Статистика чата]\n${top}` }));
        logModeration(ws.user.username, 'stats', '', '');
        return;
      }
    if(data.type === 'say'){
      console.log('[say]', data.text);
      if(data.text && typeof data.text === 'string') {
        const txt = data.text.trim();
        const lower = txt.toLowerCase();
        // Расширенная аналитика для премиум
        if(ws.user && ws.user.premium && lower === '!fullstats') {
          const top = Object.entries(userActivity)
            .sort((a,b) => b[1]-a[1])
            .map(([u,c],i) => `${i+1}. ${u}: ${c} сообщений`)
            .join('\n');
          const total = Object.values(userActivity).reduce((a,b)=>a+b,0);
          ws.send(JSON.stringify({type:'reply', text:`[Полная статистика]\nВсего сообщений: ${total}\n${top}` }));
          logModeration(ws.user.username, 'fullstats', '', '');
          return;
        }
        // Мульти-канальный режим: просмотр каналов
        if(ws.user && ws.user.premium && lower === '!channels') {
          ws.send(JSON.stringify({type:'info', text:`Управляемые каналы: ${managedChannels.join(', ')}` }));
          logModeration(ws.user.username, 'channels', '', managedChannels.join(', '));
          return;
        }
        // Мульти-канальный режим: добавить канал
        if(ws.user && ws.user.role === 'admin' && lower.startsWith('!addchannel ')) {
          const channelName = txt.split(' ')[1];
          addChannel(channelName);
          ws.send(JSON.stringify({type:'info', text:`Канал ${channelName} добавлен в управление.` }));
          logModeration(ws.user.username, 'addchannel', channelName, '');
          return;
        }
        // Мульти-канальный режим: отправка сообщений во все каналы
        if(ws.user && ws.user.role === 'admin' && lower.startsWith('!broadcast ')) {
          const msg = txt.slice(11).trim();
          managedChannels.forEach(ch => twitchClient.say(ch, `[Broadcast] ${msg}`));
          ws.send(JSON.stringify({type:'info', text:'Сообщение отправлено во все каналы.'}));
          logModeration(ws.user.username, 'broadcast', '', msg);
          return;
        }
        // Автоматизация расписания для VIP
        if(ws.user && ws.user.premium) {
          if(message.startsWith('!channels')) {
            // Только премиум/админ
            const userRow = db.prepare('SELECT premium,role FROM users WHERE username = ?').get(username);
            if(userRow && (userRow.premium || userRow.role === 'admin')) {
              const channelsFromDb = loadManagedChannels();
              twitchClient.say(channel, `Управляемые каналы: ${channelsFromDb.join(', ')}`);
            } else {
              twitchClient.say(channel, `@${username}, команда доступна только премиум/админ.`);
            }
            return;
          }
          if(message.startsWith('!addchannel ')) {
            // Только админ
            const userRow = db.prepare('SELECT role FROM users WHERE username = ?').get(username);
            if(userRow && userRow.role === 'admin') {
              const newChannel = message.split(' ')[1];
              if(newChannel && !managedChannels.includes(newChannel)) {
                addChannel(newChannel);
                twitchClient.say(channel, `Канал ${newChannel} добавлен.`);
              } else {
                twitchClient.say(channel, `Канал уже добавлен или не указан.`);
              }
            } else {
              twitchClient.say(channel, `@${username}, команда доступна только админам.`);
            }
            return;
          }
          if(message.startsWith('!removechannel ')) {
            // Только админ
            const userRow = db.prepare('SELECT role FROM users WHERE username = ?').get(username);
            if(userRow && userRow.role === 'admin') {
              const remChannel = message.split(' ')[1];
              if(remChannel && managedChannels.includes(remChannel)) {
                removeChannel(remChannel);
                twitchClient.say(channel, `Канал ${remChannel} удалён.`);
              } else {
                twitchClient.say(channel, `Канал не найден или не указан.`);
              }
            } else {
              twitchClient.say(channel, `@${username}, команда доступна только админам.`);
            }
            return;
          }
          if(lower === '!giveaway') {
            startGiveaway();
            ws.send(JSON.stringify({type:'info', text:'Розыгрыш запущен! Введите !enter для участия.'}));
            logModeration(ws.user.username, 'giveaway_start', '', '');
            return;
          }
          if(lower === '!enter') {
            if(enterGiveaway(ws.user.username)) {
              ws.send(JSON.stringify({type:'info', text:'Вы участвуете в розыгрыше!'}));
              logModeration(ws.user.username, 'giveaway_enter', '', '');
            } else {
              ws.send(JSON.stringify({type:'info', text:'Нет активного розыгрыша.'}));
            }
            return;
          }
          if(lower === '!draw') {
            const winner = drawGiveaway();
            if(winner) {
              ws.send(JSON.stringify({type:'info', text:`Победитель розыгрыша: ${winner}` }));
              logModeration(ws.user.username, 'giveaway_draw', winner, '');
            } else {
              ws.send(JSON.stringify({type:'info', text:'Нет участников или розыгрыш не запущен.'}));
            }
            return;
          }
        }
        // Кастомные фильтры: добавить regexp
        if(ws.user && (ws.user.role === 'admin' || ws.user.role === 'moderator') && lower.startsWith('!addfilter ')) {
          const regexp = txt.slice(11).trim();
          addRegexFilter(regexp);
          ws.send(JSON.stringify({type:'info', text:`Регулярный фильтр добавлен: ${regexp}` }));
          logModeration(ws.user.username, 'addfilter', '', regexp);
          return;
        }
        // Персональные VIP-команды для премиум-пользователей
        if(ws.user && ws.user.premium) {
          // !vipweather <город>
          if(lower.startsWith('!vipweather')) {
            const city = txt.split(' ').slice(1).join(' ') || 'Москва';
            try {
              const axios = require('axios');
              const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current_weather=true`);
              if(weatherRes.data && weatherRes.data.current_weather) {
                ws.send(JSON.stringify({type:'reply', text:`[VIP] Погода в ${city}: ${weatherRes.data.current_weather.temperature}°C, ветер ${weatherRes.data.current_weather.windspeed} м/с`}));
              } else ws.send(JSON.stringify({type:'reply', text:'[VIP] Не удалось получить погоду'}));
            } catch(e) { ws.send(JSON.stringify({type:'reply', text:'[VIP] Ошибка получения погоды'})); }
            logModeration(ws.user.username, 'vipweather', '', city);
            return;
          }
          // !vipjoke
          if(lower === '!vipjoke') {
            try {
              const axios = require('axios');
              const jokeRes = await axios.get('https://official-joke-api.appspot.com/random_joke');
              if(jokeRes.data) {
                ws.send(JSON.stringify({type:'reply', text:`[VIP] ${jokeRes.data.setup} ${jokeRes.data.punchline}`}));
              } else ws.send(JSON.stringify({type:'reply', text:'[VIP] Не удалось получить шутку'}));
            } catch(e) { ws.send(JSON.stringify({type:'reply', text:'[VIP] Ошибка получения шутки'})); }
            logModeration(ws.user.username, 'vipjoke', '', '');
            return;
          }
        }
        // Премиум AI-автоответы
        if(ws.user && ws.user.premium) {
          if(lower.startsWith('!ai ')) {
            const prompt = txt.slice(4).trim();
            // Пример: интеграция с внешним AI (здесь — заглушка)
            let aiReply = '[AI] Ответ: ' + prompt.split('').reverse().join(''); // demo: reverse text
            ws.send(JSON.stringify({type:'reply', text: aiReply }));
            logModeration(ws.user.username, 'ai_reply', '', prompt);
            return;
          }
        }
        // Модераторские команды через чат (!ban, !timeout, !purge, !filter, !warn, !logs)
        if(ws.user && (ws.user.role === 'admin' || ws.user.role === 'moderator')) {
          // !ban <user> [reason]
          if(lower.startsWith('!ban ')) {
            const parts = txt.split(' ');
            const target = parts[1];
            const reason = parts.slice(2).join(' ');
            moderateChat('ban', target, reason);
            ws.send(JSON.stringify({type:'info', text:`Пользователь ${target} забанен. ${reason}` }));
            logModeration(ws.user.username, 'ban', target, reason);
            return;
          }
          // !timeout <user> <sec> [reason]
          if(lower.startsWith('!timeout ')) {
            const parts = txt.split(' ');
            const target = parts[1];
            const duration = parseInt(parts[2]) || 600;
            const reason = parts.slice(3).join(' ');
            moderateChat('timeout', target, reason, duration);
            ws.send(JSON.stringify({type:'info', text:`Пользователь ${target} в тайм-ауте на ${duration} сек. ${reason}` }));
            logModeration(ws.user.username, 'timeout', target, reason, duration);
            return;
          }
          // !purge <user>
          if(lower.startsWith('!purge ')) {
            const parts = txt.split(' ');
            const target = parts[1];
            moderateChat('delete', target);
            ws.send(JSON.stringify({type:'info', text:`Сообщения пользователя ${target} удалены.` }));
            logModeration(ws.user.username, 'purge', target);
            return;
          }
          // !warn <user> [reason]
          if(lower.startsWith('!warn ')) {
            const parts = txt.split(' ');
            const target = parts[1];
            const reason = parts.slice(2).join(' ');
            ws.send(JSON.stringify({type:'info', text:`Пользователь ${target} предупреждён. ${reason}` }));
            logModeration(ws.user.username, 'warn', target, reason);
            return;
          }
          // !filter <слово>
          if(lower.startsWith('!filter ')) {
            const word = txt.split(' ')[1];
            addFilter(word);
            ws.send(JSON.stringify({type:'info', text:`Фильтр добавлен: ${word}` }));
            logModeration(ws.user.username, 'filter', word);
            return;
          }
          // !logs
          if(lower === '!logs') {
            const logs = getModerationLogs();
            ws.send(JSON.stringify({type:'info', text:`Логи модерации:\n${logs.join('\n')}` }));
            return;
          }
        }
        let reply = null;
        // !ping
        if(lower === '!ping') reply = 'pong';
        // !hello
        else if(lower === '!hello') reply = 'Hi!';
        // !help
        else if(lower === '!help') reply = 'Доступные команды: !ping, !hello, !help, !time, !joke, !weather <город>, !user, !calc <выражение>, !translate <текст> <язык>';
        // !time
        else if(lower === '!time') reply = 'Текущее время: ' + new Date().toLocaleString();
        // !user
        else if(lower === '!user') reply = ws.user ? `Вы: ${ws.user.username}` : 'Нет данных пользователя';
        // !joke [category]
        else if(lower.startsWith('!joke')) {
          try {
            const axios = require('axios');
            let url = 'https://official-joke-api.appspot.com/random_joke';
            const parts = txt.split(' ');
            if(parts.length > 1 && parts[1]) url = `https://official-joke-api.appspot.com/jokes/${parts[1]}/random`;
            const jokeRes = await axios.get(url);
            if(Array.isArray(jokeRes.data)) reply = jokeRes.data[0] ? `${jokeRes.data[0].setup} ${jokeRes.data[0].punchline}` : 'Не удалось получить шутку';
            else reply = jokeRes.data ? `${jokeRes.data.setup} ${jokeRes.data.punchline}` : 'Не удалось получить шутку';
          } catch(e) { reply = 'Ошибка получения шутки'; }
        }
        // !weather <город>
        else if(lower.startsWith('!weather')) {
          const city = txt.split(' ').slice(1).join(' ') || 'Москва';
          try {
            const axios = require('axios');
            // Пример: Open-Meteo API (бесплатно, без ключа)
            const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current_weather=true`);
            if(weatherRes.data && weatherRes.data.current_weather) {
              reply = `Погода в ${city}: ${weatherRes.data.current_weather.temperature}°C, ветер ${weatherRes.data.current_weather.windspeed} м/с`;
            } else reply = 'Не удалось получить погоду';
          } catch(e) { reply = 'Ошибка получения погоды'; }
        }
        // !calc <выражение>
        else if(lower.startsWith('!calc')) {
          const expr = txt.slice(6).trim();
          try {
            // Безопасный eval
            if(expr.match(/^[0-9+\-*/(). ]+$/)) reply = `Результат: ${eval(expr)}`;
            else reply = 'Некорректное выражение';
          } catch(e) { reply = 'Ошибка вычисления'; }
        }
        // !translate <текст> <язык>
        else if(lower.startsWith('!translate')) {
          const parts = txt.split(' ');
          if(parts.length >= 3) {
            const text = parts.slice(1, -1).join(' ');
            const lang = parts[parts.length-1];
            try {
              const axios = require('axios');
              // Пример: LibreTranslate (демо)
              const resp = await axios.post('https://libretranslate.de/translate', {
                q: text,
                source: 'auto',
                target: lang
              }, {headers: {'accept': 'application/json'}});
              reply = resp.data && resp.data.translatedText ? `Перевод: ${resp.data.translatedText}` : 'Не удалось перевести';
            } catch(e) { reply = 'Ошибка перевода'; }
          } else reply = 'Использование: !translate <текст> <язык>';
        }
        // !multi: !weather Москва; !joke; !time
        else if(lower.startsWith('!multi:')) {
          const cmds = txt.slice(7).split(';').map(c => c.trim()).filter(Boolean);
          reply = 'Выполнение нескольких команд...';
          for(const c of cmds) {
            ws.send(JSON.stringify({type:'info', text:`Выполняю: ${c}` }));
            // Можно рекурсивно вызвать обработчик, но для простоты — только echo
          }
        }
        // Проверка кастомных команд из базы
        if(!reply && db) {
          try {
            const cmdRow = db.prepare('SELECT payload FROM commands WHERE name = ?').get(lower);
            if(cmdRow && cmdRow.payload) reply = `Кастомная команда: ${cmdRow.payload}`;
          } catch(e) {}
        }
        if(reply) {
          ws.send(JSON.stringify({type:'reply', text:reply}));
          console.log('[bot reply]', reply);
        } else {
          ws.send(JSON.stringify({type:'ok', text:'message delivered'}));
        }
      } else ws.send(JSON.stringify({type:'ok', text:'message delivered'}));
    }
    else if(data.type === 'custom'){
      console.log('[custom]', data.cmd, data.text);
      // Автоответ на кастомные команды
      let reply = `custom ${data.cmd} executed: ${data.text}`;
      // Проверка кастомных команд из базы
      if(db) {
        try {
          const cmdRow = db.prepare('SELECT payload FROM commands WHERE name = ?').get(data.cmd);
          if(cmdRow && cmdRow.payload) reply = `Кастомная команда: ${cmdRow.payload}`;
        } catch(e) {}
      }
      ws.send(JSON.stringify({type:'reply', text:reply}));
      console.log('[bot reply]', reply);
    }
    else ws.send(JSON.stringify({type:'error', text:'unknown command'}));
  });
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.RENDER) {
    console.log('Running on Render.com');
  }
});
// <-- Добавлена закрывающая фигурная скобка для Express/WebSocket блока
}

