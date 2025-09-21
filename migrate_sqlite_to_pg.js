// Скрипт миграции данных из SQLite в PostgreSQL
// Запуск: node migrate_sqlite_to_pg.js

const path = require('path');
const fs = require('fs');
const sqlite3 = require('better-sqlite3');
const { Pool } = require('pg');

// SQLite
const sqlitePath = path.join(__dirname, 'data', 'app.db');
const sqlite = new sqlite3(sqlitePath);

// PostgreSQL
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_HOST ? { rejectUnauthorized: false } : false
});

async function migrateTable(table, columns, conflict) {
  const rows = sqlite.prepare(`SELECT ${columns.join(',')} FROM ${table}`).all();
  for(const row of rows) {
    const values = columns.map(col => row[col]);
    const placeholders = values.map((_,i) => `$${i+1}`).join(',');
    let sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
    if(conflict) sql += ` ON CONFLICT (${conflict}) DO NOTHING`;
    await pool.query(sql, values);
  }
  console.log(`Migrated ${rows.length} rows from ${table}`);
}

async function main() {
  await migrateTable('commands', ['name','payload'], 'name');
  await migrateTable('users', ['id','username','password','role','email','refresh_token','premium','last_login','activity'], 'username');
  await migrateTable('settings', ['key','value'], 'key');
  await migrateTable('premium_features', ['id','user_id','feature','enabled','created_at'], 'id');
  await migrateTable('managed_channels', ['id','name'], 'name');
  await pool.end();
  console.log('Migration complete!');
}

main().catch(e => { console.error('Migration error:', e); process.exit(1); });
