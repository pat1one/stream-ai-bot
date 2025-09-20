// --- Сравнительный анализ каналов доставки (Stacked Bar Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const channelPanel = document.getElementById('channelsComparePanel');
  if (channelPanel) {
    const channelResult = document.getElementById('channelsCompareResult');
    if (channelResult) {
      const showChart = (channels) => {
        const labels = channels.map(c => c.channel || 'unknown');
        const success = channels.map(c => Number(c.success || 0));
        const failed = channels.map(c => Number(c.failed || 0));
        channelResult.innerHTML += '<canvas id="channelsCompareChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('channelsCompareChart');
        if (!chartEl) return;
        if (window.channelsCompareChart) window.channelsCompareChart.destroy?.();
        window.channelsCompareChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Успешные', data: success, backgroundColor: '#28a745', stack: 'Stack' },
              { label: 'Ошибочные', data: failed, backgroundColor: '#d9534f', stack: 'Stack' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
              x: { stacked: true },
              y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Кол-во отправок' } }
            }
          }
        });
      };
      // Переопределим обработчик loadChannelsCompareBtn
      const loadBtn = document.getElementById('loadChannelsCompareBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const res = await fetch('/api/notifications/stats/channels');
          const data = await res.json();
          if (data.channels && data.channels.length) {
            channelResult.innerHTML = '<ul>' + data.channels.map(c => `<li>${c.channel}: успешные ${c.success}, ошибочные ${c.failed}</li>`).join('') + '</ul>';
            showChart(data.channels);
          } else channelResult.innerHTML = 'Нет данных по каналам.';
        };
      }
    }
  }
});
// --- Визуализация активности email-рассылок (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const emailPanel = document.getElementById('emailStatsPanel');
  if (emailPanel) {
    const emailResult = document.getElementById('emailStatsResult');
    if (emailResult) {
      const showChart = (stats) => {
        // Группировка по датам
        const byDate = {};
        stats.forEach(s => {
          const d = s.date || s.sent_date || 'unknown';
          byDate[d] = byDate[d] || { sent: 0, opened: 0, clicked: 0 };
          byDate[d].sent += Number(s.sent || 0);
          byDate[d].opened += Number(s.opened || 0);
          byDate[d].clicked += Number(s.clicked || 0);
        });
        const labels = Object.keys(byDate);
        const sent = labels.map(d => byDate[d].sent);
        const opened = labels.map(d => byDate[d].opened);
        const clicked = labels.map(d => byDate[d].clicked);
        emailResult.innerHTML += '<canvas id="emailStatsChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('emailStatsChart');
        if (!chartEl) return;
        if (window.emailStatsChart) window.emailStatsChart.destroy?.();
        window.emailStatsChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Отправлено', data: sent, backgroundColor: '#007bff' },
              { label: 'Открыто', data: opened, backgroundColor: '#28a745' },
              { label: 'Переходы по ссылкам', data: clicked, backgroundColor: '#f7b32b' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Кол-во' } } }
          }
        });
      };
      // Переопределим обработчик loadEmailStatsBtn
      const loadBtn = document.getElementById('loadEmailStatsBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const res = await fetch('/api/notifications/email/stats');
          const data = await res.json();
          if (data.stats && data.stats.length) {
            emailResult.innerHTML = '<ul>' + data.stats.map(s => `<li>${s.date || s.sent_date}: отправлено ${s.sent}, открыто ${s.opened}, переходы ${s.clicked}</li>`).join('') + '</ul>';
            showChart(data.stats);
          } else emailResult.innerHTML = 'Нет данных по email-рассылкам.';
        };
      }
    }
  }
});
// --- Визуализация динамики AI-отчётов (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const aiPanel = document.getElementById('aiReportPanel');
  if (aiPanel) {
    const aiResult = document.getElementById('aiReportResult');
    if (aiResult) {
      const showChart = (reports) => {
        // Группировка по датам и эффективности
        const byDate = {};
        reports.forEach(r => {
          const d = r.date || r.created || 'unknown';
          byDate[d] = byDate[d] || { count: 0, eff: 0 };
          byDate[d].count++;
          byDate[d].eff += Number(r.efficiency || 0);
        });
        const labels = Object.keys(byDate);
        const counts = labels.map(d => byDate[d].count);
        const effs = labels.map(d => byDate[d].eff / byDate[d].count);
        aiResult.innerHTML += '<canvas id="aiReportChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('aiReportChart');
        if (!chartEl) return;
        if (window.aiReportChart) window.aiReportChart.destroy?.();
        window.aiReportChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'AI-отчёты (кол-во)', data: counts, borderColor: '#007bff', backgroundColor: '#007bff22', yAxisID: 'y' },
              { label: 'Эффективность рекомендаций', data: effs, borderColor: '#28a745', backgroundColor: '#28a74522', yAxisID: 'y1' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { beginAtZero: true, title: { display: true, text: 'Кол-во отчётов' }, position: 'left' },
              y1: { beginAtZero: true, title: { display: true, text: 'Эффективность' }, position: 'right', grid: { drawOnChartArea: false } }
            }
          }
        });
      };
      // Переопределим обработчик loadAiReportBtn
      const loadBtn = document.getElementById('loadAiReportBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const res = await fetch('/api/notifications/report');
          const data = await res.json();
          if (data.reports && data.reports.length) {
            aiResult.innerHTML = '<ul>' + data.reports.map(r => `<li>${r.date || r.created}: ${r.summary || ''} <br>Эффективность: ${r.efficiency || '-'}%</li>`).join('') + '</ul>';
            showChart(data.reports);
          } else aiResult.innerHTML = 'Нет AI-отчётов.';
        };
      }
    }
  }
});
// --- Визуализация BI-экспорта (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const biPanel = document.getElementById('biExportPanel');
  if (biPanel) {
    const biResult = document.getElementById('biExportResult');
    if (biResult) {
      const showChart = (segments) => {
        const labels = segments.map(s => s.segment || 'unknown');
        const counts = segments.map(s => Number(s.count||0));
        biResult.innerHTML += '<canvas id="biExportChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('biExportChart');
        if (!chartEl) return;
        if (window.biExportChart) window.biExportChart.destroy?.();
        window.biExportChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'pie',
          data: {
            labels,
            datasets: [
              { label: 'Распределение по сегментам', data: counts, backgroundColor: ['#5bc0be','#f7b32b','#d9534f','#6c757d','#007bff','#28a745','#6610f2','#e83e8c'] }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } }
          }
        });
      };
      // Переопределим обработчик loadBiExportBtn
      const loadBtn = document.getElementById('loadBiExportBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const res = await fetch('/api/notifications/stats/export');
          const data = await res.json();
          if (data.segments && data.segments.length) {
            biResult.innerHTML = '<ul>' + data.segments.map(s => `<li>${s.segment}: ${s.count}</li>`).join('') + '</ul>';
            showChart(data.segments);
          } else biResult.innerHTML = 'Нет данных.';
        };
      }
    }
  }
});
// --- Визуализация анализа ошибок рассылок (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const failurePanel = document.getElementById('failureAnalysisPanel');
  if (failurePanel) {
    const failuresResult = document.getElementById('failuresResult');
    if (failuresResult) {
      const showChart = (failures) => {
        // Группировка по каналам
        const byChannel = {};
        failures.forEach(f => {
          const ch = f.channel || 'unknown';
          byChannel[ch] = (byChannel[ch]||0)+Number(f.count||0);
        });
        const labels = Object.keys(byChannel);
        const counts = Object.values(byChannel);
        failuresResult.innerHTML += '<canvas id="failuresChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('failuresChart');
        if (!chartEl) return;
        if (window.failuresChart) window.failuresChart.destroy?.();
        window.failuresChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Ошибки по каналам', data: counts, backgroundColor: '#d9534f' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Кол-во ошибок' } } }
          }
        });
      };
      // Переопределим обработчик loadFailuresBtn
      const loadBtn = document.getElementById('loadFailuresBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const res = await fetch('/api/notifications/failures/analyze');
          const data = await res.json();
          if (data.failures && data.failures.length) {
            failuresResult.innerHTML = '<ul>' + data.failures.map(f => `<li>${f.channel} — ${f.status} (${f.count})<br>с ${f.first} по ${f.last}</li>`).join('') + '</ul>';
            if (data.recommendations && data.recommendations.length) {
              failuresResult.innerHTML += '<h4>Рекомендации:</h4><ul>' + data.recommendations.map(r => `<li>${r}</li>`).join('') + '</ul>';
            }
            showChart(data.failures);
          } else failuresResult.innerHTML = 'Нет ошибок.';
        };
      }
    }
  }
});
// --- Визуализация истории изменений шаблонов (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const templateHistoryPanel = document.getElementById('templateHistoryPanel');
  if (templateHistoryPanel) {
    const historyResult = document.getElementById('historyResult');
    if (historyResult) {
      const showChart = (history) => {
        // Группировка по дате
        const byDate = {};
        history.forEach(h => {
          const date = h.updated_at?.slice(0,10) || 'unknown';
          byDate[date] = (byDate[date]||0)+1;
        });
        const labels = Object.keys(byDate);
        const changes = Object.values(byDate);
        historyResult.innerHTML += '<canvas id="historyChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('historyChart');
        if (!chartEl) return;
        if (window.historyChart) window.historyChart.destroy?.();
        window.historyChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Изменения шаблона', data: changes, borderColor: '#36a2eb', backgroundColor: '#36a2eb22', fill: true }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Кол-во изменений' } } }
          }
        });
      };
      // Переопределим обработчик loadHistoryBtn
      const loadBtn = document.getElementById('loadHistoryBtn');
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const name = document.getElementById('historyTemplateName').value;
          const res = await fetch(`/api/notifications/templates/history/${encodeURIComponent(name)}`);
          const data = await res.json();
          if (data.history && data.history.length) {
            historyResult.innerHTML = '<ul>' + data.history.map(h => `<li>Версия ${h.version}, ${h.updated_at}, ${h.updated_by}<br><pre>${JSON.stringify(h.changes,null,2)}</pre></li>`).join('') + '</ul>';
            showChart(data.history);
          } else historyResult.innerHTML = 'Нет истории.';
        };
      }
    }
  }
});
// --- Визуализация результатов A/B тестов (Chart.js) ---
window.addEventListener('DOMContentLoaded', () => {
  const abTestPanel = document.getElementById('abTestPanel');
  if (abTestPanel) {
    const abTestResult = document.getElementById('abTestResult');
    if (abTestResult) {
      // Добавим график после вывода результатов
      const showChart = (results) => {
        abTestResult.innerHTML += '<canvas id="abTestChart" width="600" height="220" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
        const chartEl = document.getElementById('abTestChart');
        if (!chartEl) return;
        const labels = results.map(r => r.variant);
        const sent = results.map(r => r.sent);
        const opened = results.map(r => r.opened);
        const clicked = results.map(r => r.clicked);
        if (window.abTestChart) window.abTestChart.destroy?.();
        window.abTestChart = new window.Chart(chartEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Отправлено', data: sent, backgroundColor: '#36a2eb' },
              { label: 'Открыто', data: opened, backgroundColor: '#4bc0c0' },
              { label: 'Клики', data: clicked, backgroundColor: '#ffcd56' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Кол-во' } } }
          }
        });
      };
      // Переопределим обработчик showAbTestResultsBtn
      const showBtn = document.getElementById('showAbTestResultsBtn');
      if (showBtn) {
        showBtn.onclick = async () => {
          const testName = document.getElementById('abTestName').value;
          const res = await fetch(`/api/notifications/abtest/results/${encodeURIComponent(testName)}`);
          const data = await res.json();
          if (data.results && data.results.length) {
            abTestResult.innerHTML = '<ul>' + data.results.map(r => `<li>${r.variant}: отправлено ${r.sent}, открыто ${r.opened}, клики ${r.clicked}</li>`).join('') + '</ul>';
            showChart(data.results);
          } else abTestResult.innerHTML = 'Нет результатов.';
        };
      }
    }
  }
});
// --- Dashboard: базовые обработчики новых разделов ---
window.addEventListener('DOMContentLoaded', () => {
  // BI экспорт
  const exportBIcsvBtn = document.getElementById('exportBIcsvBtn');
  const exportBIjsonBtn = document.getElementById('exportBIjsonBtn');
  const exportBIResult = document.getElementById('exportBIResult');
  if (exportBIcsvBtn) exportBIcsvBtn.onclick = async () => {
    exportBIResult.innerHTML = 'Экспорт...';
    const res = await fetch('/api/notifications/stats/export?format=csv');
    const csv = await res.text();
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'notification_stats.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    exportBIResult.innerHTML = 'CSV выгружен.';
  };
  if (exportBIjsonBtn) exportBIjsonBtn.onclick = async () => {
    exportBIResult.innerHTML = 'Экспорт...';
    const res = await fetch('/api/notifications/stats/export?format=json');
    const json = await res.text();
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'notification_stats.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    exportBIResult.innerHTML = 'JSON выгружен.';
  };

  // История изменений шаблонов (пример для одного шаблона)
  const templateHistoryPanel = document.getElementById('templateHistoryPanel');
  if (templateHistoryPanel) {
    templateHistoryPanel.innerHTML = '<input id="historyTemplateName" placeholder="Имя шаблона"><button id="loadHistoryBtn">Показать историю</button><div id="historyResult"></div>';
    document.getElementById('loadHistoryBtn').onclick = async () => {
      const name = document.getElementById('historyTemplateName').value;
      const res = await fetch(`/api/notifications/templates/history/${encodeURIComponent(name)}`);
      const data = await res.json();
      const historyResult = document.getElementById('historyResult');
      if (data.history && data.history.length) {
        historyResult.innerHTML = '<ul>' + data.history.map(h => `<li>Версия ${h.version}, ${h.updated_at}, ${h.updated_by}<br><pre>${JSON.stringify(h.changes,null,2)}</pre></li>`).join('') + '</ul>';
      } else historyResult.innerHTML = 'Нет истории.';
    };
  }

  // Анализ ошибок
  const failurePanel = document.getElementById('failureAnalysisPanel');
  if (failurePanel) {
    failurePanel.innerHTML = '<button id="loadFailuresBtn">Показать ошибки</button><div id="failuresResult"></div>';
    document.getElementById('loadFailuresBtn').onclick = async () => {
      const res = await fetch('/api/notifications/failures/analyze');
      const data = await res.json();
      const failuresResult = document.getElementById('failuresResult');
      if (data.failures && data.failures.length) {
        failuresResult.innerHTML = '<ul>' + data.failures.map(f => `<li>${f.channel} — ${f.status} (${f.count})<br>с ${f.first} по ${f.last}</li>`).join('') + '</ul>';
      } else failuresResult.innerHTML = 'Нет ошибок.';
      if (data.recommendations && data.recommendations.length) {
        failuresResult.innerHTML += '<h4>Рекомендации:</h4><ul>' + data.recommendations.map(r => `<li>${r}</li>`).join('') + '</ul>';
      }
    };
  }

  // A/B тесты (запуск и просмотр)
  const abTestPanel = document.getElementById('abTestPanel');
  if (abTestPanel) {
    abTestPanel.innerHTML = '<input id="abTestName" placeholder="Название теста"><input id="abTestVariants" placeholder="Варианты через запятую"><button id="startAbTestBtn">Запустить тест</button><button id="showAbTestResultsBtn">Показать результаты</button><div id="abTestResult"></div>';
    document.getElementById('startAbTestBtn').onclick = async () => {
      const testName = document.getElementById('abTestName').value;
      const variants = document.getElementById('abTestVariants').value.split(',').map(v=>v.trim()).filter(Boolean);
      await fetch('/api/notifications/abtest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testName, variants, userSegment: {} })
      });
      document.getElementById('abTestResult').innerHTML = 'Тест запущен.';
    };
    document.getElementById('showAbTestResultsBtn').onclick = async () => {
      const testName = document.getElementById('abTestName').value;
      const res = await fetch(`/api/notifications/abtest/results/${encodeURIComponent(testName)}`);
      const data = await res.json();
      if (data.results && data.results.length) {
        document.getElementById('abTestResult').innerHTML = '<ul>' + data.results.map(r => `<li>${r.variant}: отправлено ${r.sent}, открыто ${r.opened}, клики ${r.clicked}</li>`).join('') + '</ul>';
      } else document.getElementById('abTestResult').innerHTML = 'Нет результатов.';
    };
  }
});
(() => {
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
  });
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('wsUrl', els.wsUrl.value);
    localStorage.setItem('autoReconnect', els.autoReconnect.checked ? '1' : '0');
    localStorage.setItem('persistLogs', els.persistLogs.checked ? '1' : '0');
    localStorage.setItem('authToken', els.authToken.value || '');
  });

})();
