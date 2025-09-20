const request = require('supertest');
const app = require('../server');

describe('Graph API', () => {
  it('GET /api/analytics/graph should return nodes and edges', async () => {
    const res = await request(app).get('/api/analytics/graph');
    expect(res.statusCode).toBe(200);
    expect(res.body.nodes).toBeDefined();
    expect(res.body.edges).toBeDefined();
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });
});
