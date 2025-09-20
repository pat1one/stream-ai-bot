const os = require('os');
const logger = require('./logger');

class Metrics {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.wsConnections = new Set();
    this.requestMetrics = {
      total: 0,
      success: 0,
      errors: 0,
      byEndpoint: new Map(),
      responseTime: []
    };
    this.wsMetrics = {
      totalConnections: 0,
      currentConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };
  }

  // Система метрик
  initializeMetrics() {
    // Базовые метрики
    this.metrics.set('uptime', () => {
      return (Date.now() - this.startTime) / 1000;
    });

    this.metrics.set('memory', () => {
      const used = process.memoryUsage();
      return {
        heapTotal: used.heapTotal / 1024 / 1024,
        heapUsed: used.heapUsed / 1024 / 1024,
        rss: used.rss / 1024 / 1024,
        external: used.external / 1024 / 1024
      };
    });

    this.metrics.set('cpu', () => {
      const cpus = os.cpus();
      const avgLoad = os.loadavg();
      return {
        cores: cpus.length,
        model: cpus[0].model,
        speed: cpus[0].speed,
        loadAvg1m: avgLoad[0],
        loadAvg5m: avgLoad[1],
        loadAvg15m: avgLoad[2]
      };
    });

    this.metrics.set('system', () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: os.uptime(),
        freeMemory: os.freemem() / 1024 / 1024,
        totalMemory: os.totalmem() / 1024 / 1024
      };
    });

    this.metrics.set('requests', () => {
      return {
        ...this.requestMetrics,
        avgResponseTime: this.calculateAverageResponseTime()
      };
    });

    this.metrics.set('websocket', () => {
      return this.wsMetrics;
    });

    // Начинаем периодический сбор метрик
    this.startMetricsCollection();
  }

  // Периодический сбор метрик
  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Каждую минуту
  }

  // Сбор текущих значений метрик
  collectMetrics() {
    const snapshot = {};
    for (const [key, getter] of this.metrics) {
      try {
        snapshot[key] = getter();
      } catch (error) {
        logger.logError(error, {
          event: 'metrics_collection_error',
          metric: key
        });
      }
    }

    // Сохраняем снимок метрик
    this.saveMetricsSnapshot(snapshot);

    return snapshot;
  }

  // Сохранение снимка метрик
  saveMetricsSnapshot(snapshot) {
    // Здесь можно добавить сохранение в БД или отправку в систему мониторинга
    logger.logWithContext('debug', 'Metrics snapshot collected', {
      event: 'metrics_snapshot',
      metrics: snapshot
    });
  }

  // HTTP метрики
  trackRequest(req, res, responseTime) {
    this.requestMetrics.total++;
    
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    if (!this.requestMetrics.byEndpoint.has(endpoint)) {
      this.requestMetrics.byEndpoint.set(endpoint, {
        total: 0,
        success: 0,
        errors: 0,
        responseTime: []
      });
    }

    const endpointMetrics = this.requestMetrics.byEndpoint.get(endpoint);
    endpointMetrics.total++;

    if (res.statusCode >= 400) {
      this.requestMetrics.errors++;
      endpointMetrics.errors++;
    } else {
      this.requestMetrics.success++;
      endpointMetrics.success++;
    }

    this.requestMetrics.responseTime.push(responseTime);
    endpointMetrics.responseTime.push(responseTime);

    // Ограничиваем размер массивов времени отклика
    if (this.requestMetrics.responseTime.length > 1000) {
      this.requestMetrics.responseTime.shift();
    }
    if (endpointMetrics.responseTime.length > 1000) {
      endpointMetrics.responseTime.shift();
    }
  }

  // WebSocket метрики
  trackWebSocketConnection(ws) {
    this.wsMetrics.totalConnections++;
    this.wsMetrics.currentConnections++;
    this.wsConnections.add(ws);

    ws.on('message', () => {
      this.wsMetrics.messagesReceived++;
    });

    ws.on('close', () => {
      this.wsMetrics.currentConnections--;
      this.wsConnections.delete(ws);
    });

    ws.on('error', () => {
      this.wsMetrics.errors++;
    });
  }

  trackWebSocketMessage(outgoing = false) {
    if (outgoing) {
      this.wsMetrics.messagesSent++;
    } else {
      this.wsMetrics.messagesReceived++;
    }
  }

  // Вспомогательные функции
  calculateAverageResponseTime() {
    if (this.requestMetrics.responseTime.length === 0) return 0;
    const sum = this.requestMetrics.responseTime.reduce((a, b) => a + b, 0);
    return sum / this.requestMetrics.responseTime.length;
  }

  // Получение метрик в формате Prometheus
  getPrometheusMetrics() {
    const metrics = [];
    const snapshot = this.collectMetrics();

    // Базовые метрики
    metrics.push(`# HELP process_uptime_seconds The uptime of the process in seconds`);
    metrics.push(`# TYPE process_uptime_seconds counter`);
    metrics.push(`process_uptime_seconds ${snapshot.uptime}`);

    // Метрики памяти
    const memory = snapshot.memory;
    Object.entries(memory).forEach(([key, value]) => {
      metrics.push(`# HELP process_memory_${key}_mb Memory usage in MB`);
      metrics.push(`# TYPE process_memory_${key}_mb gauge`);
      metrics.push(`process_memory_${key}_mb ${value}`);
    });

    // Метрики HTTP запросов
    metrics.push(`# HELP http_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    metrics.push(`http_requests_total ${this.requestMetrics.total}`);

    metrics.push(`# HELP http_request_errors_total Total number of HTTP request errors`);
    metrics.push(`# TYPE http_request_errors_total counter`);
    metrics.push(`http_request_errors_total ${this.requestMetrics.errors}`);

    metrics.push(`# HELP http_request_duration_seconds HTTP request duration in seconds`);
    metrics.push(`# TYPE http_request_duration_seconds gauge`);
    metrics.push(`http_request_duration_seconds ${this.calculateAverageResponseTime() / 1000}`);

    // WebSocket метрики
    metrics.push(`# HELP websocket_connections_current Current number of WebSocket connections`);
    metrics.push(`# TYPE websocket_connections_current gauge`);
    metrics.push(`websocket_connections_current ${this.wsMetrics.currentConnections}`);

    metrics.push(`# HELP websocket_connections_total Total number of WebSocket connections`);
    metrics.push(`# TYPE websocket_connections_total counter`);
    metrics.push(`websocket_connections_total ${this.wsMetrics.totalConnections}`);

    metrics.push(`# HELP websocket_messages_total Total number of WebSocket messages`);
    metrics.push(`# TYPE websocket_messages_total counter`);
    metrics.push(`websocket_messages_sent_total ${this.wsMetrics.messagesSent}`);
    metrics.push(`websocket_messages_received_total ${this.wsMetrics.messagesReceived}`);

    return metrics.join('\n') + '\n';
  }
}

// Создаем единственный экземпляр для всего приложения
const metrics = new Metrics();
metrics.initializeMetrics();

module.exports = metrics;