const notificationManager = require('../notifications');

describe('NotificationManager', () => {
  beforeEach(() => {
    notificationManager.notifications.clear();
    notificationManager.clients.clear();
  });

  test('send and get unread notifications', () => {
    const userId = 'user1';
    const notif = notificationManager.sendNotification(userId, { type: 'info', message: 'Test' });
    const unread = notificationManager.getUnreadNotifications(userId);
    expect(unread.length).toBe(1);
    expect(unread[0].id).toBe(notif.id);
    expect(unread[0].read).toBe(false);
  });

  test('mark notification as read', () => {
    const userId = 'user2';
    const notif = notificationManager.sendNotification(userId, { type: 'info', message: 'Test2' });
    const success = notificationManager.markAsRead(userId, notif.id);
    expect(success).toBe(true);
    const unread = notificationManager.getUnreadNotifications(userId);
    expect(unread.length).toBe(0);
  });
});
