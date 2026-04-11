import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

// ========== КРЕСТОВИНА ==========
export class Cross extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'cross', x_px, y_px, `${BaseElement.getAvailableTypes().cross} ${id}`, sectionType, a);
    this._b = 100;                   // Высота для прямоугольного сечения (только для расчета эквивалентного диаметра)
    this._l1 = 250;                  // Горизонтальная длина крестовины
    this._l2 = 250;                  // Вертикальная длина крестовины
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ДИНАМИЧЕСКИХ ОГРАНИЧЕНИЙ ==========

  getMinL1() {
    return this._a * 2;
  }

  getMaxL1() {
    return Math.min(5000, this._a * 20);
  }

  getMinL2() {
    return this._a * 2;
  }

  getMaxL2() {
    return Math.min(5000, this._a * 20);
  }

  // ========== ГЕТТЕРЫ И СЕТТЕРЫ ==========

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;

    let newValue = Math.max(20, Math.min(1000, value));

    // Сохраняем старые значения
    const oldL1 = this._l1;
    const oldL2 = this._l2;

    // Проверка: A не может быть больше половины горизонтальной длины
    if (newValue > this._l1 / 2) {
      // Пробуем увеличить L1
      const neededL1 = newValue * 2;
      if (neededL1 <= this.getMaxL1()) {
        this._l1 = neededL1;
      } else {
        return;
      }
    }

    // Проверка: A не может быть больше половины вертикальной длины
    if (newValue > this._l2 / 2) {
      // Пробуем увеличить L2
      const neededL2 = newValue * 2;
      if (neededL2 <= this.getMaxL2()) {
        this._l2 = neededL2;
      } else {
        // Возвращаем старые значения
        this._l1 = oldL1;
        this._l2 = oldL2;
        return;
      }
    }

    this._a = newValue;
    this.updatePorts();
    this.updateCalloutText();
  }

  get b() { return this._b; }

  set b(newB) {
    if (this._b === newB) return;
    this._b = Math.max(20, Math.min(1000, newB));
    this.updateCalloutText();
  }

  get l1() { return this._l1; }

  set l1(newLength) {
    if (this._l1 === newLength) return;

    const minVal = this.getMinL1();
    const maxVal = this.getMaxL1();
    let newValue = Math.max(minVal, Math.min(maxVal, newLength));

    // Проверка: A не может быть больше половины новой длины
    if (this._a > newValue / 2) {
      newValue = this._a * 2;
    }

    this._l1 = newValue;
    this.updatePorts();
    this.updateCalloutText();
  }

  get l2() { return this._l2; }

  set l2(newLength) {
    if (this._l2 === newLength) return;

    const minVal = this.getMinL2();
    const maxVal = this.getMaxL2();
    let newValue = Math.max(minVal, Math.min(maxVal, newLength));

    // Проверка: A не может быть больше половины новой длины
    if (this._a > newValue / 2) {
      newValue = this._a * 2;
    }

    this._l2 = newValue;
    this.updatePorts();
    this.updateCalloutText();
  }

  getWidth() {
    return this.mmToPx(this._l1);
  }

  getHeight() {
    return this.mmToPx(this._l2);
  }

  getTopLeft() {
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    return {
      x: this.x - width_px / 2,
      y: this.y - height_px / 2
    };
  }

  getCalloutText() {
    const baseText = `${super.getCalloutText()}`;
    if (this._sectionType === 'round') {
      return `${baseText}\nL1: ${this._l1} мм\nL2: ${this._l2} мм`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._l1} мм\nL2: ${this._l2} мм`;
    }
  }

  getParameters() {
    const baseParams = super.getParameters();

    if (this._sectionType === 'round') {
      return [
        ...baseParams,
        {
          name: 'l1',
          label: 'L1',
          type: 'number',
          step: 10,
          min: this.getMinL1(),
          max: this.getMaxL1(),
          value: this._l1,
          unit: 'мм'
        },
        {
          name: 'l2',
          label: 'L2',
          type: 'number',
          step: 10,
          min: this.getMinL2(),
          max: this.getMaxL2(),
          value: this._l2,
          unit: 'мм'
        }
      ];
    } else {
      return [
        ...baseParams,
        {
          name: 'b',
          label: 'B',
          type: 'number',
          step: 10,
          min: 20,
          max: 1000,
          value: this._b,
          unit: 'мм'
        },
        {
          name: 'l1',
          label: 'L1',
          type: 'number',
          step: 10,
          min: this.getMinL1(),
          max: this.getMaxL1(),
          value: this._l1,
          unit: 'мм'
        },
        {
          name: 'l2',
          label: 'L2',
          type: 'number',
          step: 10,
          min: this.getMinL2(),
          max: this.getMaxL2(),
          value: this._l2,
          unit: 'мм'
        }
      ];
    }
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    // Левый порт
    const leftX = topLeft.x;
    const leftY = centerY;
    const leftPos = this.rotatePoint(leftX, leftY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`,
      this.id, 'left', 'left', 0, height_px / 2, leftPos.x, leftPos.y
    ));

    // Правый порт
    const rightX = topLeft.x + width_px;
    const rightY = centerY;
    const rightPos = this.rotatePoint(rightX, rightY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`,
      this.id, 'right', 'right', width_px, height_px / 2, rightPos.x, rightPos.y
    ));

    // Верхний порт
    const topX = centerX;
    const topY = topLeft.y;
    const topPos = this.rotatePoint(topX, topY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'top')?.id || `port_${this.id}_top`,
      this.id, 'top', 'top', width_px / 2, 0, topPos.x, topPos.y
    ));

    // Нижний порт
    const bottomX = centerX;
    const bottomY = topLeft.y + height_px;
    const bottomPos = this.rotatePoint(bottomX, bottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'bottom')?.id || `port_${this.id}_bottom`,
      this.id, 'bottom', 'bottom', width_px / 2, height_px, bottomPos.x, bottomPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    if (this._sectionType === 'round') {
      this._createRoundCross(ctx);
    } else {
      this._createRectangularCross(ctx);
    }
  }

  _createRoundCross(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx();
    const radius_px = size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const horizontalY = centerY - radius_px;
    ctx.rect(topLeft.x, horizontalY, width_px, size_px);

    const verticalX = centerX - radius_px;
    ctx.rect(verticalX, topLeft.y, size_px, height_px);

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _createRectangularCross(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const a_px = this.getSizePx();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const horizontalY = centerY - a_px / 2;
    ctx.rect(topLeft.x, horizontalY, width_px, a_px);

    const verticalX = centerX - a_px / 2;
    ctx.rect(verticalX, topLeft.y, a_px, height_px);

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Замените метод draw
  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная линия
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Вертикальная линия
    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height_px);

    ctx.lineWidth = Math.max(2, 3 / scale);
    ctx.strokeStyle = isSelected ? '#e5ff00' : (isDarkTheme ? '#888' : '#333');
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);

    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height_px);

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._a || this._a <= 0) {
      return false;
    }

    if (ctx) {
      this.createPath(ctx);
      return ctx.isPointInPath(worldX, worldY);
    }

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    this.createPath(tempCtx);
    return tempCtx.isPointInPath(worldX, worldY);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      b: this._b,
      l1: this._l1,
      l2: this._l2,
    };
  }
}
