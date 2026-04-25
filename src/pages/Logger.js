// Logger.js - система логирования

let logSubscribers = [];

export const Logger = {
  subscribe(callback) {
    logSubscribers.push(callback);
    return () => {
      logSubscribers = logSubscribers.filter(cb => cb !== callback);
    };
  },

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };

    // Выводим в консоль браузера
    const consoleMsg = `[${timestamp}] ${message}`;
    if (type === 'error') {
      console.error(consoleMsg);
    } else if (type === 'warning') {
      console.warn(consoleMsg);
    } else if (type === 'success') {
      console.log(`%c${consoleMsg}`, 'color: green');
    } else {
      console.log(consoleMsg);
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

  clear() {
    logSubscribers.forEach(cb => cb(null));
  }
};
