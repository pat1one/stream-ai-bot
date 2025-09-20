const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const logger = require('./logger');

// Размер пула соединений
const POOL_SIZE = process.env.DB_POOL_SIZE || 5;

// Время жизни кэша (5 минут)
const CACHE_TTL = 5 * 60 * 1000;

class DbPool {
  constructor() {
    this.connections = [];
    this.available = [];
    this.waiting = [];
    this.cache = new Map();
    this.init();
  }

  async init() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const conn = await this.createConnection();
      this.connections.push(conn);
      this.available.push(conn);
    }
    logger.info(`Database pool initialized with ${POOL_SIZE} connections`);
    
    // Периодическая очистка кэша
    setInterval(() => this.cleanCache(), CACHE_TTL / 2);
  }

  async createConnection() {
    const dbPath = path.join(__dirname, 'data', 'app.db');
    return await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }

  async acquire() {
    if (this.available.length > 0) {
      return this.available.pop();
    }
    
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(conn) {
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      waiter(conn);
    } else {
      this.available.push(conn);
    }
  }

  // Кэширование результатов запросов
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // Метод для выполнения запроса с автоматическим управлением соединением
  async query(sql, params = [], options = {}) {
    const cacheKey = options.cache ? `${sql}:${JSON.stringify(params)}` : null;
    
    if (cacheKey) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const conn = await this.acquire();
    try {
      const start = Date.now();
      const result = params.length > 0 ? 
        await conn.all(sql, params) :
        await conn.all(sql);
      
      const duration = Date.now() - start;
      logger.logWithContext('debug', 'SQL query executed', {
        sql,
        params,
        duration,
        rows: result?.length
      });

      if (cacheKey) {
        this.setCache(cacheKey, result);
      }

      return result;
    } catch (err) {
      logger.logError(err, {
        event: 'database_error',
        sql,
        params
      });
      throw err;
    } finally {
      this.release(conn);
    }
  }

  // Транзакции
  async transaction(callback) {
    const conn = await this.acquire();
    try {
      await conn.run('BEGIN');
      const result = await callback(conn);
      await conn.run('COMMIT');
      return result;
    } catch (err) {
      await conn.run('ROLLBACK');
      throw err;
    } finally {
      this.release(conn);
    }
  }

  // Метод для выполнения запроса без кэширования
  async run(sql, params = []) {
    const conn = await this.acquire();
    try {
      const start = Date.now();
      const result = await conn.run(sql, params);
      
      const duration = Date.now() - start;
      logger.logWithContext('debug', 'SQL run executed', {
        sql,
        params,
        duration,
        changes: result?.changes
      });

      return result;
    } catch (err) {
      logger.logError(err, {
        event: 'database_error',
        sql,
        params
      });
      throw err;
    } finally {
      this.release(conn);
    }
  }

  // Закрыть все соединения при завершении работы
  async close() {
    for (const conn of this.connections) {
      await conn.close();
    }
    this.connections = [];
    this.available = [];
    this.waiting = [];
    this.cache.clear();
    logger.info('Database pool closed');
  }
}

const pool = new DbPool();

// Закрыть пул при завершении приложения
process.on('SIGTERM', async () => {
  await pool.close();
});

module.exports = pool;