const webhookManager = require('../webhooks');

describe('WebhookManager', () => {
  beforeEach(() => {
    webhookManager.webhooks.clear();
  });

  test('register and list webhooks', () => {
    const id = webhookManager.register({ url: 'http://localhost:9999/test', events: ['notification'], secret: 'abc' });
    const list = webhookManager.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id);
    expect(list[0].url).toBe('http://localhost:9999/test');
  });

  test('unregister webhook', () => {
    const id = webhookManager.register({ url: 'http://localhost:9999/test2', events: [], secret: '' });
    expect(webhookManager.list().length).toBe(1);
    const ok = webhookManager.unregister(id);
    expect(ok).toBe(true);
    expect(webhookManager.list().length).toBe(0);
  });
});
