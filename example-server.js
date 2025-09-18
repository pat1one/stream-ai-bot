// Простая тестовая WebSocket-служба для локальной разработки
// Запуск: `node example-server.js`

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 }, () => console.log('WS server listening on ws://localhost:8080'));

// Простая in-memory auth token (для примера)
const VALID_TOKEN = 'secret-token';

wss.on('connection', (ws) => {
  ws.isAuthed = false;
  ws.send(JSON.stringify({type:'info', text:'Welcome. Send {type:"auth", token:"..."} to authenticate.'}));

  ws.on('message', (msg) => {
    let data = null;
    try { data = JSON.parse(msg); } catch(e){ ws.send(JSON.stringify({type:'error', text:'invalid json'})); return; }

    if(data.type === 'auth'){
      if(data.token === VALID_TOKEN){ ws.isAuthed = true; ws.send(JSON.stringify({type:'auth', ok:true})); }
      else ws.send(JSON.stringify({type:'auth', ok:false, reason:'invalid token'}));
      return;
    }

    if(!ws.isAuthed){ ws.send(JSON.stringify({type:'error', text:'not authenticated'})); return; }

    switch(data.type){
      case 'say':
        console.log('[say]', data.text);
        ws.send(JSON.stringify({type:'ok', text:'message delivered'}));
        break;
      case 'custom':
        console.log('[custom]', data.cmd, data.text);
        ws.send(JSON.stringify({type:'ok', text:`custom ${data.cmd} executed`}));
        break;
      default:
        console.log('[unknown]', data);
        ws.send(JSON.stringify({type:'error', text:'unknown command'}));
    }
  });
});
