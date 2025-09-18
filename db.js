const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'app.db');
const DATA_DIR = path.join(__dirname, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS commands (
  name TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// Migrate existing JSON commands if present
const CMD_FILE = path.join(DATA_DIR, 'commands.json');
if(fs.existsSync(CMD_FILE)){
  try{
    const raw = fs.readFileSync(CMD_FILE,'utf8');
    const obj = JSON.parse(raw);
    const insert = db.prepare('INSERT OR REPLACE INTO commands (name,payload) VALUES (?,?)');
    for(const k of Object.keys(obj)) insert.run(k, obj[k]);
    // rename old file
    fs.renameSync(CMD_FILE, CMD_FILE + '.migrated');
  }catch(e){ console.warn('migration failed', e); }
}

// Migrate settings if an old settings.json exists
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
if(fs.existsSync(SETTINGS_FILE)){
  try{
    const raw = fs.readFileSync(SETTINGS_FILE,'utf8');
    const obj = JSON.parse(raw);
    const insert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
    for(const k of Object.keys(obj)) insert.run(k, JSON.stringify(obj[k]));
    fs.renameSync(SETTINGS_FILE, SETTINGS_FILE + '.migrated');
  }catch(e){ console.warn('settings migration failed', e); }
}

module.exports = db;
