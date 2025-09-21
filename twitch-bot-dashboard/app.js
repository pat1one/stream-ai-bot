(() => {
  // --- Статистика и графики ---
  const statEls = {
    messages: document.getElementById('statMessages'),
    commands: document.getElementById('statCommands'),
    users: document.getElementById('statUsers'),
    chart: document.getElementById('activityChart')
  };
  let chartInstance = null;
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      if(res.ok) {
        const stats = await res.json();
        statEls.messages.textContent = stats.messages || 0;
        statEls.commands.textContent = stats.commands || 0;
        statEls.users.textContent = stats.activeUsers || 0;
        if(window.Chart && stats.activity) {
          if(chartInstance) chartInstance.destroy();
          chartInstance = new Chart(statEls.chart.getContext('2d'), {
            type: 'line',
            data: { labels: stats.activity.labels, datasets: [{ label: 'Активность', data: stats.activity.data, borderColor: '#36a2eb', fill: false }] },
            options: { responsive: false, plugins: { legend: { display: false } } }
          });
        }
      }
    } catch(e) { statEls.messages.textContent = statEls.commands.textContent = statEls.users.textContent = '—'; }
    // Загрузка логов модерации
    try {
      const res = await fetch('/api/modlogs');
      if(res.ok) {
        const logs = await res.json();
        const modLogsDiv = document.getElementById('modLogs');
        if(modLogsDiv) {
          modLogsDiv.innerHTML = '';
          logs.forEach(l => {
            const div = document.createElement('div');
            div.textContent = `[${l.time}] ${l.action} ${l.target} (${l.reason||''})`;
            modLogsDiv.appendChild(div);
          });
        }
      }
    } catch(e){}
  }
  window.loadStats = loadStats;
  setInterval(loadStats, 60000);
  window.addEventListener('load', () => { loadStats(); });

  // --- Модерация ---
  const modEls = {
    user: document.getElementById('modUser'),
    action: document.getElementById('modAction'),
    reason: document.getElementById('modReason'),
    btn: document.getElementById('modBtn'),
    logs: document.getElementById('modLogs')
  };
  modEls.btn.addEventListener('click', async () => {
    const username = modEls.user.value.trim();
    const action = modEls.action.value;
    const reason = modEls.reason.value.trim();
    if(!username || !action) return;
    if(ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'moderation', action, target: username, reason }));
      const log = `[${new Date().toLocaleTimeString()}] ${action} ${username} (${reason})`;
      const div = document.createElement('div'); div.textContent = log; modEls.logs.appendChild(div); modEls.logs.scrollTop = modEls.logs.scrollHeight;
    } else {
      const div = document.createElement('div'); div.textContent = 'WS не открыт'; modEls.logs.appendChild(div);
    }
  });
  const els = {
    wsUrl: document.getElementById('wsUrl'),
    authToken: document.getElementById('authToken'),
    currentUserDisplay: document.getElementById('currentUser'),
    loginUser: document.getElementById('loginUser'),
    loginPass: document.getElementById('loginPass'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
  copyTokenBtn: document.getElementById('copyTokenBtn'),
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    status: document.getElementById('status'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    sendCommandBtn: document.getElementById('sendCommandBtn'),
    commandSelect: document.getElementById('commandSelect'),
    newCmdName: document.getElementById('newCmdName'),
    newCmdPayload: document.getElementById('newCmdPayload'),
    addCmdBtn: document.getElementById('addCmdBtn'),
    customCmds: document.getElementById('customCmds'),
    logs: document.getElementById('logs'),
  lastResponse: document.getElementById('lastResponse'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    downloadLogsBtn: document.getElementById('downloadLogsBtn'),
    autoReconnect: document.getElementById('autoReconnect'),
    persistLogs: document.getElementById('persistLogs')
  };

  let currentUser = null;

  async function fetchCurrentUser(){
    const token = localStorage.getItem('jwt') || els.authToken.value || '';
    if(!token) { updateUserUI(null); return; }
    try{
      const opts = token && token.startsWith('ey') ? { headers: { Authorization: 'Bearer '+token } } : {};
      const r = await fetch('/api/me', opts);
      if(r.ok){ const u = await r.json(); currentUser = u; updateUserUI(u); } else { currentUser = null; updateUserUI(null); }
    }catch(e){ currentUser = null; updateUserUI(null); }
  }

  function updateUserUI(user){
    if(user){ els.currentUserDisplay.textContent = `${user.username} (${user.role})`; }
    else { els.currentUserDisplay.textContent = 'Not signed in'; }
    // enable/disable add command
    els.addCmdBtn.disabled = !(user && user.role === 'admin');
  }

  let ws = null;
  let reconnectTimeout = null;

  const logLines = [];
  function addLog(line){
    const time = new Date().toLocaleTimeString();
    const text = `[${time}] ${line}`;
    logLines.push(text);
    if(els.persistLogs.checked) localStorage.setItem('botLogs', JSON.stringify(logLines));
    const div = document.createElement('div'); div.textContent = text; els.logs.appendChild(div); els.logs.scrollTop = els.logs.scrollHeight;
  }

  function loadLogs(){
    const saved = localStorage.getItem('botLogs');
    if(saved){
      try{ const arr = JSON.parse(saved); arr.forEach(l => { const d = document.createElement('div'); d.textContent = l; els.logs.appendChild(d); logLines.push(l); }); }
      catch(e){ console.warn('failed load logs', e); }
    }
  }

  const customCommands = {};
  function renderCustoms(){
    els.customCmds.innerHTML = '';
    Object.keys(customCommands).forEach(name => {
      const row = document.createElement('div'); row.className='row';
      const label = document.createElement('div'); label.textContent = name + ' → ' + customCommands[name]; label.style.flex='1';
      const btn = document.createElement('button'); btn.textContent='Send'; btn.style.padding='6px 10px'; btn.addEventListener('click', ()=>{
        const payload = JSON.stringify({type:'custom', cmd:name, text: customCommands[name]}); if(ws && ws.readyState===WebSocket.OPEN){ ws.send(payload); addLog('Custom sent: '+payload);} else addLog('WS not open');
      });
      const del = document.createElement('button'); del.textContent='Del'; del.style.background='#ff6b6b';
      if(!(currentUser && currentUser.role === 'admin')){ del.disabled = true; }
      del.addEventListener('click', ()=>{
        (async ()=>{
          const token = localStorage.getItem('jwt') || els.authToken.value || '';
          const headers = {};
          if(token){ if(token.startsWith('ey')) headers['Authorization'] = 'Bearer ' + token; else headers['x-auth-token'] = token; }
          try{
            const r = await fetch(`/api/commands/${encodeURIComponent(name)}`, { method:'DELETE', headers });
            if(r.ok){ delete customCommands[name]; renderCustoms(); } else { const txt = await r.text().catch(()=>'<no-body>'); addLog('delete failed: '+txt); }
          }catch(e){ addLog('delete error: '+(e && e.message)); }
        })();
      });
      row.appendChild(label); row.appendChild(btn); row.appendChild(del); els.customCmds.appendChild(row);
    });
  }

  async function persistCustoms(){
    const token = localStorage.getItem('jwt') || els.authToken.value || '';
    const headers = {'Content-Type':'application/json'};
    if(token && token.startsWith('ey')) headers['Authorization'] = 'Bearer ' + token; else if(token) headers['x-auth-token'] = token;
    try{
      for(const name of Object.keys(customCommands)){
        await fetch(`/api/commands`, { method:'POST', headers, body: JSON.stringify({name, payload: customCommands[name]}) });
      }
    }catch(e){ console.warn('persist failed', e); }
  }

  async function loadCustoms(){
    const token = localStorage.getItem('jwt') || els.authToken.value || '';
    try{
      const url = token && !token.startsWith('ey') ? `/api/commands?token=${encodeURIComponent(token)}` : '/api/commands';
      const opts = token && token.startsWith('ey') ? { headers: { Authorization: 'Bearer '+token } } : {};
      const res = await fetch(url, opts);
      if(res.ok){ const obj = await res.json(); Object.assign(customCommands, obj); renderCustoms(); }
    }catch(e){ console.warn(e); }
  }

    // Settings
    const loadSettings = async () => {
      const token = localStorage.getItem('jwt') || els.authToken.value || '';
      const opts = {};
      if(token && token.startsWith('ey')) opts.headers = { Authorization: 'Bearer '+token };
      try{
        const res = await fetch('/api/settings', opts);
        if(res.ok){ const s = await res.json(); if(typeof s.autoReconnect !== 'undefined') els.autoReconnect.checked = !!s.autoReconnect; if(typeof s.persistLogs !== 'undefined') els.persistLogs.checked = !!s.persistLogs; addLog('Settings loaded'); }
        else addLog('failed load settings');
      }catch(e){ addLog('load settings error: '+(e&&e.message)); }
    };

    const saveSettings = async () => {
      const token = localStorage.getItem('jwt') || els.authToken.value || '';
      const headers = {'Content-Type':'application/json'};
      if(token){ if(token.startsWith('ey')) headers['Authorization'] = 'Bearer ' + token; else headers['x-auth-token'] = token; }
      const body = { autoReconnect: !!els.autoReconnect.checked, persistLogs: !!els.persistLogs.checked };
      try{
        const res = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(body) });
        if(res.ok) addLog('Settings saved'); else { const txt = await res.text().catch(()=>'<no-body>'); addLog('save settings failed: '+txt); }
      }catch(e){ addLog('save settings error: '+(e&&e.message)); }
    };

  function setStatus(connected){
    els.status.textContent = connected ? 'Подключено' : 'Отключено';
    els.status.classList.toggle('connected', connected);
    els.status.classList.toggle('disconnected', !connected);
    els.connectBtn.disabled = connected;
    els.disconnectBtn.disabled = !connected;
    els.sendBtn.disabled = !connected;
    els.sendCommandBtn.disabled = !connected;
  }

  function connect(){
  const url = els.wsUrl.value || 'ws://localhost:3000';
    addLog('Попытка подключения к ' + url);
    ws = new WebSocket(url);
    ws.addEventListener('open', () => { addLog('WS открыт'); setStatus(true);
      const token = (els.authToken && els.authToken.value) ? els.authToken.value.trim() : null;
      if(token){ const authMsg = JSON.stringify({type:'auth', token}); ws.send(authMsg); addLog('Отправлен auth token'); }
    });
    ws.addEventListener('close', (e) => { addLog('WS закрыт'); setStatus(false); ws = null; if(els.autoReconnect.checked) scheduleReconnect(); });
  ws.addEventListener('error', (e) => { addLog('WS ошибка: ' + (e && e.message) ); });
  ws.addEventListener('message', (m) => { addLog('Получено: ' + m.data); try{ els.lastResponse.textContent = typeof m.data === 'string' ? m.data : JSON.stringify(m.data); }catch(e){} });
  }

  function scheduleReconnect(){
    if(reconnectTimeout) return;
    addLog('Запланировано переподключение через 3 сек');
    reconnectTimeout = setTimeout(() => { reconnectTimeout = null; connect(); }, 3000);
  }

  function disconnect(){ if(ws){ ws.close(); ws = null; setStatus(false); addLog('Отключено вручную'); } }

  function sendMessage(){
    const text = els.messageInput.value.trim(); if(!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({type:'say', text});
    ws.send(payload); addLog('Отправлено: ' + payload); els.messageInput.value = '';
  }

  function sendCommand(){
    const cmd = els.commandSelect.value; const text = els.messageInput.value.trim(); if(!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({type:cmd, text}); ws.send(payload); addLog('Команда отправлена: ' + payload); els.messageInput.value = '';
  }

  function clearLogs(){ els.logs.innerHTML=''; logLines.length=0; localStorage.removeItem('botLogs'); }

  function downloadLogs(){
    const blob = new Blob([logLines.join('\n')], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bot-logs-${Date.now()}.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // custom commands wireup
  els.addCmdBtn.addEventListener('click', async ()=>{
    const name = (els.newCmdName.value||'').trim(); const payload = (els.newCmdPayload.value||'').trim(); if(!name || !payload) return;
    const token = localStorage.getItem('jwt') || els.authToken.value || '';
    const headers = {'Content-Type':'application/json'};
    if(token){ if(token.startsWith('ey')) headers['Authorization'] = 'Bearer ' + token; else headers['x-auth-token'] = token; }
    try{
      const r = await fetch('/api/commands', { method:'POST', headers, body: JSON.stringify({name, payload}) });
      if(r.ok){ customCommands[name]=payload; els.newCmdName.value=''; els.newCmdPayload.value=''; renderCustoms(); addLog('Command added: '+name); }
      else { const txt = await r.text().catch(()=>'<no-body>'); addLog('failed add command: '+txt); }
    }catch(e){ addLog('add error: '+(e && e.message)); }
  });

  // login / register
  els.loginBtn.addEventListener('click', async ()=>{
      const user = (els.loginUser.value||'').trim(); const pass = els.loginPass.value||''; if(!user || !pass) return;
      try{
        const r = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username: user, password: pass}) });
        if(r.ok){
          const data = await r.json();
          if(data && data.token){
            localStorage.setItem('jwt', data.token);
            els.authToken.value = data.token;
            if(data.refresh_token) {
              localStorage.setItem('refresh_token', data.refresh_token);
              addLog('Refresh token сохранён');
            }
            addLog('Login successful');
            await loadCustoms();
            await fetchCurrentUser();
          } else addLog('login: no token');
        }
        else { const txt = await r.text().catch(()=>'<no-body>'); addLog('login failed: '+txt); }
      }catch(e){ addLog('login error: '+(e && e.message)); }
    });

  els.registerBtn.addEventListener('click', async ()=>{
      const user = (els.loginUser.value||'').trim(); const pass = els.loginPass.value||''; if(!user || !pass) return;
      try{
        const r = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username: user, password: pass}) });
        if(r.ok){
          const data = await r.json();
          if(data && data.token){
            localStorage.setItem('jwt', data.token);
            els.authToken.value = data.token;
            if(data.refresh_token) {
              localStorage.setItem('refresh_token', data.refresh_token);
              addLog('Refresh token сохранён');
            }
            addLog('Registered and logged in');
            await loadCustoms();
            await fetchCurrentUser();
          } else addLog('register: no token');
        }
        else { const txt = await r.text().catch(()=>'<no-body>'); addLog('register failed: '+txt); }
      }catch(e){ addLog('register error: '+(e && e.message)); }
    });

  els.copyTokenBtn.addEventListener('click', ()=>{
    try{ navigator.clipboard.writeText(els.authToken.value||''); addLog('Token copied to clipboard'); }catch(e){ addLog('Copy failed'); }
  });


  // wire events
  els.connectBtn.addEventListener('click', connect);
  els.disconnectBtn.addEventListener('click', disconnect);
  els.sendBtn.addEventListener('click', sendMessage);
  els.sendCommandBtn.addEventListener('click', sendCommand);
    // settings buttons
    els.loadSettingsBtn = document.getElementById('loadSettingsBtn');
    els.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    els.loadSettingsBtn.addEventListener('click', loadSettings);
    els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.clearLogsBtn.addEventListener('click', clearLogs);
  els.downloadLogsBtn.addEventListener('click', downloadLogs);
  els.persistLogs.addEventListener('change', () => { if(!els.persistLogs.checked) localStorage.removeItem('botLogs'); });

  // enable enter to send
  els.messageInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') sendMessage(); });

  // load saved UI state
  window.addEventListener('load', () => {
    els.wsUrl.value = localStorage.getItem('wsUrl') || 'ws://localhost:3000';
    els.autoReconnect.checked = localStorage.getItem('autoReconnect') === '1';
    els.persistLogs.checked = localStorage.getItem('persistLogs') === '1';
    els.authToken.value = localStorage.getItem('jwt') || localStorage.getItem('authToken') || '';

    // Автовход: если есть токен, сразу авторизуем пользователя и подключаемся к WS
    if(els.authToken.value) {
      fetchCurrentUser().then(() => {
        if(currentUser) {
          loadCustoms();
          connect(); // авто-подключение к WebSocket
          addLog('Автовход выполнен: ' + currentUser.username);
        } else {
          addLog('Токен истёк или недействителен, требуется повторный вход');
          els.currentUserDisplay.textContent = 'Требуется повторный вход';
        }
      });
    }
    if(els.persistLogs.checked) loadLogs();
    setStatus(false);
  });

  // Периодическая синхронизация сессии через /api/session
  setInterval(async () => {
    const token = localStorage.getItem('jwt') || localStorage.getItem('authToken') || '';
    if(!token) return;
    try {
      const opts = token.startsWith('ey') ? { headers: { Authorization: 'Bearer '+token } } : {};
      const r = await fetch('/api/session', opts);
      if(r.ok) {
        const u = await r.json();
        if(!currentUser || currentUser.username !== u.username) {
          currentUser = u;
          updateUserUI(u);
          addLog('Сессия синхронизирована: ' + u.username);
        }
      } else {
        currentUser = null;
        updateUserUI(null);
        addLog('Сессия истекла, попытка автообновления токена...');
        // Попытка автообновления токена через /api/refresh
        const refreshToken = localStorage.getItem('refresh_token');
        if(refreshToken) {
          try {
            const resp = await fetch('/api/refresh', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({refresh_token: refreshToken})
            });
            if(resp.ok) {
              const data = await resp.json();
              if(data.token) {
                localStorage.setItem('jwt', data.token);
                els.authToken.value = data.token;
                if(data.refresh_token) {
                  localStorage.setItem('refresh_token', data.refresh_token);
                  addLog('Refresh token обновлён');
                }
                addLog('Токен успешно обновлён');
                fetchCurrentUser();
                loadCustoms();
                return;
              }
            } else {
              addLog('Не удалось обновить токен, требуется повторный вход');
              els.currentUserDisplay.textContent = 'Требуется повторный вход';
            }
          } catch(e) {
            addLog('Ошибка автообновления токена: ' + (e && e.message));
          }
        } else {
          addLog('Нет refresh_token, требуется повторный вход');
          els.currentUserDisplay.textContent = 'Требуется повторный вход';
        }
      }
    } catch(e) {
      addLog('Ошибка синхронизации сессии: ' + (e && e.message));
    }
  }, 300000); // каждые 5 минут

  // Автообновление UI при смене токена
  window.addEventListener('storage', (e) => {
    if(e.key === 'jwt' || e.key === 'authToken') {
      els.authToken.value = localStorage.getItem('jwt') || localStorage.getItem('authToken') || '';
      fetchCurrentUser();
      loadCustoms();
      addLog('Токен обновлён, UI перезагружен');
    }
  });
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('wsUrl', els.wsUrl.value);
    localStorage.setItem('autoReconnect', els.autoReconnect.checked ? '1' : '0');
    localStorage.setItem('persistLogs', els.persistLogs.checked ? '1' : '0');
    localStorage.setItem('authToken', els.authToken.value || '');
  });

})();
