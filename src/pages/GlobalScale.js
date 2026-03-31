// GlobalScale.js - синглтон для управления глобальным масштабом

class GlobalScaleManager {
  constructor() {
    this._mmPerPx = 1.0;
  }

  /**
   * Получить текущее значение масштаба (мм/пиксель)
   * @returns {number}
   */
  getMmPerPx() {
    return this._mmPerPx;
  }

  /**
   * Установить новое значение масштаба (мм/пиксель)
   * @param {number} value - новое значение масштаба
   */
  setMmPerPx(value) {
    if (typeof value === 'number' && !isNaN(value) && value > 0) {
      this._mmPerPx = value;
    } else {
      console.warn('Invalid mmPerPx value:', value);
    }
  }

  /**
   * Конвертировать миллиметры в пиксели
   * @param {number} mm - значение в миллиметрах
   * @returns {number}
   */
  mmToPx(mm) {
    return mm / this._mmPerPx;
  }

  /**
   * Конвертировать пиксели в миллиметры
   * @param {number} px - значение в пикселях
   * @returns {number}
   */
  pxToMm(px) {
    return px * this._mmPerPx;
  }

  /**
   * Сбросить масштаб к значению по умолчанию
   */
  reset() {
    this._mmPerPx = 1.0;
  }
}

// Экспортируем единственный экземпляр
export const globalScale = new GlobalScaleManager();

// Для обратной совместимости с существующим кодом
export function setGlobalMmPerPx(value) {
  globalScale.setMmPerPx(value);
}

export function getGlobalMmPerPx() {
  return globalScale.getMmPerPx();
}
