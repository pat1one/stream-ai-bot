
// PostgreSQL migration for Render
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_HOST ? { rejectUnauthorized: false } : false
});

// Helper for queries
const db = {
  query: (text, params) => pool.query(text, params),
  get: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  },
  all: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  },
  run: async (text, params) => {
    await pool.query(text, params);
  }
};

// Create tables if not exist
async function migrate() {
  await db.run(`CREATE TABLE IF NOT EXISTS commands (
    name TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );`);
  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    email TEXT,
    refresh_token TEXT,
    premium INTEGER DEFAULT 0,
    last_login TEXT,
    activity INTEGER DEFAULT 0
  );`);
  await db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );`);
  await db.run(`CREATE TABLE IF NOT EXISTS premium_features (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    feature TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );`);
  await db.run(`CREATE TABLE IF NOT EXISTS managed_channels (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );`);
}
migrate().catch(e => console.error('Migration error:', e));

module.exports = db;
