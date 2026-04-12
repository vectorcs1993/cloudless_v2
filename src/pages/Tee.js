import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'tee', x_px, y_px, `${BaseElement.getAvailableTypes().tee} ${id}`, sectionType, a);
    this._b = 100;                   // Высота для прямоугольного сечения (только для расчета эквивалентного диаметра)
    this._l1 = 250;                  // Длина основной магистрали (горизонталь)
    this._l2 = 250;                  // Длина ответвления (вертикаль)
    this._l3 = 0;                    // Смещение ответвления от центра (0 - по центру)
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ДИНАМИЧЕСКИХ ОГРАНИЧЕНИЙ ==========

  getMinL1() {
    return this._a * 2;
  }

  getMaxL1() {
    // Максимальная длина магистрали - 5000 мм или 20 * A
    return Math.min(5000, this._a * 20);
  }

  getMinL2() {
    return this._a;
  }

  getMaxL2() {
    // Максимальная длина ответвления - 3000 мм или 15 * A
    return Math.min(3000, this._a * 15);
  }

  getMinL3() {
    // Минимальное смещение (отрицательное)
    return -(this._l1 / 2 - this._a / 2);
  }

  getMaxL3() {
    // Максимальное смещение (положительное)
    return this._l1 / 2 - this._a / 2;
  }

  // ========== ГЕТТЕРЫ И СЕТТЕРЫ ==========

  // В файле Tee.js, исправьте сеттер a:

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;

    // Приводим значение к числу и ограничиваем глобальными пределами
    let newValue = Math.max(20, Math.min(1000, value));

    // Временно сохраняем старые значения для проверки
    const oldL1 = this._l1;
    const oldL2 = this._l2;
    const oldL3 = this._l3;

    // Проверка: A не может быть больше длины ответвления
    if (newValue > this._l2) {
      // Если не проходит, пробуем увеличить L2
      const newL2 = Math.max(newValue, this._l2);
      if (newL2 <= this.getMaxL2()) {
        this._l2 = newL2;
      } else {
        return; // Не можем установить
      }
    }

    // Проверка: A не может быть больше половины длины магистрали (с учетом смещения)
    const maxAllowedA = (this._l1 / 2 - Math.abs(this._l3)) * 2;
    if (newValue > maxAllowedA && maxAllowedA >= 20) {
      // Пробуем увеличить L1
      const neededL1 = (newValue / 2 + Math.abs(this._l3)) * 2;
      if (neededL1 <= this.getMaxL1()) {
        this._l1 = neededL1;
      } else {
        // Возвращаем старые значения
        this._l1 = oldL1;
        this._l2 = oldL2;
        this._l3 = oldL3;
        return;
      }
    }

    // Проверка: A должен быть меньше половины длины магистрали
    if (newValue > this._l1 / 2) {
      const neededL1 = newValue * 2;
      if (neededL1 <= this.getMaxL1()) {
        this._l1 = neededL1;
      } else {
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

  // Геттеры и сеттеры для длины основной магистрали (L1)
  get l1() { return this._l1; }

  set l1(newLength) {
    if (this._l1 === newLength) return;
    // Проверяем, не выходит ли смещение за пределы при новой длине
    if ((Math.abs(this._l3) + this._a / 2) > newLength / 2) return;
    const minVal = this.getMinL1();
    const maxVal = this.getMaxL1();
    this._l1 = Math.max(minVal, Math.min(maxVal, newLength));
    this.updatePorts();
  }

  // Геттеры и сеттеры для длины ответвления (L2)
  get l2() { return this._l2; }

  set l2(newLength) {
    if (this._l2 === newLength) return;
    const minVal = this.getMinL2();
    const maxVal = this.getMaxL2();
    this._l2 = Math.max(minVal, Math.min(maxVal, newLength));
    this.updatePorts();
  }

  // Геттеры и сеттеры для смещения ответвления (L3)
  get l3() { return this._l3; }

  set l3(newOffset) {
    if (this._l3 === newOffset) return;
    const minVal = this.getMinL3();
    const maxVal = this.getMaxL3();
    this._l3 = Math.max(minVal, Math.min(maxVal, newOffset));
    this.updatePorts();
  }

  // Получаем полные размеры элемента (bounding box)
  getWidth() {
    return this.mmToPx(this._l1);
  }

  getHeight() {
    return this.mmToPx(this._l2);
  }

  // Получаем точку привязки (верхний левый угол bounding box)
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
      return `${baseText}\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм`;
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
        },
        {
          name: 'l3',
          label: 'L3',
          type: 'number',
          step: 10,
          min: this.getMinL3(),
          max: this.getMaxL3(),
          value: this._l3,
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
        },
        {
          name: 'l3',
          label: 'L3',
          type: 'number',
          step: 10,
          min: this.getMinL3(),
          max: this.getMaxL3(),
          value: this._l3,
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
    const offset_px = this.mmToPx(this._l3);

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

    // Верхний порт (ответвление)
    const branchCenterX = centerX + offset_px;
    const topX = branchCenterX;
    const topY = topLeft.y;
    const topPos = this.rotatePoint(topX, topY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || `port_${this.id}_branch`,
      this.id, 'branch', 'top', width_px / 2 + offset_px, 0, topPos.x, topPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const size_px = this.getSizePx();
    const offset_px = this.mmToPx(this._l3);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная труба
    const horizontalY = centerY - size_px / 2;
    ctx.rect(topLeft.x, horizontalY, width_px, size_px);

    // Ответвление от горизонтальной трубы
    const branchX = centerX + offset_px - size_px / 2;
    const branchTop = topLeft.y;
    const connectionY = horizontalY;

    if (branchTop < connectionY) {
      ctx.rect(branchX, branchTop, size_px, connectionY - branchTop);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const offset_px = this.mmToPx(this._l3);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная линия (магистраль)
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Вертикальная линия (ответвление)
    const branchX = centerX + offset_px;
    ctx.moveTo(branchX, centerY);
    ctx.lineTo(branchX, topLeft.y);

    ctx.lineWidth = this.lineWidth;
    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = this.color;
    }
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
    const size_px = this.getSizePx();
    const offset_px = this.mmToPx(this._l3);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);

    // Горизонтальная центральная линия
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Вертикальная центральная линия ответвления
    const branchCenterX = centerX + offset_px;
    const horizontalTop = centerY - size_px / 2;
    ctx.moveTo(branchCenterX, horizontalTop);
    ctx.lineTo(branchCenterX, topLeft.y);

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._a || this._a <= 0) {
      return false;
    }

    // Проверяем линии с учетом толщины (2 * _hitTolerance)
    const topLeft = this.getTopLeft();
    const local = this.transformToLocalCoords(worldX, worldY);
    const width_px = this.getWidth();
    const offset_px = this.mmToPx(this._l3);
    const centerX = this.x;
    const centerY = this.y;

    // Проверяем расстояние до горизонтальной линии (магистраль)
    // Линия с толщиной: centerY ± _hitTolerance
    const isOnHorizontal =
      local.x >= topLeft.x &&
      local.x <= topLeft.x + width_px &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    // Проверяем расстояние до вертикальной линии (ответвление)
    // Линия с толщиной: branchCenterX ± _hitTolerance
    const branchCenterX = centerX + offset_px;
    const isOnVertical =
      Math.abs(local.x - branchCenterX) <= this._hitTolerance &&
      local.y >= topLeft.y &&
      local.y <= centerY;

    return isOnHorizontal || isOnVertical;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      b: this._b,
      l1: this._l1,
      l2: this._l2,
      l3: this._l3,
    };
  }
}
