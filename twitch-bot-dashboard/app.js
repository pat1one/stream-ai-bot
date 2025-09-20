// --- Голосовые команды: обработчик ---
document.addEventListener('DOMContentLoaded', () => {
  const voiceForm = document.getElementById('voiceForm');
  const voiceUserId = document.getElementById('voiceUserId');
  const voiceCommand = document.getElementById('voiceCommand');
  const voiceResult = document.getElementById('voiceResult');
  if (voiceForm && voiceUserId && voiceCommand && voiceResult) {
    voiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      voiceResult.textContent = '';
      const userId = voiceUserId.value.trim();
      const command = voiceCommand.value;
      if (!userId || !command) {
        voiceResult.textContent = 'Заполните все поля.';
        return;
      }
      voiceResult.innerHTML = '<em>Запрос...</em>';
      try {
        const res = await fetch('/api/voice/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, command })
        });
        const data = await res.json();
        if (data.success) {
          voiceResult.innerHTML = `<b>Результат:</b> ${data.result}`;
        } else {
          voiceResult.innerHTML = '<span style="color:#f43">Ошибка выполнения</span>';
        }
      } catch (e) {
        voiceResult.innerHTML = '<span style="color:#f43">Ошибка запроса</span>';
      }
    });
  }
});
// --- AI-рекомендации и прогнозы: обработчик ---
document.addEventListener('DOMContentLoaded', () => {
  const aiForm = document.getElementById('aiRecommendForm');
  const aiUserId = document.getElementById('aiUserId');
  const aiResult = document.getElementById('aiRecommendResult');
  if (aiForm && aiUserId && aiResult) {
    aiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      aiResult.textContent = '';
      const userId = aiUserId.value.trim();
      if (!userId) {
        aiResult.textContent = 'Введите ID пользователя.';
        return;
      }
      aiResult.innerHTML = '<em>Запрос...</em>';
      try {
        const res = await fetch(`/api/notifications/ai-recommend/${userId}`);
        const data = await res.json();
        if (data.error) {
          aiResult.innerHTML = `<span style="color:#f43">${data.error}</span>`;
        } else {
          aiResult.innerHTML = `<b>Рекомендация:</b> ${data.recommendation}<br>
            <b>Прогноз:</b> ${data.forecast}<br>
            <b>Статистика:</b> Предупреждений: ${data.stats.warnCount}, Ошибок: ${data.stats.errorCount}, Новых: ${data.stats.newCount}`;
        }
      } catch (e) {
        aiResult.innerHTML = '<span style="color:#f43">Ошибка запроса</span>';
      }
    });
  }
});
// --- Drag-and-drop, поиск, фильтрация уведомлений ---
document.addEventListener('DOMContentLoaded', () => {
  const sortableList = document.getElementById('notificationSortableList');
  const searchInput = document.getElementById('notificationSearch');
  const statusFilter = document.getElementById('notificationStatusFilter');
  const typeFilter = document.getElementById('notificationTypeFilter');

  let notifications = [];

  async function loadNotifications() {
    const res = await fetch('/api/notifications');
    notifications = await res.json();
    renderNotifications();
  }

  function renderNotifications() {
    let filtered = notifications;
    const search = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const type = typeFilter.value;
    if (search) filtered = filtered.filter(n => (n.title || n.message || '').toLowerCase().includes(search));
    if (status) filtered = filtered.filter(n => n.status === status);
    if (type) filtered = filtered.filter(n => n.type === type);
    sortableList.innerHTML = filtered.length ?
      `<ul id="sortableUl">${filtered.map(n => `<li draggable="true" data-id="${n.id}" class="sortable-item"><b>${n.title || n.message}</b> <span style="color:#888">[${n.status}]</span></li>`).join('')}</ul>` :
      '<em>Нет уведомлений</em>';
  }

  searchInput && searchInput.addEventListener('input', renderNotifications);
  statusFilter && statusFilter.addEventListener('change', renderNotifications);
  typeFilter && typeFilter.addEventListener('change', renderNotifications);

  // Drag-and-drop сортировка
  sortableList && sortableList.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('sortable-item')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.id);
    }
  });
  sortableList && sortableList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('sortable-item')) {
      e.target.style.background = '#e0e7ff';
    }
  });
  sortableList && sortableList.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('sortable-item')) {
      e.target.style.background = '';
    }
  });
  sortableList && sortableList.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('sortable-item')) {
      e.target.style.background = '';
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = e.target.dataset.id;
      const draggedIdx = notifications.findIndex(n => n.id == draggedId);
      const targetIdx = notifications.findIndex(n => n.id == targetId);
      if (draggedIdx > -1 && targetIdx > -1 && draggedIdx !== targetIdx) {
        const moved = notifications.splice(draggedIdx, 1)[0];
        notifications.splice(targetIdx, 0, moved);
        renderNotifications();
        // TODO: отправить новый порядок на сервер
      }
    }
  });

  loadNotifications();
});
// --- Мониторинг и Health-check: обработчики ---
document.addEventListener('DOMContentLoaded', () => {
  const healthStatus = document.getElementById('healthStatus');
  const monitoringMetrics = document.getElementById('monitoringMetrics');

  async function loadHealth() {
    if (!healthStatus) return;
    healthStatus.innerHTML = '<em>Проверка...</em>';
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      healthStatus.innerHTML = `<b>Статус:</b> ${data.status === 'ok' ? '🟢 OK' : '🔴 ERROR'}<br>
        <b>Uptime:</b> ${data.uptime}s<br>
        <b>DB:</b> ${data.db === 'ok' ? '🟢' : '🔴'}<br>
        <b>Memory:</b> RSS ${Math.round(data.memory.rss/1024/1024)} MB<br>
        <b>Load:</b> ${data.load.map(l => l.toFixed(2)).join(', ')}<br>
        <b>Time:</b> ${data.timestamp}`;
    } catch (e) {
      healthStatus.innerHTML = '<em>Ошибка сервера</em>';
    }
  }

  async function loadMonitoring() {
    if (!monitoringMetrics) return;
    monitoringMetrics.innerHTML = '<em>Загрузка...</em>';
    try {
      const res = await fetch('/api/monitoring');
      const data = await res.json();
      monitoringMetrics.innerHTML = `<b>Уведомлений:</b> ${data.notifications}<br>
        <b>Пользователей:</b> ${data.users}<br>
        <b>Ошибок:</b> ${data.errors}<br>
        <b>Time:</b> ${data.timestamp}`;
    } catch (e) {
      monitoringMetrics.innerHTML = '<em>Ошибка сервера</em>';
    }
  }

  function autoUpdate() {
    loadHealth();
    loadMonitoring();
    setTimeout(autoUpdate, 10000);
  }
  autoUpdate();
});
// --- Email отчёты: обработчики ---
document.addEventListener('DOMContentLoaded', () => {
  const emailReportForm = document.getElementById('emailReportForm');
  const emailReportEmail = document.getElementById('emailReportEmail');
  const emailReportSubject = document.getElementById('emailReportSubject');
  const emailReportBody = document.getElementById('emailReportBody');
  const emailReportResult = document.getElementById('emailReportResult');
  const emailReportHistory = document.getElementById('emailReportHistory');

  async function loadEmailReportHistory() {
    emailReportHistory.innerHTML = '<em>Загрузка...</em>';
    try {
      const res = await fetch('/api/report/email/history');
      const data = await res.json();
      if (Array.isArray(data)) {
        emailReportHistory.innerHTML = data.length ?
          `<ul>${data.map(r => `<li><b>${r.email}</b> <span style="color:#888">${r.subject}</span> <span>${r.status === 'sent' ? '✔️' : '❌'}</span> <span style="color:#f43">${r.error || ''}</span></li>`).join('')}</ul>` :
          '<em>Нет отправок</em>';
      } else {
        emailReportHistory.innerHTML = '<em>Ошибка загрузки</em>';
      }
    } catch (e) {
      emailReportHistory.innerHTML = '<em>Ошибка сервера</em>';
    }
  }

  emailReportForm && emailReportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailReportResult.textContent = '';
    const email = emailReportEmail.value.trim();
    const subject = emailReportSubject.value.trim();
    const body = emailReportBody.value.trim();
    if (!email || !subject || !body) {
      emailReportResult.textContent = 'Заполните все поля.';
      return;
    }
    try {
      const res = await fetch('/api/report/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, body })
      });
      const data = await res.json();
      if (data.success) {
        emailReportResult.textContent = 'Отчёт отправлен.';
        emailReportForm.reset();
        loadEmailReportHistory();
      } else {
        emailReportResult.textContent = data.error || 'Ошибка отправки.';
      }
    } catch (e) {
      emailReportResult.textContent = 'Ошибка сервера.';
    }
  });

  loadEmailReportHistory();
});
// --- Планировщик уведомлений: обработчики ---
document.addEventListener('DOMContentLoaded', () => {
  const schedulerForm = document.getElementById('schedulerForm');
  const schedulerTitle = document.getElementById('schedulerTitle');
  const schedulerMessage = document.getElementById('schedulerMessage');
  const schedulerUserId = document.getElementById('schedulerUserId');
  const schedulerCron = document.getElementById('schedulerCron');
  const schedulerResult = document.getElementById('schedulerResult');
  const schedulerList = document.getElementById('schedulerList');

  async function loadScheduler() {
    schedulerList.innerHTML = '<em>Загрузка...</em>';
    try {
      const res = await fetch('/api/scheduler');
      const data = await res.json();
      if (Array.isArray(data)) {
        schedulerList.innerHTML = data.length ?
          `<ul>${data.map(job => `<li><b>${job.title}</b> <span style="color:#888">${job.cron}</span> <span>${job.message}</span> <button data-id="${job.id}" class="scheduler-delete">Удалить</button></li>`).join('')}</ul>` :
          '<em>Нет задач</em>';
      } else {
        schedulerList.innerHTML = '<em>Ошибка загрузки</em>';
      }
    } catch (e) {
      schedulerList.innerHTML = '<em>Ошибка сервера</em>';
    }
  }

  schedulerForm && schedulerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    schedulerResult.textContent = '';
    const title = schedulerTitle.value.trim();
    const message = schedulerMessage.value.trim();
    const user_id = schedulerUserId.value.trim();
    const cron = schedulerCron.value.trim();
    if (!title || !message || !cron) {
      schedulerResult.textContent = 'Заполните все обязательные поля.';
      return;
    }
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, user_id, cron })
      });
      const data = await res.json();
      if (data.success) {
        schedulerResult.textContent = 'Задача добавлена.';
        schedulerForm.reset();
        loadScheduler();
      } else {
        schedulerResult.textContent = data.error || 'Ошибка сохранения.';
      }
    } catch (e) {
      schedulerResult.textContent = 'Ошибка сервера.';
    }
  });

  schedulerList && schedulerList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('scheduler-delete')) {
      const id = e.target.getAttribute('data-id');
      if (id) {
        try {
          const res = await fetch(`/api/scheduler/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            schedulerResult.textContent = 'Задача удалена.';
            loadScheduler();
          } else {
            schedulerResult.textContent = data.error || 'Ошибка удаления.';
          }
        } catch (e) {
          schedulerResult.textContent = 'Ошибка сервера.';
        }
      }
    }
  });

  loadScheduler();
});
// --- Мобильные уведомления: интеграция с API ---
document.addEventListener('DOMContentLoaded', () => {
  const mobilePanel = document.getElementById('mobileNotificationsPanel');
  const mobileList = document.getElementById('mobileNotificationsList');
  if (mobilePanel && mobileList) {
    async function loadMobileNotifications() {
      mobileList.innerHTML = '<em>Загрузка...</em>';
      try {
        const res = await fetch('/api/mobile/notifications');
        const data = await res.json();
        if (Array.isArray(data)) {
          mobileList.innerHTML = data.length ?
            `<ul>${data.map(n => `<li><b>${n.title || n.message}</b> <span style="color:#888">[${n.status}]</span></li>`).join('')}</ul>` :
            '<em>Нет уведомлений</em>';
        } else {
          mobileList.innerHTML = '<em>Ошибка загрузки</em>';
        }
      } catch (e) {
        mobileList.innerHTML = '<em>Ошибка сервера</em>';
      }
    }
    loadMobileNotifications();
  }
});
// --- Webhook интеграции (Slack, Teams) ---
document.addEventListener('DOMContentLoaded', () => {
  const webhookForm = document.getElementById('webhookForm');
  const webhookType = document.getElementById('webhookType');
  const webhookUrl = document.getElementById('webhookUrl');
  const webhookResult = document.getElementById('webhookResult');
  const webhookList = document.getElementById('webhookList');

  async function loadWebhooks() {
    webhookList.innerHTML = '<em>Загрузка...</em>';
    try {
      const res = await fetch('/api/integration/webhook');
      const data = await res.json();
      if (Array.isArray(data)) {
        webhookList.innerHTML = data.length ?
          `<ul>${data.map(w => `<li><b>${w.type}</b>: <span>${w.url}</span></li>`).join('')}</ul>` :
          '<em>Нет интеграций</em>';
      } else {
        webhookList.innerHTML = '<em>Ошибка загрузки</em>';
      }
    } catch (e) {
      webhookList.innerHTML = '<em>Ошибка сервера</em>';
    }
  }

  webhookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    webhookResult.textContent = '';
    const type = webhookType.value;
    const url = webhookUrl.value.trim();
    if (!url) {
      webhookResult.textContent = 'Введите URL webhook.';
      return;
    }
    try {
      const res = await fetch('/api/integration/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url })
      });
      const data = await res.json();
      if (data.success) {
        webhookResult.textContent = 'Интеграция сохранена.';
        webhookUrl.value = '';
        loadWebhooks();
      } else {
        webhookResult.textContent = data.error || 'Ошибка сохранения.';
      }
    } catch (e) {
      webhookResult.textContent = 'Ошибка сервера.';
    }
  });

  loadWebhooks();
});
// --- Переключатель языка (i18n) ---
window.addEventListener('DOMContentLoaded', () => {
  const langSelect = document.getElementById('langSelect');
  const translations = {
    en: {
      'Тёмная тема': 'Dark theme',
      'Язык': 'Language',
      'AI-тренды и прогнозы оттока': 'AI Trends & Churn Forecast',
      'Показать тренды': 'Show Trends',
      'Показать прогноз оттока': 'Show Churn Forecast',
      'AI-рекомендации по сегментам': 'AI Recommendations by Segment',
      'Показать рекомендации': 'Show Recommendations',
      'Двухфакторная аутентификация (2FA)': 'Two-Factor Authentication (2FA)',
      'Настроить 2FA': 'Setup 2FA',
      'Проверить код': 'Verify Code',
      'Обратная связь и поддержка': 'Feedback & Support',
      'Отправить': 'Send',
      'FAQ': 'FAQ',
      'Система уведомлений для событий и ошибок': 'Event & Error Notifications',
      'Загрузить уведомления': 'Load Notifications',
      'BI-отчёты и фильтры': 'BI Reports & Filters',
      'Показать отчёты': 'Show Reports',
      'Экспортировать': 'Export',
      'Автоматическая оптимизация рассылок': 'Auto Campaign Optimization',
      'Показать A/B отчёты': 'Show A/B Reports',
      'Запустить AI-оптимизацию': 'Run AI Optimization',
      'Интеграция с CRM/ERP системами': 'CRM/ERP Integration',
      'Экспорт данных': 'Export Data',
      'Импортировать данные': 'Import Data',
      'Drag-and-drop редактор шаблонов и сегментов': 'Drag-and-drop Template & Segment Editor',
      'Сохранить изменения': 'Save Changes',
      'История аудита действий пользователей': 'Audit History',
      'Загрузить историю аудита': 'Load Audit History',
      'Тепловая карта корреляций': 'Correlation Heatmap',
      'Загрузить тепловую карту': 'Load Heatmap',
      'Граф связей каналов и сегментов': 'Network Graph',
      'Загрузить граф связей': 'Load Network Graph'
    },
    ru: {}
  };
  function localize(lang) {
    document.querySelectorAll('h2, h3, label, button').forEach(el => {
      const txt = el.textContent.trim();
      if (translations[lang][txt]) el.textContent = translations[lang][txt];
      if (lang === 'ru' && translations['en'][txt]) el.textContent = txt;
    });
  }
  if (langSelect) {
    langSelect.onchange = () => {
      localStorage.setItem('lang', langSelect.value);
      localize(langSelect.value);
    };
    // Инициализация языка при загрузке
    const lang = localStorage.getItem('lang') || 'ru';
    langSelect.value = lang;
    localize(lang);
  }
});
// --- Переключатель тёмной/светлой темы ---
window.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.onchange = () => {
      if (themeToggle.checked) {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
      }
    };
    // Инициализация темы при загрузке
    if (localStorage.getItem('theme') === 'dark') {
      themeToggle.checked = true;
      document.body.classList.add('dark-theme');
    }
  }
});
// --- AI-тренды и прогнозы оттока ---
window.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('aiTrendsPanel');
  if (panel) {
    const trendsBtn = document.getElementById('loadTrendsBtn');
    const churnBtn = document.getElementById('loadChurnBtn');
    const trendsResult = document.getElementById('aiTrendsResult');
    const churnResult = document.getElementById('aiChurnResult');

    if (trendsBtn) trendsBtn.onclick = async () => {
      trendsResult.textContent = 'Загрузка трендов...';
      const res = await fetch('/api/analytics/trends');
      const data = await res.json();
      if (data.trends && data.trends.length) {
        trendsResult.innerHTML = '<ul>' + data.trends.map(t => `<li><b>${t.channel}</b> / <b>${t.segment}</b>: ${t.trend} (${t.value}) за ${t.period}</li>`).join('') + '</ul>';
      } else {
        trendsResult.textContent = 'Нет трендов.';
      }
    };

    if (churnBtn) churnBtn.onclick = async () => {
      churnResult.textContent = 'Загрузка прогноза оттока...';
      const res = await fetch('/api/analytics/churn');
      const data = await res.json();
      if (data.churn && data.churn.length) {
        churnResult.innerHTML = '<ul>' + data.churn.map(c => `<li><b>${c.segment}</b>: ${c.forecast}</li>`).join('') + '</ul>';
      } else {
        churnResult.textContent = 'Нет прогноза.';
      }
    };
  }
});
// --- Персонализированные AI-рекомендации для сегментов ---
window.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('segmentAIRecommendPanel');
  if (panel) {
    const select = document.getElementById('segmentAISelect');
    const btn = document.getElementById('loadSegmentAIRecommendBtn');
    const resultDiv = document.getElementById('segmentAIRecommendResult');
    if (btn) btn.onclick = async () => {
      resultDiv.textContent = 'Загрузка рекомендаций...';
      const segment = select.value;
      const res = await fetch(`/api/notifications/ai-recommend/segment?segment=${encodeURIComponent(segment)}`);
      const data = await res.json();
      if (data.recommendations && data.recommendations.length) {
        resultDiv.innerHTML = '<ul>' + data.recommendations.map(r => `<li><b>${r.type}</b>: ${r.text}</li>`).join('') + '</ul>';
      } else {
        resultDiv.textContent = 'Нет рекомендаций.';
      }
    };
  }
});
// --- Двухфакторная аутентификация для админов ---
window.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('admin2faPanel');
  if (panel) {
    const setupBtn = document.getElementById('setup2faBtn');
    const setupResult = document.getElementById('setup2faResult');
    const verifyForm = document.getElementById('verify2faForm');
    const verifyToken = document.getElementById('verify2faToken');
    const verifyResult = document.getElementById('verify2faResult');

    if (setupBtn) setupBtn.onclick = async () => {
      setupResult.textContent = 'Генерация QR-кода...';
      const res = await fetch('/api/auth/2fa/setup');
      const data = await res.json();
      if (data.qr) {
        setupResult.innerHTML = `<div>Отсканируйте QR-код в приложении Google Authenticator:</div><img src="${data.qr}" style="margin:1em 0;max-width:220px;">`;
      } else {
        setupResult.textContent = 'Ошибка генерации.';
      }
    };

    if (verifyForm) verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const token = verifyToken.value.trim();
      if (!token) {
        verifyResult.textContent = 'Введите код.';
        return;
      }
      verifyResult.textContent = 'Проверка...';
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      verifyResult.textContent = data.success ? 'Код подтверждён, 2FA активен.' : 'Неверный код.';
      verifyForm.reset();
    };
  }
});
// --- Обратная связь, FAQ и поддержка ---
window.addEventListener('DOMContentLoaded', () => {
  const supportPanel = document.getElementById('supportPanel');
  if (supportPanel) {
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackText = document.getElementById('feedbackText');
    const feedbackResult = document.getElementById('feedbackResult');
    const faqList = document.getElementById('faqList');

    if (feedbackForm) feedbackForm.onsubmit = async (e) => {
      e.preventDefault();
      const text = feedbackText.value.trim();
      if (!text) {
        feedbackResult.textContent = 'Введите ваш вопрос или отзыв.';
        return;
      }
      feedbackResult.textContent = 'Отправка...';
      const res = await fetch('/api/support/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      feedbackResult.textContent = data.success ? 'Спасибо за ваш отзыв!' : 'Ошибка отправки.';
      feedbackForm.reset();
    };

    // Загрузка FAQ
    async function loadFAQ() {
      const res = await fetch('/api/support/faq');
      const data = await res.json();
      if (data.faq && data.faq.length) {
        faqList.innerHTML = '<ul>' + data.faq.map(f => `<li><b>${f.q}</b><br>${f.a}</li>`).join('') + '</ul>';
      } else {
        faqList.textContent = 'FAQ отсутствует.';
      }
    }
    loadFAQ();
  }
});
// --- BI-отчёты, фильтры и экспорт ---
window.addEventListener('DOMContentLoaded', () => {
  const biPanel = document.getElementById('biReportsPanel');
  if (biPanel) {
    const resultDiv = document.getElementById('biReportsResult');
    const channelFilter = document.getElementById('biChannelFilter');
    const segmentFilter = document.getElementById('biSegmentFilter');
    const loadBtn = document.getElementById('loadBIReportsBtn');
    const exportBtn = document.getElementById('exportBIReportsBtn');

    if (loadBtn) loadBtn.onclick = async () => {
      resultDiv.textContent = 'Загрузка BI-отчётов...';
      const params = new URLSearchParams();
      if (channelFilter.value) params.append('channel', channelFilter.value);
      if (segmentFilter.value) params.append('segment', segmentFilter.value);
      const res = await fetch('/api/bi/reports?' + params.toString());
      const data = await res.json();
      if (data.reports && data.reports.length) {
        resultDiv.innerHTML = '<ul>' + data.reports.map(r => `<li><b>${r.channel}</b> / <b>${r.segment}</b>: ${r.stats} <span style="color:#888">${r.date}</span></li>`).join('') + '</ul>';
      } else {
        resultDiv.textContent = 'Нет BI-отчётов.';
      }
    };

    if (exportBtn) exportBtn.onclick = async () => {
      resultDiv.textContent = 'Экспорт BI-отчётов...';
      const params = new URLSearchParams();
      if (channelFilter.value) params.append('channel', channelFilter.value);
      if (segmentFilter.value) params.append('segment', segmentFilter.value);
      const res = await fetch('/api/bi/export?' + params.toString());
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bi_reports.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        resultDiv.textContent = 'BI-отчёты экспортированы.';
      } else {
        resultDiv.textContent = 'Ошибка экспорта.';
      }
    };
  }
});
// --- Автоматическая оптимизация рассылок: AI и A/B отчёты ---
window.addEventListener('DOMContentLoaded', () => {
  const optimizePanel = document.getElementById('autoOptimizePanel');
  if (optimizePanel) {
    const resultDiv = document.getElementById('autoOptimizeResult');
    const abBtn = document.getElementById('loadABReportsBtn');
    const aiBtn = document.getElementById('runAIOptimizeBtn');

    if (abBtn) abBtn.onclick = async () => {
      resultDiv.textContent = 'Загрузка A/B отчётов...';
      const res = await fetch('/api/notifications/ab-reports');
      const data = await res.json();
      if (data.reports && data.reports.length) {
        resultDiv.innerHTML = '<ul>' + data.reports.map(r => `<li><b>${r.segment}</b>: ${r.result} <span style="color:#888">${r.date}</span></li>`).join('') + '</ul>';
      } else {
        resultDiv.textContent = 'Нет A/B отчётов.';
      }
    };

    if (aiBtn) aiBtn.onclick = async () => {
      resultDiv.textContent = 'AI-оптимизация...';
      const res = await fetch('/api/notifications/ai-optimize');
      const data = await res.json();
      if (data.success && data.recommendation) {
        resultDiv.innerHTML = `<div style='color:green'><b>Рекомендация:</b> ${data.recommendation}</div>`;
      } else {
        resultDiv.textContent = 'Нет рекомендаций.';
      }
    };
  }
});
// --- Интеграция с CRM/ERP: экспорт/импорт данных ---
window.addEventListener('DOMContentLoaded', () => {
  const integrationPanel = document.getElementById('integrationPanel');
  if (integrationPanel) {
    const resultDiv = document.getElementById('integrationResult');
    const exportBtn = document.getElementById('exportDataBtn');
    const importBtn = document.getElementById('importDataBtn');
    const importInput = document.getElementById('importDataInput');

    if (exportBtn) exportBtn.onclick = async () => {
      resultDiv.textContent = 'Экспорт данных...';
      const res = await fetch('/api/integration/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported_data.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        resultDiv.textContent = 'Данные успешно экспортированы.';
      } else {
        resultDiv.textContent = 'Ошибка экспорта.';
      }
    };

    if (importBtn) importBtn.onclick = async () => {
      if (!importInput.files.length) {
        resultDiv.textContent = 'Выберите файл для импорта.';
        return;
      }
      const file = importInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      resultDiv.textContent = 'Импорт данных...';
      const res = await fetch('/api/integration/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      resultDiv.textContent = data.success ? 'Данные успешно импортированы.' : 'Ошибка импорта.';
    };
  }
});
// --- Система уведомлений для событий и ошибок ---
window.addEventListener('DOMContentLoaded', () => {
  const notifPanel = document.getElementById('notificationsPanel');
  if (notifPanel) {
    const resultDiv = document.getElementById('notificationsResult');
    const loadBtn = document.getElementById('loadNotificationsBtn');
    if (loadBtn) loadBtn.onclick = async () => {
      resultDiv.textContent = 'Загрузка...';
      const res = await fetch('/api/notifications/events');
      const data = await res.json();
      if (data.events && data.events.length) {
        resultDiv.innerHTML = '<ul>' + data.events.map(e => `<li><b>${e.type}</b>: ${e.text} <span style="color:#888">${e.created_at}</span></li>`).join('') + '</ul>';
      } else {
        resultDiv.textContent = 'Нет уведомлений.';
      }
    };
  }
});
// --- AI-аналитика и рекомендации ---
window.addEventListener('DOMContentLoaded', () => {
  const aiPanel = document.getElementById('aiAnalyticsPanel');
  if (aiPanel) {
    const resultDiv = document.getElementById('aiAnalyticsResult');
    const loadBtn = document.getElementById('loadAIAnalyticsBtn');
    if (loadBtn) loadBtn.onclick = async () => {
      resultDiv.textContent = 'Загрузка...';
      const res = await fetch('/api/notifications/ai-recommend');
      const data = await res.json();
      if (data.recommendations && data.recommendations.length) {
        resultDiv.innerHTML = '<ul>' + data.recommendations.map(r => `<li><b>${r.type}</b>: ${r.text}</li>`).join('') + '</ul>';
      } else {
        resultDiv.textContent = 'Нет рекомендаций.';
      }
    };
  }
});
// --- Визуализация: heatmap и network graph ---
window.addEventListener('DOMContentLoaded', () => {
  // --- Heatmap корреляций ---
  const heatmapPanel = document.getElementById('correlationHeatmapPanel');
  if (heatmapPanel) {
    const heatmapCanvas = document.getElementById('correlationHeatmap');
    const loadBtn = document.getElementById('loadHeatmapBtn');
    const resultDiv = document.getElementById('heatmapResult');
    if (loadBtn) loadBtn.onclick = async () => {
      const res = await fetch('/api/notifications/stats/correlations');
      const data = await res.json();
      if (data.matrix && data.labels) {
        resultDiv.textContent = '';
        renderHeatmap(heatmapCanvas, data.matrix, data.labels);
      } else {
        resultDiv.textContent = 'Нет данных для тепловой карты.';
      }
    };
  }

  // --- Network graph связей ---
  const networkPanel = document.getElementById('networkGraphPanel');
  if (networkPanel) {
    const networkDiv = document.getElementById('networkGraph');
    const loadBtn = document.getElementById('loadNetworkGraphBtn');
    const resultDiv = document.getElementById('networkGraphResult');
    if (loadBtn) loadBtn.onclick = async () => {
      const res = await fetch('/api/notifications/stats/network');
      const data = await res.json();
      if (data.nodes && data.edges) {
        resultDiv.textContent = '';
        renderNetworkGraph(networkDiv, data.nodes, data.edges);
      } else {
        resultDiv.textContent = 'Нет данных для графа связей.';
      }
    };
  }
});

// --- Chart.js heatmap ---
function renderHeatmap(canvas, matrix, labels) {
  if (!window.Chart) {
    canvas.parentElement.innerHTML = '<div style="color:red">Chart.js не подключён</div>';
    return;
  }
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: 'matrix',
    data: {
      datasets: [{
        label: 'Корреляции',
        data: matrix.flatMap((row, i) => row.map((v, j) => ({ x: j, y: i, v }))),
        backgroundColor: ctx => {
          const value = ctx.dataset.data[ctx.dataIndex].v;
          return value > 0.7 ? '#ff5252' : value > 0.4 ? '#ffd600' : '#00e676';
        },
        width: 30,
        height: 30
      }],
    },
    options: {
      scales: {
        x: { labels, display: true },
        y: { labels, display: true }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// --- vis-network graph ---
function renderNetworkGraph(container, nodes, edges) {
  if (!window.vis || !window.vis.Network) {
    container.innerHTML = '<div style="color:red">vis-network не подключён</div>';
    return;
  }
  container.innerHTML = '';
  const network = new vis.Network(container, { nodes, edges }, {
    nodes: { shape: 'dot', size: 18, font: { size: 16 } },
    edges: { color: '#888', arrows: 'to' },
    physics: { stabilization: true }
  });
}
// --- Drag-and-drop редактор шаблонов и сегментов ---
window.addEventListener('DOMContentLoaded', () => {
  const dragPanel = document.getElementById('dragDropEditorPanel');
  if (dragPanel) {
    const templateList = document.getElementById('templateList');
    const segmentList = document.getElementById('segmentList');
    const saveBtn = document.getElementById('saveDragDropConfigBtn');
    const resultDiv = document.getElementById('dragDropEditorResult');

    // Загрузка шаблонов и сегментов
    async function loadTemplatesAndSegments() {
      const [tplRes, segRes] = await Promise.all([
        fetch('/api/notifications/templates'),
        fetch('/api/notifications/segments')
      ]);
      const templates = await tplRes.json();
      const segments = await segRes.json();
      renderList(templateList, templates, 'template');
      renderList(segmentList, segments, 'segment');
    }

    // Рендер списка с drag-and-drop
    function renderList(container, items, type) {
      container.innerHTML = `<h3>${type === 'template' ? 'Шаблоны' : 'Сегменты'}</h3>`;
      const ul = document.createElement('ul');
      ul.className = 'dragdrop-list';
      items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'dragdrop-item';
        li.draggable = true;
        li.textContent = item.name || item.title || item.id;
        li.dataset.id = item.id;
        li.dataset.type = type;
        ul.appendChild(li);
      });
      container.appendChild(ul);
      addDragDropHandlers(ul);
    }

    // Drag-and-drop обработчики
    function addDragDropHandlers(list) {
      let dragged;
      list.addEventListener('dragstart', e => {
        dragged = e.target;
        e.target.classList.add('dragging');
      });
      list.addEventListener('dragend', e => {
        e.target.classList.remove('dragging');
      });
      list.addEventListener('dragover', e => {
        e.preventDefault();
        const after = getDragAfterElement(list, e.clientY);
        if (after == null) {
          list.appendChild(dragged);
        } else {
          list.insertBefore(dragged, after);
        }
      });
    }
    function getDragAfterElement(list, y) {
      const items = [...list.querySelectorAll('.dragdrop-item:not(.dragging)')];
      return items.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Сохранение изменений порядка
    if (saveBtn) saveBtn.onclick = async () => {
      const tplOrder = Array.from(templateList.querySelectorAll('.dragdrop-item')).map(li => li.dataset.id);
      const segOrder = Array.from(segmentList.querySelectorAll('.dragdrop-item')).map(li => li.dataset.id);
      const res = await fetch('/api/notifications/templates/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateOrder: tplOrder, segmentOrder: segOrder })
      });
      const data = await res.json();
      resultDiv.textContent = data.success ? 'Изменения сохранены.' : 'Ошибка сохранения.';
    };

    loadTemplatesAndSegments();
  }
});
// --- Отображение истории аудита действий пользователей в dashboard ---
window.addEventListener('DOMContentLoaded', () => {
  const auditPanel = document.getElementById('auditHistoryPanel');
  if (auditPanel) {
    const auditResult = document.getElementById('auditHistoryResult');
    const loadBtn = document.getElementById('loadAuditHistoryBtn');
    if (loadBtn) loadBtn.onclick = async () => {
      const res = await fetch('/api/audit/history');
      const data = await res.json();
      if (data.history && data.history.length) {
        auditResult.innerHTML = '<ul>' + data.history.map(h => `<li><b>${h.user_id}</b>: ${h.action} — ${h.details} <span style='color:#888'>${h.created_at}</span></li>`).join('') + '</ul>';
      } else auditResult.innerHTML = 'Нет истории аудита.';
    };
  }
});
// --- Визуализация сложных связей: heatmap и network graph ---
window.addEventListener('DOMContentLoaded', () => {
  const heatmapPanel = document.getElementById('heatmapPanel');
  const networkPanel = document.getElementById('networkGraphPanel');
  // Heatmap (Chart.js matrix)
  if (heatmapPanel) {
    const heatmapResult = document.getElementById('heatmapResult');
    const loadBtn = document.getElementById('loadHeatmapBtn');
    if (loadBtn) loadBtn.onclick = async () => {
      const res = await fetch('/api/notifications/stats/correlations');
      const data = await res.json();
      // data.matrix: [{x, y, v}], data.xLabels, data.yLabels
      heatmapResult.innerHTML = '<canvas id="heatmapChart" width="600" height="300" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
      const ctx = document.getElementById('heatmapChart').getContext('2d');
      new window.Chart(ctx, {
        type: 'matrix',
        data: {
          datasets: [{
            label: 'Корреляции',
            data: data.matrix,
            backgroundColor: ctx => {
              const v = ctx.dataset.data[ctx.dataIndex].v;
              return `rgba(44,130,201,${0.2+0.8*Math.abs(v)})`;
            },
            width: 40,
            height: 30
          }],
          labels: { x: data.xLabels, y: data.yLabels }
        },
        options: {
          scales: { x: { labels: data.xLabels }, y: { labels: data.yLabels } },
          plugins: { legend: { display: false } }
        }
      });
    };
  }
  // Network graph (vis-network)
  if (networkPanel) {
    const networkResult = document.getElementById('networkGraphResult');
    const loadBtn = document.getElementById('loadNetworkGraphBtn');
    if (loadBtn) loadBtn.onclick = async () => {
      const res = await fetch('/api/notifications/stats/network');
      const data = await res.json();
      networkResult.innerHTML = '<div id="networkGraphVis" style="width:100%;height:400px;border:1px solid #ccc;margin-top:16px"></div>';
      const container = document.getElementById('networkGraphVis');
      const nodes = new window.vis.DataSet(data.nodes);
      const edges = new window.vis.DataSet(data.edges);
      new window.vis.Network(container, { nodes, edges }, { physics: { stabilization: false } });
    };
  }
});
// --- Drag-and-drop редактор шаблонов и сегментов ---
window.addEventListener('DOMContentLoaded', () => {
  const dragPanel = document.getElementById('dragEditorPanel');
  if (dragPanel) {
    const list = document.getElementById('dragEditorList');
    const saveBtn = document.getElementById('dragEditorSaveBtn');
    let items = [];
    // Загрузка шаблонов/сегментов
    const loadItems = async () => {
      const res = await fetch('/api/notifications/templates');
      const data = await res.json();
      items = data.templates || [];
      renderList();
    };
    // Визуализация списка с drag-and-drop
    function renderList() {
      list.innerHTML = items.map((item, idx) => `<div draggable="true" data-idx="${idx}" style="padding:8px;border:1px solid #ccc;margin-bottom:4px;background:#fff;cursor:move">${item.name}</div>`).join('');
      Array.from(list.children).forEach(el => {
        el.ondragstart = e => { e.dataTransfer.setData('text/plain', el.dataset.idx); };
        el.ondragover = e => { e.preventDefault(); };
        el.ondrop = e => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData('text/plain'));
          const to = Number(el.dataset.idx);
          if (from !== to) {
            const moved = items.splice(from, 1)[0];
            items.splice(to, 0, moved);
            renderList();
          }
        };
      });
    }
    // Сохранить порядок
    if (saveBtn) saveBtn.onclick = async () => {
      await fetch('/api/notifications/templates/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: items.map(i => i.name) })
      });
      alert('Порядок сохранён!');
    };
    loadItems();
  }
});
// --- Интеграция AI-рекомендаций в dashboard ---
window.addEventListener('DOMContentLoaded', () => {
  const aiRecPanel = document.getElementById('aiRecommendPanel');
  if (aiRecPanel) {
    const segmentInput = document.getElementById('aiRecSegment');
    const channelInput = document.getElementById('aiRecChannel');
    const templateInput = document.getElementById('aiRecTemplate');
    const statsInput = document.getElementById('aiRecStats');
    const runBtn = document.getElementById('aiRecRunBtn');
    const resultBox = document.getElementById('aiRecResult');
    if (runBtn) runBtn.onclick = async () => {
      const segment = segmentInput?.value || '';
      const channel = channelInput?.value || '';
      const template = templateInput?.value || '';
      let stats = [];
      try { stats = JSON.parse(statsInput?.value || '[]'); } catch {}
      const res = await fetch('/api/notifications/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, channel, template, stats })
      });
      const data = await res.json();
      resultBox.innerHTML = `<b>Рекомендация:</b> ${data.recommendation}<br><b>Прогнозируемая конверсия:</b> ${data.predictedConversion?.toFixed(2)}%`;
    };
  }
});
// --- Ограничение доступа к разделам и действиям dashboard по ролям/правам ---
window.addEventListener('DOMContentLoaded', () => {
  async function getCurrentUser() {
    try {
      const res = await fetch('/api/rbac/users/me');
      const data = await res.json();
      return data.user;
    } catch { return null; }
  }
  function restrictByPermission(elementId, permission, user) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!user?.permissions?.includes(permission)) {
      el.style.display = 'none';
    }
  }
  function restrictByRole(elementId, role, user) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (user?.role !== role) {
      el.style.display = 'none';
    }
  }
  getCurrentUser().then(user => {
    // Пример: скрыть админ-панель для не-админов
    restrictByRole('rbacAdminPanel', 'admin', user);
    // Пример: скрыть экспорт BI для не-модераторов
    restrictByPermission('dashboardBIExportPanel', 'manage:metrics', user);
    // Пример: скрыть A/B тесты для не-менеджеров уведомлений
    restrictByPermission('abTestPanel', 'manage:notifications', user);
    // ...можно добавить другие ограничения по ролям/правам...
  });
});
// --- Админ-панель управления ролями и правами пользователей ---
window.addEventListener('DOMContentLoaded', () => {
  const rbacPanel = document.getElementById('rbacAdminPanel');
  if (rbacPanel) {
    const usersList = document.getElementById('rbacUsersList');
    const rolesList = document.getElementById('rbacRolesList');
    const permsList = document.getElementById('rbacPermsList');
    const assignRoleBtn = document.getElementById('rbacAssignRoleBtn');
    const addPermBtn = document.getElementById('rbacAddPermBtn');
    const removePermBtn = document.getElementById('rbacRemovePermBtn');
    // Загрузка пользователей
    const loadUsers = async () => {
      const res = await fetch('/api/rbac/users');
      const data = await res.json();
      usersList.innerHTML = data.users.map(u => `<option value="${u.id}">${u.username} (${u.role})</option>`).join('');
    };
    // Загрузка ролей и разрешений
    const loadRolesPerms = async () => {
      const res = await fetch('/api/rbac/roles');
      const data = await res.json();
      rolesList.innerHTML = Object.values(data.roles).map(r => `<option value="${r}">${r}</option>`).join('');
      permsList.innerHTML = Object.values(data.permissions).map(p => `<option value="${p}">${p}</option>`).join('');
    };
    // Назначить роль
    if (assignRoleBtn) assignRoleBtn.onclick = async () => {
      const userId = usersList.value;
      const role = rolesList.value;
      await fetch('/api/rbac/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role })
      });
      loadUsers();
      alert('Роль назначена!');
    };
    // Добавить разрешение
    if (addPermBtn) addPermBtn.onclick = async () => {
      const userId = usersList.value;
      const permission = permsList.value;
      await fetch('/api/rbac/add-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission })
      });
      loadUsers();
      alert('Разрешение добавлено!');
    };
    // Удалить разрешение
    if (removePermBtn) removePermBtn.onclick = async () => {
      const userId = usersList.value;
      const permission = permsList.value;
      await fetch('/api/rbac/remove-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission })
      });
      loadUsers();
      alert('Разрешение удалено!');
    };
    // Инициализация
    loadUsers();
    loadRolesPerms();
  }
});
// --- Клиентское подключение к WebSocket для real-time аналитики ---
window.addEventListener('DOMContentLoaded', () => {
  let ws;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}`;
    ws = new window.WebSocket(wsUrl);
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'analytics-update' && msg.data) {
          // Пример: обновить графики, если есть новые данные
          if (msg.data.aiReports && window.showChartAiReports) window.showChartAiReports(msg.data.aiReports);
          if (msg.data.emailStats && window.showChartEmailStats) window.showChartEmailStats(msg.data.emailStats);
          if (msg.data.channels && window.showChartChannelsCompare) window.showChartChannelsCompare(msg.data.channels);
          if (msg.data.failures && window.showChartFailures) window.showChartFailures(msg.data.failures);
          if (msg.data.biExport && window.showChartBiExport) window.showChartBiExport(msg.data.biExport);
          // Можно добавить другие обновления
        }
      } catch (e) { console.error('WS message error', e); }
    };
    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000); // Авто-реконнект
    };
  }
  connectWebSocket();
});
// --- Гибкая настройка сегментации: визуальный редактор и динамические отчёты ---
window.addEventListener('DOMContentLoaded', () => {
  const segmentPanel = document.getElementById('segmentEditorPanel');
  if (segmentPanel) {
    const segmentList = document.getElementById('segmentList');
    const segmentEditor = document.getElementById('segmentEditor');
    const segmentSaveBtn = document.getElementById('segmentSaveBtn');
    const segmentReport = document.getElementById('segmentReportResult');
    // Загрузка списка сегментов
    const loadSegments = async () => {
      const res = await fetch('/api/notifications/stats/segments');
      const data = await res.json();
      if (data.segments && data.segments.length) {
        segmentList.innerHTML = data.segments.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      } else segmentList.innerHTML = '<option>Нет сегментов</option>';
    };
    // Загрузка и редактирование сегмента
    segmentList.onchange = async () => {
      const id = segmentList.value;
      if (!id) return;
      const res = await fetch('/api/notifications/stats/segments/' + encodeURIComponent(id));
      const data = await res.json();
      if (data.segment) {
        segmentEditor.value = data.segment.definition || '';
      } else segmentEditor.value = '';
    };
    // Сохранение сегмента
    if (segmentSaveBtn) {
      segmentSaveBtn.onclick = async () => {
        const id = segmentList.value;
        const def = segmentEditor.value;
        await fetch('/api/notifications/stats/segments/' + encodeURIComponent(id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition: def })
        });
        alert('Сегмент сохранён!');
        loadSegments();
      };
    }
    // Динамический отчёт по выбранному сегменту
    segmentList.addEventListener('change', async () => {
      const id = segmentList.value;
      if (!id) return;
      const res = await fetch('/api/notifications/stats/segmented?id=' + encodeURIComponent(id));
      const data = await res.json();
      if (data.stats && data.stats.length) {
        segmentReport.innerHTML = '<ul>' + data.stats.map(s => `<li>${s.metric}: ${s.value}</li>`).join('') + '</ul>';
      } else segmentReport.innerHTML = 'Нет данных по сегменту.';
    });
    // Инициализация
    loadSegments();
  }
});
// --- Дашборд для A/B тестов: сравнение конверсии и рекомендации ---
window.addEventListener('DOMContentLoaded', () => {
  const abPanel = document.getElementById('abTestPanel');
  if (abPanel) {
    const abResult = document.getElementById('abTestResult');
    const abRecommendation = document.getElementById('abTestRecommendation');
    // Визуализация результатов и рекомендаций
    const showAbTestChart = (results) => {
      if (!results || !results.variants) return;
      const labels = results.variants.map(v => v.name || v.variant);
      const conversions = results.variants.map(v => Number(v.conversion||0));
      abResult.innerHTML += '<canvas id="abTestChart" width="600" height="180" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001;margin-top:16px"></canvas>';
      const chartEl = document.getElementById('abTestChart');
      if (!chartEl) return;
      if (window.abTestChart) window.abTestChart.destroy?.();
      window.abTestChart = new window.Chart(chartEl.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Конверсия (%)', data: conversions, backgroundColor: '#5bc0be' }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Конверсия (%)' } } }
        }
      });
      // Автоматическая рекомендация
      const maxConv = Math.max(...conversions);
      const bestIdx = conversions.findIndex(c => c === maxConv);
      const bestVariant = labels[bestIdx];
      abRecommendation.innerHTML = `<b>Рекомендация:</b> Победитель — <span style='color:#28a745'>${bestVariant}</span> (${maxConv}%)`;
    };
    // Переопределим обработчик loadAbTestBtn
    const loadBtn = document.getElementById('loadAbTestBtn');
    if (loadBtn) {
      loadBtn.onclick = async () => {
        const testName = document.getElementById('abTestName')?.value || '';
        const res = await fetch('/api/notifications/abtest/results/' + encodeURIComponent(testName));
        const data = await res.json();
        if (data.variants && data.variants.length) {
          abResult.innerHTML = '<ul>' + data.variants.map(v => `<li>${v.name || v.variant}: ${v.conversion}% (${v.count} отправок)</li>`).join('') + '</ul>';
          showAbTestChart(data);
        } else abResult.innerHTML = 'Нет результатов A/B теста.';
      };
    }
  }
});
// --- Уведомления о аномалиях: автоматический анализ и push-уведомления ---
window.addEventListener('DOMContentLoaded', () => {
  const anomalyPanel = document.getElementById('anomalyNotifyPanel');
  if (anomalyPanel) {
    const anomalyResult = document.getElementById('anomalyNotifyResult');
    const anomalyStatus = document.getElementById('anomalyNotifyStatus');
    // Автоматический анализ ошибок (каждые 60 сек)
    const checkAnomalies = async () => {
      try {
        const res = await fetch('/api/notifications/failures/analyze?anomaly=1');
        const data = await res.json();
        if (data.anomalies && data.anomalies.length) {
          anomalyResult.innerHTML = '<ul>' + data.anomalies.map(a => `<li><b>${a.channel}</b>: ${a.type} — ${a.count} (${a.period})<br>${a.recommendation||''}</li>`).join('') + '</ul>';
          anomalyStatus.innerHTML = '<span style="color:#d9534f;font-weight:bold">Обнаружены аномалии!</span>';
          // Push-уведомление
          if (window.Notification && Notification.permission === 'granted') {
            data.anomalies.forEach(a => {
              new Notification('Аномалия рассылки', { body: `${a.channel}: ${a.type} — ${a.count} (${a.period})` });
            });
          }
        } else {
          anomalyResult.innerHTML = 'Аномалий не обнаружено.';
          anomalyStatus.innerHTML = '<span style="color:#28a745;font-weight:bold">Всё нормально</span>';
        }
      } catch {
        anomalyResult.innerHTML = 'Ошибка анализа.';
        anomalyStatus.innerHTML = '';
      }
    };
    // Запросить разрешение на push-уведомления
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    // Запуск анализа при загрузке и каждые 60 сек
    checkAnomalies();
    setInterval(checkAnomalies, 60000);
    // Кнопка ручной проверки
    const anomalyCheckBtn = document.getElementById('anomalyNotifyCheckBtn');
    if (anomalyCheckBtn) anomalyCheckBtn.onclick = checkAnomalies;
  }
});
// --- Интеграция с внешними BI-системами (Google Data Studio, Power BI) ---
window.addEventListener('DOMContentLoaded', () => {
  const biPanel = document.getElementById('dashboardBIExportPanel');
  if (biPanel) {
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    // Универсальный сбор данных для BI-экспорта
    const collectAnalyticsData = async () => {
      const filters = {};
      document.querySelectorAll('#dashboardFiltersPanel select, #dashboardFiltersPanel input').forEach(el => {
        if (el.value) filters[el.name||el.id] = el.value;
      });
      const params = new URLSearchParams(filters);
      const endpoints = [
        { key: 'aiReports', url: '/api/notifications/report?' + params },
        { key: 'emailStats', url: '/api/notifications/email/stats?' + params },
        { key: 'channels', url: '/api/notifications/stats/channels?' + params },
        { key: 'failures', url: '/api/notifications/failures/analyze?' + params },
        { key: 'biExport', url: '/api/notifications/stats/export?' + params },
        { key: 'templateHistory', url: '/api/notifications/templates/history/all?' + params }
      ];
      const results = {};
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url);
          results[ep.key] = await res.json();
        } catch { results[ep.key] = {}; }
      }
      return results;
    };
    // CSV экспорт для Google Data Studio, Power BI
    if (exportCsvBtn) {
      exportCsvBtn.onclick = async () => {
        const data = await collectAnalyticsData();
        const res = await fetch('/api/notifications/stats/export/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_bi_export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        alert('CSV-файл готов для импорта в Google Data Studio или Power BI. Следуйте инструкциям в BI-системе для загрузки файла.');
      };
    }
    // JSON экспорт для Power BI
    if (exportJsonBtn) {
      exportJsonBtn.onclick = async () => {
        const data = await collectAnalyticsData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_bi_export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        alert('JSON-файл готов для импорта в Power BI. Следуйте инструкциям в Power BI для загрузки файла.');
      };
    }
  }
});
// --- Экспорт аналитики в PDF/Excel ---
window.addEventListener('DOMContentLoaded', () => {
  const exportPanel = document.getElementById('dashboardExportPanel');
  if (exportPanel) {
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    // Универсальный сбор данных для экспорта
    const collectAnalyticsData = async () => {
      // Собираем все данные с API с текущими фильтрами
      const filters = {};
      document.querySelectorAll('#dashboardFiltersPanel select, #dashboardFiltersPanel input').forEach(el => {
        if (el.value) filters[el.name||el.id] = el.value;
      });
      const params = new URLSearchParams(filters);
      const endpoints = [
        { key: 'aiReports', url: '/api/notifications/report?' + params },
        { key: 'emailStats', url: '/api/notifications/email/stats?' + params },
        { key: 'channels', url: '/api/notifications/stats/channels?' + params },
        { key: 'failures', url: '/api/notifications/failures/analyze?' + params },
        { key: 'biExport', url: '/api/notifications/stats/export?' + params },
        { key: 'templateHistory', url: '/api/notifications/templates/history/all?' + params }
      ];
      const results = {};
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url);
          results[ep.key] = await res.json();
        } catch { results[ep.key] = {}; }
      }
      return results;
    };
    // PDF экспорт
    if (exportPdfBtn) {
      exportPdfBtn.onclick = async () => {
        const data = await collectAnalyticsData();
        const res = await fetch('/api/notifications/stats/export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_report.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      };
    }
    // Excel экспорт
    if (exportExcelBtn) {
      exportExcelBtn.onclick = async () => {
        const data = await collectAnalyticsData();
        const res = await fetch('/api/notifications/stats/export/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_report.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      };
    }
  }
});
// --- Интерактивные фильтры для всех графиков dashboard ---
window.addEventListener('DOMContentLoaded', () => {
  // Универсальный фильтр
  const filterPanel = document.getElementById('dashboardFiltersPanel');
  if (filterPanel) {
    const filterPeriod = document.getElementById('filterPeriod');
    const filterSegment = document.getElementById('filterSegment');
    const filterChannel = document.getElementById('filterChannel');
    // Применение фильтров к API-запросам
    const getFilters = () => {
      return {
        period: filterPeriod?.value || '',
        segment: filterSegment?.value || '',
        channel: filterChannel?.value || ''
      };
    };
    // Переопределить обработчики загрузки данных для графиков
    const overrideLoad = (btnId, api, resultId, showChart) => {
      const btn = document.getElementById(btnId);
      const result = document.getElementById(resultId);
      if (btn && result) {
        btn.onclick = async () => {
          const filters = getFilters();
          const params = new URLSearchParams(filters);
          const res = await fetch(api + (api.includes('?') ? '&' : '?') + params.toString());
          const data = await res.json();
          showChart(data);
        };
      }
    };
    // Применить к каждому графику
    overrideLoad('loadAiReportBtn', '/api/notifications/report', 'aiReportResult', (data) => {
      // ...существующий showChart для AI-отчётов...
      if (data.reports && data.reports.length) {
        const aiResult = document.getElementById('aiReportResult');
        aiResult.innerHTML = '<ul>' + data.reports.map(r => `<li>${r.date || r.created}: ${r.summary || ''} <br>Эффективность: ${r.efficiency || '-'}%</li>`).join('') + '</ul>';
        window.showChartAiReports?.(data.reports);
      } else document.getElementById('aiReportResult').innerHTML = 'Нет AI-отчётов.';
    });
    overrideLoad('loadEmailStatsBtn', '/api/notifications/email/stats', 'emailStatsResult', (data) => {
      if (data.stats && data.stats.length) {
        const emailResult = document.getElementById('emailStatsResult');
        emailResult.innerHTML = '<ul>' + data.stats.map(s => `<li>${s.date || s.sent_date}: отправлено ${s.sent}, открыто ${s.opened}, переходы ${s.clicked}</li>`).join('') + '</ul>';
        window.showChartEmailStats?.(data.stats);
      } else document.getElementById('emailStatsResult').innerHTML = 'Нет данных по email-рассылкам.';
    });
    overrideLoad('loadChannelsCompareBtn', '/api/notifications/stats/channels', 'channelsCompareResult', (data) => {
      if (data.channels && data.channels.length) {
        const channelResult = document.getElementById('channelsCompareResult');
        channelResult.innerHTML = '<ul>' + data.channels.map(c => `<li>${c.channel}: успешные ${c.success}, ошибочные ${c.failed}</li>`).join('') + '</ul>';
        window.showChartChannelsCompare?.(data.channels);
      } else document.getElementById('channelsCompareResult').innerHTML = 'Нет данных по каналам.';
    });
    overrideLoad('loadFailuresBtn', '/api/notifications/failures/analyze', 'failuresResult', (data) => {
      if (data.failures && data.failures.length) {
        const failuresResult = document.getElementById('failuresResult');
        failuresResult.innerHTML = '<ul>' + data.failures.map(f => `<li>${f.channel} — ${f.status} (${f.count})<br>с ${f.first} по ${f.last}</li>`).join('') + '</ul>';
        window.showChartFailures?.(data.failures);
      } else document.getElementById('failuresResult').innerHTML = 'Нет ошибок.';
    });
    overrideLoad('loadBiExportBtn', '/api/notifications/stats/export', 'biExportResult', (data) => {
      if (data.segments && data.segments.length) {
        const biResult = document.getElementById('biExportResult');
        biResult.innerHTML = '<ul>' + data.segments.map(s => `<li>${s.segment}: ${s.count}</li>`).join('') + '</ul>';
        window.showChartBiExport?.(data.segments);
      } else document.getElementById('biExportResult').innerHTML = 'Нет данных.';
    });
    // ...можно добавить для других графиков аналогично...
  }
});
// --- Timeline истории изменений шаблонов ---
window.addEventListener('DOMContentLoaded', () => {
  const templatePanel = document.getElementById('templateHistoryPanel');
  if (templatePanel) {
    const templateResult = document.getElementById('templateHistoryResult');
    const filterAuthor = document.getElementById('templateFilterAuthor');
    const filterType = document.getElementById('templateFilterType');
    if (templateResult) {
      const renderTimeline = (history) => {
        templateResult.innerHTML = '<div id="templateTimeline" style="margin-top:16px"></div>';
        const timeline = document.getElementById('templateTimeline');
        if (!timeline) return;
        timeline.innerHTML = history.map(h => `
          <div style="border-left:3px solid #007bff;padding-left:12px;margin-bottom:12px;">
            <div style="font-weight:bold">${h.date || h.changed_at} — ${h.type || h.action}</div>
            <div>Автор: ${h.author || h.user || '-'}</div>
            <div>Шаблон: ${h.template || h.name || '-'}</div>
            <div>Описание: ${h.description || h.details || '-'}</div>
          </div>
        `).join('');
      };
      // Фильтрация
      const applyFilters = (history) => {
        let filtered = history;
        if (filterAuthor && filterAuthor.value) filtered = filtered.filter(h => (h.author||h.user||'').toLowerCase().includes(filterAuthor.value.toLowerCase()));
        if (filterType && filterType.value) filtered = filtered.filter(h => (h.type||h.action||'').toLowerCase().includes(filterType.value.toLowerCase()));
        renderTimeline(filtered);
      };
      // Переопределим обработчик loadTemplateHistoryBtn
      const loadBtn = document.getElementById('loadTemplateHistoryBtn');
      let lastHistory = [];
      if (loadBtn) {
        loadBtn.onclick = async () => {
          const name = document.getElementById('templateHistoryName')?.value || '';
          const res = await fetch('/api/notifications/templates/history/' + encodeURIComponent(name));
          const data = await res.json();
          if (data.history && data.history.length) {
            lastHistory = data.history;
            renderTimeline(data.history);
          } else templateResult.innerHTML = 'Нет истории изменений.';
        };
      }
      // Обработчики фильтров
      if (filterAuthor) filterAuthor.oninput = () => applyFilters(lastHistory);
      if (filterType) filterType.oninput = () => applyFilters(lastHistory);
    }
  }
});
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
