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
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const tmi = require('tmi.js');

// Настройки Twitch-бота (заменить на свои значения)
const twitchConfig = {
  options: { debug: true },
  connection: { reconnect: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME || 'your_bot_username',
    password: process.env.TWITCH_OAUTH_TOKEN || 'oauth:your_oauth_token'
  },
  channels: [ process.env.TWITCH_CHANNEL || 'your_channel' ]
};

const twitchClient = new tmi.Client(twitchConfig);
twitchClient.connect().catch(console.error);

twitchClient.on('connected', (addr, port) => {
  console.log(`Twitch bot connected: ${addr}:${port}`);
});

// Автофильтрация сообщений в чате Twitch
twitchClient.on('message', (channel, userstate, message, self) => {
  if(self) return;
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let db = null;
try{
  db = require('./db');
  console.log('Using SQLite database (./db)');
}catch(e){
  db = require('./filedb');
  console.log('SQLite DB not available, using file-based fallback (./filedb)');
}

// Миграция: добавить поле refresh_token в users, если его нет
try {
  db.prepare('ALTER TABLE users ADD COLUMN refresh_token TEXT').run();
  console.log('users: добавлен столбец refresh_token');
} catch(e) {
  if(!String(e).includes('duplicate column name')) console.error('Ошибка миграции users:', e.message);
}
// REST API: получить логи модерации
app.get('/api/moderation/logs', checkToken, requireRole('moderator'), (req, res) => {
  res.json({logs: getModerationLogs()});
});
// Twitch OAuth2 endpoints
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'your_client_id';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'your_client_secret';
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
app.get('/api/commands', checkToken, (req, res) => {
  const rows = db.prepare('SELECT name,payload FROM commands').all();
  const obj = {};
  for(const r of rows) obj[r.name] = r.payload;
  res.json(obj);
});

app.post('/api/commands', checkToken, requireAdmin, (req, res) => {
  const { name, payload } = req.body;
  if(!name || !payload) return res.status(400).json({error:'invalid'});
  db.prepare('INSERT OR REPLACE INTO commands (name,payload) VALUES (?,?)').run(name, payload);
  res.json({ok:true});
});

// Ограничение доступа к определённым командам (пример)
app.post('/api/secure-command', checkToken, requireRole('moderator'), (req, res) => {
  // Только moderator и admin
  res.json({ok:true, message:'Выполнена защищённая команда'});
});

app.delete('/api/commands/:name', checkToken, requireAdmin, (req, res) => {
  const name = req.params.name;
  db.prepare('DELETE FROM commands WHERE name = ?').run(name);
  res.json({ok:true});
});

// Auth: register + login
app.post('/api/register', express.json(), async (req, res) =>{
  const {username, password} = req.body; if(!username||!password) return res.status(400).json({error:'invalid'});
  const hashed = await bcrypt.hash(password, 8);
  try{
      const {username, password, email} = req.body;
      if(!username||!password||!email) return res.status(400).json({error:'invalid'});
      const hashed = await bcrypt.hash(password, 8);
      try{
        const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
        const role = count === 0 ? 'admin' : 'user';
        const refresh_token = Buffer.from(username + Date.now()).toString('base64');
        const now = new Date().toISOString();
        const info = db.prepare('INSERT INTO users (username,password,role,email,refresh_token,last_login) VALUES (?,?,?,?,?,?)').run(username, hashed, role, email, refresh_token, now);
        const token = jwt.sign({id: info.lastInsertRowid, username, role}, JWT_SECRET, {expiresIn:'8h'});
        return res.json({ok:true, token, refresh_token});
  }catch(e){ return res.status(400).json({error:'exists'}); }
});

// Settings API
app.get('/api/settings', checkToken, (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const obj = {};
  for(const r of rows){
    try{ obj[r.key] = JSON.parse(r.value); }catch(e){ obj[r.key] = r.value; }
  }
  res.json(obj);
});

app.put('/api/settings', checkToken, requireAdmin, express.json(), (req, res) => {
  const body = req.body || {};
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  try{
    db.transaction(() => {
      for(const k of Object.keys(body)) insert.run(k, JSON.stringify(body[k]));
    })();
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:'failed'}); }
});

app.post('/api/login', express.json(), async (req,res)=>{
  const {username,password} = req.body; if(!username||!password) return res.status(400).json({error:'invalid'});
  const row = db.prepare('SELECT id,username,password,role,refresh_token FROM users WHERE username = ?').get(username);
  if(!row) return res.status(401).json({error:'invalid'});
  const ok = await bcrypt.compare(password, row.password);
  if(!ok) return res.status(401).json({error:'invalid'});
  const token = jwt.sign({id:row.id,username:row.username,role:row.role}, JWT_SECRET, {expiresIn:'8h'});
  // Если refresh_token отсутствует, генерируем новый
  let refresh_token = row.refresh_token;
  if(!refresh_token) {
    refresh_token = Buffer.from(row.username + Date.now()).toString('base64');
    db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(refresh_token, row.id);
  }
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    res.json({token, refresh_token, premium: row.premium});
// API: активация премиум-функций
app.post('/api/premium/activate', checkToken, (req, res) => {
  if(!req.user) return res.status(401).json({error:'unauthorized'});
  db.prepare('UPDATE users SET premium = 1 WHERE id = ?').run(req.user.id);
  db.prepare('INSERT INTO premium_features (user_id, feature, created_at) VALUES (?, ?, ?)').run(req.user.id, req.body.feature || 'default', new Date().toISOString());
  res.json({ok:true, premium: true});
});

// API: проверка премиум-статуса
app.get('/api/premium/status', checkToken, (req, res) => {
  if(!req.user) return res.status(401).json({error:'unauthorized'});
  const row = db.prepare('SELECT premium FROM users WHERE id = ?').get(req.user.id);
  res.json({premium: !!(row && row.premium)});
});

// Current user info
app.get('/api/me', checkToken, (req, res) => {
  if(req.user) return res.json({id: req.user.id, username: req.user.username, role: req.user.role});
  return res.status(401).json({error:'unauthorized'});
});

// Автоматическая сессия: возвращает данные пользователя, если токен валиден
app.get('/api/session', (req, res) => {
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
app.post('/api/refresh', express.json(), (req, res) => {
  const { refresh_token } = req.body;
  if(!refresh_token) return res.status(400).json({error:'no refresh_token'});
  // Найти пользователя по refresh_token
  const row = db.prepare('SELECT id,username,role FROM users WHERE refresh_token = ?').get(refresh_token);
  if(!row) return res.status(401).json({error:'invalid refresh_token'});
  const newToken = jwt.sign({id: row.id, username: row.username, role: row.role}, JWT_SECRET, {expiresIn:'8h'});
  // Генерируем новый refresh_token
  const newRefreshToken = Buffer.from(row.username + Date.now()).toString('base64');
  db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(newRefreshToken, row.id);
  return res.json({token: newToken, refresh_token: newRefreshToken});
});

// serve dashboard statics
app.use('/', express.static(path.join(__dirname, 'twitch-bot-dashboard')));

// Пример использования актуального Twitch access_token:
// const twitchToken = twitchAuth.getAccessToken();
// Используйте twitchToken для запросов к Twitch API

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const VALID_TOKEN = process.env.EXAMPLE_TOKEN || 'secret-token';

wss.on('connection', (ws) => {
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
    if(data.type === 'say'){
      console.log('[say]', data.text);
      if(data.text && typeof data.text === 'string') {
        const txt = data.text.trim();
        const lower = txt.toLowerCase();
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

server.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
