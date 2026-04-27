// Logger.js - система логирования с цветами

let logSubscribers = [];

// Цветовые коды для консоли браузера
const BROWSER_STYLES = {
  info: 'color: #2196f3; font-weight: normal',
  success: 'color: #4caf50; font-weight: bold',
  warning: 'color: #ff9800; font-weight: normal',
  error: 'color: #f44336; font-weight: bold',
  debug: 'color: #9c27b0; font-weight: normal'
};

// CSS классы для UI консоли
export const LOG_STYLES = {
  info: 'console-info',
  success: 'console-success',
  warning: 'console-warning',
  error: 'console-error',
  debug: 'console-debug'
};

export const Logger = {
  subscribe(callback) {
    logSubscribers.push(callback);
    return () => {
      logSubscribers = logSubscribers.filter(cb => cb !== callback);
    };
  },

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const logEntry = { timestamp, message, type };

    // Выводим в консоль браузера с цветами
    const consoleMsg = `[${timestamp}] ${message}`;
    const style = BROWSER_STYLES[type] || BROWSER_STYLES.info;

    switch (type) {
      case 'error':
        console.error(`%c${consoleMsg}`, style);
        break;
      case 'warning':
        console.warn(`%c${consoleMsg}`, style);
        break;
      case 'success':
        console.log(`%c${consoleMsg}`, style);
        break;
      case 'debug':
        console.debug(`%c${consoleMsg}`, style);
        break;
      default:
        console.log(`%c${consoleMsg}`, style);
    }

    // Отправляем подписчикам
    logSubscribers.forEach(cb => cb(logEntry));
  },

  info(message) {
    this.log(message, 'info');
  },

  success(message) {
    this.log(message, 'success');
  },

  warn(message) {
    this.log(message, 'warning');
  },

  error(message) {
    this.log(message, 'error');
  },

  debug(message) {
    this.log(message, 'debug');
  },

  clear() {
    // Отправляем null для очистки всех логов
    logSubscribers.forEach(cb => cb(null));
  }
};
