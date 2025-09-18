const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CMD_FILE = path.join(DATA_DIR, 'commands.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJSON(file, defaultValue){
  try{ if(fs.existsSync(file)){ return JSON.parse(fs.readFileSync(file,'utf8')||'null')||defaultValue; } }
  catch(e){ console.warn('filedb read error', file, e); }
  return defaultValue;
}
function writeJSON(file, obj){
  try{ fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); }
  catch(e){ console.warn('filedb write error', file, e); }
}

// load
let commands = readJSON(CMD_FILE, {});
let users = readJSON(USERS_FILE, []);
let settings = readJSON(SETTINGS_FILE, {});

function persistAll(){
  writeJSON(CMD_FILE, commands);
  writeJSON(USERS_FILE, users);
  writeJSON(SETTINGS_FILE, settings);
}

function prepare(sql){
  const s = sql.trim();
  // commands
  if(s.startsWith('SELECT name,payload FROM commands')){
    return { all: () => Object.keys(commands).map(k=>({name:k,payload:commands[k]})) };
  }
  if(s.startsWith('INSERT OR REPLACE INTO commands')){
    return { run: (name,payload) => { commands[name]=payload; persistAll(); return {}; } };
  }
  if(s.startsWith('DELETE FROM commands')){
    return { run: (name) => { delete commands[name]; persistAll(); return {}; } };
  }
  // users
  if(s.includes('FROM users WHERE username')){
    return { get: (username) => users.find(u => u.username === username) };
  }
  if(s.startsWith('INSERT INTO users')){
    return { run: (username, password, role) => {
      const maxId = users.reduce((m,u)=> Math.max(m, u.id||0), 0);
      const id = maxId + 1;
      const user = { id, username, password, role };
      users.push(user); persistAll(); return { lastInsertRowid: id };
    } };
  }
  if(s.startsWith('SELECT COUNT(*)')){
    return { get: () => ({ c: users.length }) };
  }
  // settings
  if(s.startsWith('SELECT key,value FROM settings')){
    return { all: () => Object.keys(settings).map(k=>({ key:k, value: settings[k] })) };
  }
  if(s.startsWith('INSERT OR REPLACE INTO settings')){
    return { run: (key, value) => { settings[key] = value; persistAll(); return {}; } };
  }

  // fallback generic
  return {
    all: () => [],
    get: () => undefined,
    run: () => ({})
  };
}

module.exports = { prepare };
