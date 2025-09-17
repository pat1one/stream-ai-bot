const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// serve dashboard statics
app.use('/', express.static(path.join(__dirname, 'twitch-bot-dashboard')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const VALID_TOKEN = process.env.EXAMPLE_TOKEN || 'secret-token';

wss.on('connection', (ws) => {
  ws.isAuthed = false;
  ws.send(JSON.stringify({type:'info', text:'Connected to integrated server.'}));
  ws.on('message', (m) => {
    let data = null;
    try { data = JSON.parse(m); } catch(e){ ws.send(JSON.stringify({type:'error', text:'invalid json'})); return; }
    if(data.type === 'auth'){ if(data.token === VALID_TOKEN){ ws.isAuthed = true; ws.send(JSON.stringify({type:'auth', ok:true})); } else ws.send(JSON.stringify({type:'auth', ok:false, reason:'invalid token'})); return; }
    if(!ws.isAuthed){ ws.send(JSON.stringify({type:'error', text:'not authenticated'})); return; }
    if(data.type === 'say'){ console.log('[say]', data.text); ws.send(JSON.stringify({type:'ok', text:'message delivered'})); }
    else if(data.type === 'custom'){ console.log('[custom]', data.cmd, data.text); ws.send(JSON.stringify({type:'ok', text:`custom ${data.cmd} executed`})); }
    else ws.send(JSON.stringify({type:'error', text:'unknown command'}));
  });
});

server.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
