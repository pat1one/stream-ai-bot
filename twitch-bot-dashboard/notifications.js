// --- AI-отчёт по эффективности уведомлений ---
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('notificationAISummaryBtn');
    const aiResult = document.getElementById('notificationAISummaryResult');
    if (aiBtn && aiResult) {
      aiBtn.addEventListener('click', async () => {
        aiResult.innerHTML = '<span class="loader" style="display:inline-block;width:20px;height:20px;border:3px solid #36a2eb;border-radius:50%;border-right-color:transparent;animation:spin 1s linear infinite;vertical-align:middle;margin-right:10px"></span> Анализируем...';
        try {
          const res = await fetch('/api/notifications/stats');
          const data = await res.json();
          if (!data.stats || !Array.isArray(data.stats) || !data.stats.length) {
            aiResult.innerHTML = 'Нет данных для анализа.';
            return;
          }
          // AI-like summary: простая эвристика (можно заменить на реальный AI API)
          const stats = data.stats;
          const totalSent = stats.reduce((a, s) => a + (s.sent || 0), 0);
          const totalOpened = stats.reduce((a, s) => a + (s.opened || 0), 0);
          const totalClicked = stats.reduce((a, s) => a + (s.clicked || 0), 0);
          const avgConv = stats.length ? (stats.reduce((a, s) => a + (s.conversion || 0), 0) / stats.length) : 0;
          const avgCtr = stats.length ? (stats.reduce((a, s) => a + (s.ctr || 0), 0) / stats.length) : 0;
          const best = stats.reduce((max, s) => (s.ctr > (max?.ctr||0) ? s : max), null);
          const worst = stats.reduce((min, s) => (s.ctr < (min?.ctr||Infinity) ? s : min), null);
          let summary = `<b>AI-отчёт по эффективности уведомлений</b><br><br>`;
          summary += `Всего отправлено: <b>${totalSent}</b><br>`;
          summary += `Открыто: <b>${totalOpened}</b> (${((totalOpened/totalSent)*100).toFixed(1)}%)<br>`;
          summary += `Клики: <b>${totalClicked}</b> (${((totalClicked/totalSent)*100).toFixed(1)}%)<br>`;
          summary += `Средняя конверсия: <b>${(avgConv*100).toFixed(1)}%</b>, средний CTR: <b>${(avgCtr*100).toFixed(1)}%</b><br><br>`;
          if (best) summary += `Лучший шаблон по CTR: <b>${escapeHtml(best.template)}</b> (${(best.ctr*100).toFixed(1)}%)<br>`;
          if (worst) summary += `Худший шаблон по CTR: <b>${escapeHtml(worst.template)}</b> (${(worst.ctr*100).toFixed(1)}%)<br>`;
          // Простая аномалия: если разница между лучшим и худшим > 30%
          if (best && worst && (best.ctr-worst.ctr) > 0.3) summary += `<span style="color:#d9534f">Внимание: большая разница в эффективности между шаблонами!</span><br>`;
          // Рекомендация
          if (avgCtr < 0.1) summary += `<span style="color:#d9534f">Рекомендация: попробуйте улучшить тексты и call-to-action в уведомлениях.</span><br>`;
          else if (avgCtr > 0.25) summary += `<span style="color:#5cb85c">Отличный результат! Продолжайте в том же духе.</span><br>`;
          aiResult.innerHTML = summary;
        } catch (e) {
          aiResult.innerHTML = `<span style="color:red">Ошибка анализа: ${escapeHtml(e.message)}</span>`;
        }
      });
    }
  });
}
// --- Notification Statistics UI ---
// Utility to escape HTML special characters
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function (c) {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
    }
  });
}
export async function renderNotificationStatsSection() {
  // --- Аналитика по тегам ---
  const tagsAnalyticsEl = document.getElementById('notificationTagsAnalytics');
  if (tagsAnalyticsEl) {
    // Собираем агрегированные данные по тегам
    const tagStats = {};
    for (const s of stats) {
      if (Array.isArray(s.tags)) {
        for (const tag of s.tags) {
          if (!tagStats[tag]) tagStats[tag] = { sent: 0, opened: 0, clicked: 0 };
          tagStats[tag].sent += s.sent || 0;
          tagStats[tag].opened += s.opened || 0;
          tagStats[tag].clicked += s.clicked || 0;
        }
      }
    }
    // Топ-10 тегов по отправленным
    const topTags = Object.entries(tagStats)
      .sort((a, b) => b[1].sent - a[1].sent)
      .slice(0, 10);
    if (!topTags.length) {
      tagsAnalyticsEl.innerHTML = '';
      if (window.notificationTagsChart) window.notificationTagsChart.destroy?.();
    } else {
      tagsAnalyticsEl.innerHTML = `
        <h3 style="margin:24px 0 8px 0">Аналитика по тегам (топ-10)</h3>
        <canvas id="notificationTagsChart" width="700" height="260" style="max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px #0001"></canvas>
      `;
      const chartEl = document.getElementById('notificationTagsChart');
      if (chartEl) {
        const labels = topTags.map(([tag]) => tag);
        const sent = topTags.map(([, v]) => v.sent);
        const opened = topTags.map(([, v]) => v.opened);
        const clicked = topTags.map(([, v]) => v.clicked);
        if (window.notificationTagsChart) window.notificationTagsChart.destroy();
        window.notificationTagsChart = new window.Chart(chartEl.getContext('2d'), {
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
      }
    }
  }
  const container = document.getElementById('notificationStatsSection');
  if (!container) return;
  const tableWrap = document.getElementById('notificationStatsTableWrap');
  if (!tableWrap) return;
  tableWrap.innerHTML = `<div class="stats-loading" style="padding:32px;text-align:center;font-size:1.2em;color:#888;">
    <span class="loader" style="display:inline-block;width:24px;height:24px;border:3px solid #36a2eb;border-radius:50%;border-right-color:transparent;animation:spin 1s linear infinite;vertical-align:middle;margin-right:10px"></span>
    Загрузка статистики...
    <style>
      @keyframes spin { 100% { transform: rotate(360deg); } }
      .stats-table { width:100%; border-collapse:collapse; font-size:1em; }
      .stats-table th, .stats-table td { padding:6px 10px; border:1px solid #e0e0e0; text-align:center; }
      .stats-table th { background:#f6f8fa; position:sticky; top:0; z-index:1; }
      .stats-table tr:nth-child(even) { background:#fcfcfc; }
      .stats-table { overflow-x:auto; display:block; max-width:100vw; }
      #notificationStatsChart { max-width:100%; height:auto; }
      @media (max-width: 700px) { .stats-table, .stats-table th, .stats-table td { font-size:0.92em; } }
    </style>
  </div>`;

  // Получить значения фильтров
  const templateFilter = (document.getElementById('statsFilterTemplate')?.value || '').toLowerCase();
  const categoryFilter = (document.getElementById('statsFilterCategory')?.value || '').toLowerCase();
  const tagsFilterRaw = (document.getElementById('statsFilterTags')?.value || '').toLowerCase();
  const tagsFilter = tagsFilterRaw.split(',').map(t => t.trim()).filter(Boolean);
  const fromDate = document.getElementById('statsFilterFrom')?.value;
  const toDate = document.getElementById('statsFilterTo')?.value;

  try {
    const res = await fetch('/api/notifications/stats');
    const data = await res.json();
    if (!data.stats || !Array.isArray(data.stats)) {
  tableWrap.innerHTML = `<div style="padding:32px;text-align:center;color:#888">Нет данных</div>`;
      if (window.notificationStatsChart) window.notificationStatsChart.destroy();
      return;
    }
    let stats = data.stats;
    // Фильтрация по шаблону
    if (templateFilter) {
      stats = stats.filter(s => (s.template || '').toLowerCase().includes(templateFilter));
    }
    // Фильтрация по категории
    if (categoryFilter) {
      stats = stats.filter(s => (s.category || '').toLowerCase().includes(categoryFilter));
    }
    // Фильтрация по тегам
    if (tagsFilter.length) {
      stats = stats.filter(s => {
        if (!Array.isArray(s.tags)) return false;
        const tagsLower = s.tags.map(t => t.toLowerCase());
        return tagsFilter.every(tag => tagsLower.includes(tag));
      });
    }
    // Фильтрация по периоду (first_sent/last_sent)
    if (fromDate) {
      stats = stats.filter(s => s.last_sent && s.last_sent >= fromDate);
    }
    if (toDate) {
      stats = stats.filter(s => s.first_sent && s.first_sent <= toDate);
    }
    if (!stats.length) {
  tableWrap.innerHTML = `<div style="padding:32px;text-align:center;color:#888">Нет данных по выбранным фильтрам</div>`;
      if (window.notificationStatsChart) window.notificationStatsChart.destroy();
      return;
    }

    // --- Chart.js визуализация ---
    const chartEl = document.getElementById('notificationStatsChart');
    if (chartEl) {
      const labels = stats.map(s => s.template);
      const sent = stats.map(s => s.sent);
      const opened = stats.map(s => s.opened);
      const clicked = stats.map(s => s.clicked);
      const ctr = stats.map(s => +(s.ctr * 100).toFixed(1));
      if (window.notificationStatsChart) window.notificationStatsChart.destroy();
      window.notificationStatsChart = new window.Chart(chartEl.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Отправлено', data: sent, backgroundColor: '#36a2eb' },
            { label: 'Открыто', data: opened, backgroundColor: '#4bc0c0' },
            { label: 'Клики', data: clicked, backgroundColor: '#ffcd56' },
            { label: 'CTR (%)', data: ctr, backgroundColor: '#ff6384', type: 'line', yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Кол-во' } },
            y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'CTR (%)' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // --- Таблица ---
    tableWrap.innerHTML = `
      <h2>Статистика уведомлений</h2>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Шаблон</th>
            <th>Категория</th>
            <th>Отправлено</th>
            <th>Открыто</th>
            <th>Клики</th>
            <th>Конверсия</th>
            <th>CTR</th>
            <th>Период</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(s => `
            <tr>
              <td>${escapeHtml(s.template)}</td>
              <td>${escapeHtml(s.category || '')}</td>
              <td>${s.sent}</td>
              <td>${s.opened}</td>
              <td>${s.clicked}</td>
              <td>${(s.conversion * 100).toFixed(1)}%</td>
              <td>${(s.ctr * 100).toFixed(1)}%</td>
              <td>${s.first_sent ? escapeHtml(s.first_sent) : '-'} — ${s.last_sent ? escapeHtml(s.last_sent) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
  tableWrap.innerHTML = `<div style=\"color:red;padding:32px;text-align:center;font-size:1.1em\">Ошибка загрузки статистики:<br>${escapeHtml(e.message)}</div>`;
    if (window.notificationStatsChart) window.notificationStatsChart.destroy();
  }
}

// Привязка событий фильтрации и экспорта CSV
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const applyBtn = document.getElementById('statsFilterApply');
    const resetBtn = document.getElementById('statsFilterReset');
    if (applyBtn) applyBtn.addEventListener('click', renderNotificationStatsSection);
    if (resetBtn) resetBtn.addEventListener('click', () => {
      document.getElementById('statsFilterTemplate').value = '';
      document.getElementById('statsFilterCategory').value = '';
      document.getElementById('statsFilterFrom').value = '';
      document.getElementById('statsFilterTo').value = '';
      renderNotificationStatsSection();
    });

    // Экспорт CSV
    const exportBtn = document.getElementById('notificationStatsExportCsv');
    if (exportBtn) exportBtn.addEventListener('click', async () => {
      // Получить текущие данные (с учетом фильтров)
  const templateFilter = (document.getElementById('statsFilterTemplate')?.value || '').toLowerCase();
  const categoryFilter = (document.getElementById('statsFilterCategory')?.value || '').toLowerCase();
  const tagsFilterRaw = (document.getElementById('statsFilterTags')?.value || '').toLowerCase();
  const tagsFilter = tagsFilterRaw.split(',').map(t => t.trim()).filter(Boolean);
  const fromDate = document.getElementById('statsFilterFrom')?.value;
  const toDate = document.getElementById('statsFilterTo')?.value;
      let stats = [];
      try {
        const res = await fetch('/api/notifications/stats');
        const data = await res.json();
        if (data.stats && Array.isArray(data.stats)) {
          stats = data.stats;
          if (templateFilter) stats = stats.filter(s => (s.template || '').toLowerCase().includes(templateFilter));
          if (categoryFilter) stats = stats.filter(s => (s.category || '').toLowerCase().includes(categoryFilter));
          if (tagsFilter.length) {
            stats = stats.filter(s => {
              if (!Array.isArray(s.tags)) return false;
              const tagsLower = s.tags.map(t => t.toLowerCase());
              return tagsFilter.every(tag => tagsLower.includes(tag));
            });
          }
          if (fromDate) stats = stats.filter(s => s.last_sent && s.last_sent >= fromDate);
          if (toDate) stats = stats.filter(s => s.first_sent && s.first_sent <= toDate);
        }
      } catch {}
      if (!stats.length) return alert('Нет данных для экспорта');
      // Формируем CSV
      const header = ['Шаблон','Категория','Отправлено','Открыто','Клики','Конверсия','CTR','Период'];
      const rows = stats.map(s => [
        s.template,
        s.category || '',
        s.sent,
        s.opened,
        s.clicked,
        (s.conversion * 100).toFixed(1) + '%',
        (s.ctr * 100).toFixed(1) + '%',
        (s.first_sent || '-') + ' — ' + (s.last_sent || '-')
      ]);
      const csv = [header, ...rows].map(r => r.map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notification-stats.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });
}
// notifications.js
class NotificationClient {
  constructor(serverUrl, authToken) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.ws = null;
    this.onNotification = null;
    this.onNotificationRead = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Начальная задержка 1 секунда
    this.notifications = new Map(); // Локальный кеш уведомлений

    // Проверяем поддержку браузерных уведомлений
    this.browserNotificationsSupported = 'Notification' in window;
    if (this.browserNotificationsSupported) {
      // Запрашиваем разрешение на отправку уведомлений
      Notification.requestPermission();
    }
  }




  // Обработка закрытия соединения
  handleClose(event) {
    if (event.code !== 1000) { // Если закрытие не было штатным
      this.reconnect();
    }
  }

  // Обработка ошибок соединения
  handleError(error) {
    console.error('WebSocket error:', error);
  }

  // Переподключение при разрыве соединения
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Увеличиваем задержку для следующей попытки (экспоненциальный backoff)
    this.reconnectDelay *= 2;
  }

  // Обработка нового уведомления
  handleNewNotification(notification) {
    // Сохраняем в локальный кеш
    this.notifications.set(notification.id, notification);

    // Вызываем колбэк, если он установлен
    if (this.onNotification) {
      this.onNotification(notification);
    }

    // Показываем браузерное уведомление, если поддерживается
    this.showBrowserNotification(notification);
  }

  // Обработка списка уведомлений
  handleNotificationList(notifications) {
    notifications.forEach(notification => {
      this.notifications.set(notification.id, notification);
    });

    // Вызываем колбэк для каждого уведомления
    if (this.onNotification) {
      notifications.forEach(notification => {
        this.onNotification(notification);
      });
    }
  }

  // Обработка прочтения уведомления
  handleNotificationRead(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      
      if (this.onNotificationRead) {
        this.onNotificationRead(notificationId);
      }
    }
  }

  // Показ браузерного уведомления
  showBrowserNotification(notification) {
    if (this.browserNotificationsSupported && Notification.permission === 'granted') {
      const options = {
        body: notification.message,
        icon: notification.icon || '/path/to/default/icon.png',
        tag: notification.id // Для группировки одинаковых уведомлений
      };

      const browserNotification = new Notification(notification.title || 'New Notification', options);

      // Обработка клика по уведомлению
      browserNotification.onclick = () => {
        // Фокусируем окно
        window.focus();

        // Можно добавить навигацию к уведомлению
        if (notification.url) {
          window.location.href = notification.url;
        }

        // Закрываем браузерное уведомление
        browserNotification.close();

        // Отмечаем как прочитанное
        this.markAsRead(notification.id);
      };
    }
  }

  // Отметка уведомления как прочитанного
  markAsRead(notificationId) {
    // Отправляем на сервер
    this.ws.send(JSON.stringify({
      type: 'mark_read',
      notificationId
    }));

    // Обновляем локальное состояние
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  // Получение всех непрочитанных уведомлений
  getUnreadNotifications() {
    return Array.from(this.notifications.values())
      .filter(notification => !notification.read);
  }

  // Очистка уведомлений старше определенного времени
  cleanOldNotifications(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней по умолчанию
    const now = Date.now();
    for (const [id, notification] of this.notifications.entries()) {
      if (now - notification.timestamp > maxAge) {
        this.notifications.delete(id);
      }
    }
  }

  // Закрытие соединения
  disconnect() {
    if (this.ws) {
      this.ws.close(1000); // Штатное закрытие
      this.ws = null;
    }
  }
}

// Пример использования:
/*
const client = new NotificationClient('wss://your-server/ws', 'your-auth-token');

// Обработка новых уведомлений
client.onNotification = (notification) => {
  console.log('New notification:', notification);
};

// Обработка прочтения уведомлений
client.onNotificationRead = (notificationId) => {
  console.log('Notification read:', notificationId);
};

// Подключение к серверу
client.connect();

// При закрытии страницы
window.addEventListener('beforeunload', () => {
  client.disconnect();
});
*/

// Экспортируем класс
export default NotificationClient;