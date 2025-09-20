// Импорты наверх
import NotificationClient, { renderNotificationStatsSection } from './notifications.js';
import { t } from './i18n.js';
import config from './dashboard-config.js';

// ... (DOM utils and els definition remain unchanged)


// RBAC UI: назначение роли пользователю (feature-flag)
if (config.enableRbac && els.rbacSetRoleBtn) {
  els.rbacSetRoleBtn.addEventListener('click', async () => {
    const userId = (els.rbacUserId.value || '').trim();
    const role = els.rbacRole.value;
    if (!userId || !role) {
      els.rbacStatus.textContent = 'Укажите ID пользователя и роль';
      return;
    }
    try {
      const token = localStorage.getItem('jwt') || els.authToken.value || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token && token.startsWith('ey')) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(`${config.apiBaseUrl}/rbac/role/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        els.rbacStatus.textContent = 'Роль успешно назначена';
      } else {
        const txt = await res.text().catch(() => '<no-body>');
        els.rbacStatus.textContent = 'Ошибка: ' + txt;
      }
    } catch (e) {
      els.rbacStatus.textContent = 'Ошибка: ' + (e && e.message);
    }
  });
}

// OAuth/SSO: показать кнопки если включено в конфиге
const oauthButtons = document.getElementById('oauthButtons');
if (oauthButtons) {
  if (config.enableOAuth) {
    oauthButtons.style.display = 'flex';
  } else {
    oauthButtons.style.display = 'none';
  }
}
  function renderLogs() {
    let list = logLines.slice();
    const filter = (els.logFilter && els.logFilter.value) ? els.logFilter.value.toLowerCase() : '';
    if (filter) list = list.filter(l => l.toLowerCase().includes(filter));
    if (els.logSort && els.logSort.value === 'asc') list = list.slice().reverse();
    els.logs.innerHTML = '';
    for (const line of list) {
      const div = document.createElement('div');
      div.textContent = line;
      els.logs.appendChild(div);
    }
    els.logs.scrollTop = els.logs.scrollHeight;
  }

  if (els.notifFilter) els.notifFilter.addEventListener('input', renderNotifications);
  if (els.notifSort) els.notifSort.addEventListener('change', renderNotifications);
  if (els.logFilter) els.logFilter.addEventListener('input', renderLogs);
  if (els.logSort) els.logSort.addEventListener('change', renderLogs);
import NotificationClient from './notifications.js';
import { t } from './i18n.js';

// Утилиты для работы с DOM
const dom = {
  get: id => document.getElementById(id),
  create: tag => document.createElement(tag),
  append: (parent, child) => parent.appendChild(child)
};

const els = {
    wsUrl: dom.get('wsUrl'),
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
    persistLogs: document.getElementById('persistLogs'),

  notifications: document.getElementById('notifications'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  notifFilter: document.getElementById('notifFilter'),
  notifSort: document.getElementById('notifSort'),
  logFilter: document.getElementById('logFilter'),
  logSort: document.getElementById('logSort'),
  langSelect: document.getElementById('langSelect'),
  rbacUserId: document.getElementById('rbacUserId'),
  rbacRole: document.getElementById('rbacRole'),
  rbacSetRoleBtn: document.getElementById('rbacSetRoleBtn'),
  rbacStatus: document.getElementById('rbacStatus')
};

let lang = localStorage.getItem('lang') || 'ru';
if (els.langSelect) {
  els.langSelect.value = lang;
  els.langSelect.addEventListener('change', () => {
    lang = els.langSelect.value;
    localStorage.setItem('lang', lang);
    applyTranslations();
  });
}
function applyTranslations() {
  document.title = 'Stream AI Bot — ' + t('Dashboard', lang);
  if (els.themeToggleBtn) els.themeToggleBtn.title = t('Theme', lang);
  if (els.loginBtn) els.loginBtn.textContent = t('Login', lang);
  if (els.registerBtn) els.registerBtn.textContent = t('Register', lang);
  if (els.clearLogsBtn) els.clearLogsBtn.textContent = t('Clear logs', lang);
  if (els.downloadLogsBtn) els.downloadLogsBtn.textContent = t('Download logs', lang);
  // ...добавьте остальные элементы по необходимости
}
applyTranslations();

  let currentUser = null;
  let notificationsCache = [];

  // --- Theme toggle ---
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (els.themeToggleBtn) els.themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
  if (els.themeToggleBtn) {
    els.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
    // Init theme on load
    setTheme(localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }

  async function fetchCurrentUser(){
    const token = localStorage.getItem('jwt') || els.authToken.value || '';
    if(!token) { updateUserUI(null); return; }
    try{
      const opts = token && token.startsWith('ey') ? { headers: { Authorization: 'Bearer '+token } } : {};
      const r = await fetch('/api/me', opts);
      if(r.ok){ const u = await r.json(); currentUser = u; updateUserUI(u); } else { currentUser = null; updateUserUI(null); }
    }catch(e){ currentUser = null; updateUserUI(null); }
  }

  function renderNotifications() {
    let list = notificationsCache.slice();
    const filter = (els.notifFilter && els.notifFilter.value) ? els.notifFilter.value.toLowerCase() : '';
    if (filter) list = list.filter(n => (n.title||'').toLowerCase().includes(filter) || (n.message||'').toLowerCase().includes(filter));
    if (els.notifSort && els.notifSort.value === 'asc') list.sort((a,b)=>a.timestamp-b.timestamp); else list.sort((a,b)=>b.timestamp-a.timestamp);
    els.notifications.innerHTML = '';
    for (const notification of list) {
      const notificationEl = document.createElement('div');
      notificationEl.className = 'notification' + (notification.read ? ' read' : '');
      notificationEl.id = `notification-${notification.id}`;
      const title = document.createElement('div');
      title.className = 'notification-title';
      title.textContent = notification.title || 'New Notification';
      const message = document.createElement('div');
      message.className = 'notification-message';
      message.textContent = notification.message;
      const time = document.createElement('div');
      time.className = 'notification-time';
      time.textContent = new Date(notification.timestamp).toLocaleString();
      const markRead = document.createElement('button');
      markRead.textContent = 'Mark as Read';
      markRead.onclick = () => { notificationClient.markAsRead(notification.id); };
      notificationEl.appendChild(title);
      notificationEl.appendChild(message);
      notificationEl.appendChild(time);
      notificationEl.appendChild(markRead);
      els.notifications.appendChild(notificationEl);
    }
  }

  function initNotifications() {
    if (!currentUser) return;
    const wsUrl = els.wsUrl.value.replace('ws://', 'wss://');
    const token = localStorage.getItem('jwt') || els.authToken.value;
    notificationClient = new NotificationClient(wsUrl, token);
    notificationClient.onNotification = (notification) => {
      notificationsCache = notificationsCache.filter(n => n.id !== notification.id);
      notificationsCache.push(notification);
      renderNotifications();
      addLog(`Notification received: ${notification.title}`);
    };
    notificationClient.onNotificationRead = (notificationId) => {
      notificationsCache = notificationsCache.map(n => n.id === notificationId ? { ...n, read: true } : n);
      renderNotifications();
      addLog(`Notification ${notificationId} marked as read`);
    };
    notificationClient.connect();
  }
  
  // Очистка уведомлений
  function cleanupNotifications() {
    if (notificationClient) {
      notificationClient.disconnect();
      notificationClient = null;
    }
    notificationsCache = [];
    renderNotifications();
  }
  function renderLogs() {
    let list = logLines.slice();
    const filter = (els.logFilter && els.logFilter.value) ? els.logFilter.value.toLowerCase() : '';
    if (filter) list = list.filter(l => l.toLowerCase().includes(filter));
    if (els.logSort && els.logSort.value === 'asc') list = list.slice().reverse();
    els.logs.innerHTML = '';
    for (const line of list) {
      const div = document.createElement('div');
      div.textContent = line;
      els.logs.appendChild(div);
    }
    els.logs.scrollTop = els.logs.scrollHeight;
  }
  function addLog(line){
    const time = new Date().toLocaleTimeString();
    const text = `[${time}] ${line}`;
    logLines.push(text);
    if(els.persistLogs.checked) localStorage.setItem('botLogs', JSON.stringify(logLines));
    renderLogs();
  }

  function loadLogs(){
    const saved = localStorage.getItem('botLogs');
    if(saved){
      try{ const arr = JSON.parse(saved); arr.forEach(l => { logLines.push(l); }); }
      catch(e){ console.warn('failed load logs', e); }
    }
    renderLogs();
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
  if(r.ok){ const data = await r.json(); if(data && data.token){ localStorage.setItem('jwt', data.token); els.authToken.value = data.token; addLog('Login successful'); await loadCustoms(); await fetchCurrentUser(); } else addLog('login: no token'); }
      else { const txt = await r.text().catch(()=>'<no-body>'); addLog('login failed: '+txt); }
    }catch(e){ addLog('login error: '+(e && e.message)); }
  });

  els.registerBtn.addEventListener('click', async ()=>{
    const user = (els.loginUser.value||'').trim(); const pass = els.loginPass.value||''; if(!user || !pass) return;
    try{
      const r = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username: user, password: pass}) });
  if(r.ok){ const data = await r.json(); if(data && data.token){ localStorage.setItem('jwt', data.token); els.authToken.value = data.token; addLog('Registered and logged in'); await loadCustoms(); await fetchCurrentUser(); } else addLog('register: no token'); }
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
  if (els.notifFilter) els.notifFilter.addEventListener('input', renderNotifications);
  if (els.notifSort) els.notifSort.addEventListener('change', renderNotifications);
  if (els.logFilter) els.logFilter.addEventListener('input', renderLogs);
  if (els.logSort) els.logSort.addEventListener('change', renderLogs);

  // enable enter to send
  els.messageInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') sendMessage(); });

  // load saved UI state
  window.addEventListener('load', () => {
  els.wsUrl.value = localStorage.getItem('wsUrl') || 'ws://localhost:3000';
    els.autoReconnect.checked = localStorage.getItem('autoReconnect') === '1';
    els.persistLogs.checked = localStorage.getItem('persistLogs') === '1';
    els.authToken.value = localStorage.getItem('authToken') || '';
    loadCustoms();
    if(els.persistLogs.checked) loadLogs();
    setStatus(false);
    fetchCurrentUser();
    // Инициализация секции статистики уведомлений
    if (typeof renderNotificationStatsSection === 'function') {
      renderNotificationStatsSection();
    }
  });
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('wsUrl', els.wsUrl.value);
    localStorage.setItem('autoReconnect', els.autoReconnect.checked ? '1' : '0');
    localStorage.setItem('persistLogs', els.persistLogs.checked ? '1' : '0');
    localStorage.setItem('authToken', els.authToken.value || '');
  });


// --- Monitoring: metrics and logs ---
window.addEventListener('DOMContentLoaded', () => {
  const metricsChartEl = document.getElementById('metricsChart');
  const refreshMetricsBtn = document.getElementById('refreshMetricsBtn');
  const monitoringLogsEl = document.getElementById('monitoringLogs');
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  let metricsChart = null;

  async function fetchMetrics() {
    try {
      const res = await fetch('/metrics');
      const text = await res.text();
      // Парсим Prometheus-метрики
      const data = {};
      text.split('\n').forEach(line => {
        if (line.startsWith('#') || !line.trim()) return;
        const [key, value] = line.split(/\s+/);
        data[key] = parseFloat(value);
      });
      // Визуализируем: память, CPU, соединения
      const labels = ['heapUsed', 'rss', 'loadAvg1m', 'wsConn'];
      const values = [
        data['process_memory_heapUsed_mb'],
        data['process_memory_rss_mb'],
        data['process_cpu_loadAvg1m'] || data['process_cpu_loadAvg1m'],
        data['websocket_connections_current']
      ];
      if (!metricsChart) {
        metricsChart = new Chart(metricsChartEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Heap Used (MB)', 'RSS (MB)', 'CPU Load 1m', 'WS Connections'],
            datasets: [{ label: 'Metrics', data: values, backgroundColor: ['#4bc0c0','#36a2eb','#ffcd56','#ff6384'] }]
          },
          options: { responsive: false, plugins: { legend: { display: false } } }
        });
      } else {
        metricsChart.data.datasets[0].data = values;
        metricsChart.update();
      }
    } catch (e) {
      if (metricsChartEl) metricsChartEl.parentNode.innerHTML = '<div style="color:red">Ошибка загрузки метрик</div>';
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch('/api/logs?limit=50');
      const { logs } = await res.json();
      monitoringLogsEl.innerHTML = logs.map(l => `<div>${l}</div>`).join('');
    } catch (e) {
      monitoringLogsEl.innerHTML = '<div style="color:red">Ошибка загрузки логов</div>';
    }
  }

  if (refreshMetricsBtn) refreshMetricsBtn.addEventListener('click', fetchMetrics);
  if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', fetchLogs);
  // Автозагрузка при открытии dashboard
  if (metricsChartEl) fetchMetrics();
  if (monitoringLogsEl) fetchLogs();
});

