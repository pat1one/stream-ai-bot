// --- WebSocket сервер для real-time аналитики ---
const WebSocket = require('ws');
let wss;
function initWebSocket(httpServer) {
  wss = new WebSocket.Server({ server: httpServer });
  wss.on('connection', ws => {
    ws.on('message', msg => {
      ws.send(JSON.stringify({ type: 'pong', msg }));
    });
    ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  });
}
function broadcastAnalyticsUpdate(data) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'analytics-update', data }));
    }
  });
}
module.exports = { initWebSocket, broadcastAnalyticsUpdate };
