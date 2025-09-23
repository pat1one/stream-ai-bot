const EventEmitter = require('events');
const logger = require('./logger');

class NotificationManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // userId -> Set<WebSocket>
    this.notifications = new Map(); // userId -> Array<Notification>
    this.maxStoredNotifications = 100; // Максимальное количество хранимых уведомлений на пользователя
  }

  // Регистрация клиента для получения уведомлений
  registerClient(userId, ws) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);

    ws.on('close', () => {
      this.unregisterClient(userId, ws);
    });

    // Отправляем непрочитанные уведомления
    const unread = this.getUnreadNotifications(userId);
    if (unread.length > 0) {
      this.sendToClient(ws, {
        type: 'notifications',
        notifications: unread
      });
    }

    logger.logWithContext('info', 'Client registered for notifications', { userId });
  }

  // Отмена регистрации клиента
  unregisterClient(userId, ws) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  // Отправка уведомления конкретному пользователю
  sendNotification(userId, notification) {
    const now = Date.now();
    const fullNotification = {
      id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      read: false,
      ...notification
    };

    // Сохраняем уведомление
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    const userNotifications = this.notifications.get(userId);
    userNotifications.push(fullNotification);

    // Ограничиваем количество хранимых уведомлений
    if (userNotifications.length > this.maxStoredNotifications) {
      userNotifications.splice(0, userNotifications.length - this.maxStoredNotifications);
    }

    // Отправляем всем активным соединениям пользователя
    const userClients = this.clients.get(userId);
    if (userClients) {
      const payload = {
        type: 'notification',
        notification: fullNotification
      };

      userClients.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          this.sendToClient(ws, payload);
        }
      });
    }

    logger.logWithContext('info', 'Notification sent', {
      userId,
      notificationId: fullNotification.id,
      type: notification.type
    });

    return fullNotification;
  }

  // Широковещательная рассылка уведомления всем пользователям
  broadcastNotification(notification) {
    const now = Date.now();
    const broadcastId = `broadcast-${now}-${Math.random().toString(36).substr(2, 9)}`;

    for (const [userId, userClients] of this.clients.entries()) {
      const userNotification = {
        id: `${broadcastId}-${userId}`,
        timestamp: now,
        read: false,
        ...notification
      };

      // Сохраняем для каждого пользователя
      if (!this.notifications.has(userId)) {
        this.notifications.set(userId, []);
      }
      const userNotifications = this.notifications.get(userId);
      userNotifications.push(userNotification);

      // Отправляем активным клиентам
      const payload = {
        type: 'notification',
        notification: userNotification
      };

      userClients.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          this.sendToClient(ws, payload);
        }
      });
    }

    logger.logWithContext('info', 'Broadcast notification sent', {
      broadcastId,
      type: notification.type
    });
  }

  // Получение непрочитанных уведомлений пользователя
  getUnreadNotifications(userId) {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.filter(n => !n.read);
  }

  // Пометить уведомление как прочитанное
  markAsRead(userId, notificationId) {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return false;

    const notification = userNotifications.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.read = true;

    // Уведомляем клиентов о прочтении
    const userClients = this.clients.get(userId);
    if (userClients) {
      const payload = {
        type: 'notification_read',
        notificationId
      };

      userClients.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          this.sendToClient(ws, payload);
        }
      });
    }

    logger.logWithContext('info', 'Notification marked as read', {
      userId,
      notificationId
    });

    return true;
  }

  // Отправка данных клиенту с обработкой ошибок
  sendToClient(ws, data) {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (error) {
      logger.logError(error, {
        event: 'notification_send_failed'
      });
    }
  }

  // Очистка старых уведомлений
  cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней по умолчанию
    const now = Date.now();
    for (const [userId, notifications] of this.notifications.entries()) {
      const filtered = notifications.filter(n => (now - n.timestamp) <= maxAge);
      if (filtered.length !== notifications.length) {
        this.notifications.set(userId, filtered);
        logger.logWithContext('info', 'Old notifications cleaned up', {
          userId,
          removed: notifications.length - filtered.length
        });
      }
    }
  }
}

// Создаем единственный экземпляр менеджера уведомлений
const notificationManager = new NotificationManager();

// Запускаем периодическую очистку старых уведомлений
setInterval(() => {
  notificationManager.cleanup();
}, 24 * 60 * 60 * 1000); // Раз в сутки

module.exports = notificationManager;