const metrics = require('../metrics');

describe('Metrics', () => {
  test('collects system metrics', () => {
    const snapshot = metrics.collectMetrics();
    expect(snapshot).toHaveProperty('uptime');
    expect(snapshot).toHaveProperty('memory');
    expect(snapshot).toHaveProperty('cpu');
    expect(snapshot).toHaveProperty('system');
    expect(snapshot).toHaveProperty('requests');
    expect(snapshot).toHaveProperty('websocket');
  });

  test('tracks HTTP requests', () => {
    const req = { method: 'GET', route: { path: '/test' }, path: '/test' };
    const res = { statusCode: 200 };
    metrics.trackRequest(req, res, 123);
    const snapshot = metrics.collectMetrics();
    expect(snapshot.requests.total).toBeGreaterThan(0);
  });
});
