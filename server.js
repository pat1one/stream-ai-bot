const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

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
    // If no users exist yet, make the first user an admin; otherwise regular 'user'
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const role = count === 0 ? 'admin' : 'user';
    const refresh_token = Buffer.from(username + Date.now()).toString('base64');
    const info = db.prepare('INSERT INTO users (username,password,role,refresh_token) VALUES (?,?,?,?)').run(username, hashed, role, refresh_token);
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
  res.json({token, refresh_token});
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
  ws.on('message', (m) => {
    let data = null;
    try { data = JSON.parse(m); } catch(e){ ws.send(JSON.stringify({type:'error', text:'invalid json'})); return; }
    if(data.type === 'auth'){ if(data.token === VALID_TOKEN){ ws.isAuthed = true; ws.send(JSON.stringify({type:'auth', ok:true})); } else ws.send(JSON.stringify({type:'auth', ok:false, reason:'invalid token'})); return; }
    if(!ws.isAuthed){ ws.send(JSON.stringify({type:'error', text:'not authenticated'})); return; }
    if(data.type === 'say'){
      console.log('[say]', data.text);
      if(data.text && typeof data.text === 'string') {
        const txt = data.text.trim();
        const lower = txt.toLowerCase();
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
