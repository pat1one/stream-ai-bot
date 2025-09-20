// dashboard-config.js — глобальные настройки dashboard
export default {
  apiBaseUrl: '/api',
  wsDefaultUrl: 'ws://localhost:3000',
  defaultTheme: 'dark',
  defaultLang: 'ru',
  enableRbac: true,
  enableMetrics: true,
  enableNotifications: true,
  enableOAuth: true // включить после интеграции OAuth
};
