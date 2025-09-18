const WebSocket = require('ws');

const url = process.env.WS_URL || 'ws://localhost:3000';
const token = process.env.TEST_TOKEN || 'secret-token';

const ws = new WebSocket(url);
ws.on('open', () => {
  console.log('connected');
  ws.send(JSON.stringify({type:'auth', token}));
  setTimeout(()=>{
    ws.send(JSON.stringify({type:'say', text:'Hello from test-client'}));
    setTimeout(()=>{ ws.close(); }, 500);
  }, 300);
});
ws.on('message', (m)=>{ console.log('server:', m.toString()); });
ws.on('close', ()=>{ console.log('closed'); process.exit(0); });
ws.on('error', (e)=>{ console.error('err', e); process.exit(1); });
