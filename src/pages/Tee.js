import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'tee', x_px, y_px, `${BaseElement.getAvailableTypes().tee} ${id}`, sectionType, a);
    this._b = 100;                   // Высота для прямоугольного сечения
    this._l1 = 250;                  // Длина основной магистрали (горизонталь)
    this._l2 = 150;                  // Длина ответвления
    this._l3 = 0;                    // Смещение ответвления от центра
    this._anglel2 = 90;                // Угол ответвления
  }

  // ========== ГЕТТЕРЫ И СЕТТЕРЫ ==========

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;
    this._a = Math.max(20, Math.min(1000, value));
    this.updateCalloutText(); // Просто обновляем текст
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
    this._l1 = Math.max(50, Math.min(5000, newLength));
    this.updatePorts();
  }

  get l2() { return this._l2; }

  set l2(newLength) {
    if (this._l2 === newLength) return;
    this._l2 = Math.max(50, Math.min(3000, newLength));
    this.updatePorts();
  }

  get l3() { return this._l3; }

  set l3(newOffset) {
    if (this._l3 === newOffset) return;
    // Ограничиваем смещение половиной длины магистрали
    const maxOffset = this._l1 / 2;
    this._l3 = Math.max(-maxOffset, Math.min(maxOffset, newOffset));
    this.updatePorts();
  }

  get angle() { return this._anglel2; }

  set angle(newAngle) {
    if (this._anglel2 === newAngle) return;
    this._anglel2 = Math.max(30, Math.min(150, newAngle));
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._l1);
  }

  getHeight() {
    const angleRad = this._anglel2 * Math.PI / 180;
    const branchHeight = Math.sin(angleRad) * this.mmToPx(this._l2);
    return Math.max(0, branchHeight);
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
    const baseText = `${this.name}\nA: ${this._a} мм`;
    if (this._sectionType === 'round') {
      return `${baseText}\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм\nУгол: ${this._anglel2}°`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм\nУгол: ${this._anglel2}°`;
    }
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'l1',
        label: 'L1',
        type: 'number',
        step: 10,
        min: 50,
        max: 5000,
        value: this._l1,
        unit: 'мм'
      },
      {
        name: 'l2',
        label: 'L2',
        type: 'number',
        step: 10,
        min: 50,
        max: 3000,
        value: this._l2,
        unit: 'мм'
      },
      {
        name: 'l3',
        label: 'L3',
        type: 'number',
        step: 10,
        min: -this._l1 / 2,
        max: this._l1 / 2,
        value: this._l3,
        unit: 'мм'
      },
      {
        name: 'angle',
        label: 'Угол ответвления',
        type: 'number',
        step: 5,
        min: 30,
        max: 150,
        value: this._anglel2,
        unit: '°'
      }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const offset_px = this.mmToPx(this._l3);
    const l2_px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;

    // Левый порт
    const leftX = topLeft.x;
    const leftY = centerY;
    const leftPos = this.rotatePoint(leftX, leftY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`,
      this.id, 'left', 'left', 0, 0, leftPos.x, leftPos.y
    ));

    // Правый порт
    const rightX = topLeft.x + width_px;
    const rightY = centerY;
    const rightPos = this.rotatePoint(rightX, rightY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`,
      this.id, 'right', 'right', width_px, 0, rightPos.x, rightPos.y
    ));

    // Порт ответвления
    const branchStartX = centerX + offset_px;
    const branchStartY = centerY;
    const branchEndX = branchStartX + Math.cos(angleRad) * l2_px;
    const branchEndY = branchStartY - Math.sin(angleRad) * l2_px;
    const branchPos = this.rotatePoint(branchEndX, branchEndY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || `port_${this.id}_branch`,
      this.id, 'branch', 'branch', width_px / 2 + offset_px + Math.cos(angleRad) * l2_px, -Math.sin(angleRad) * l2_px, branchPos.x, branchPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const offset_px = this.mmToPx(this._l3);
    const l2_px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная линия (магистраль)
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Линия ответвления под углом
    const branchStartX = centerX + offset_px;
    const branchStartY = centerY;
    const branchEndX = branchStartX + Math.cos(angleRad) * l2_px;
    const branchEndY = branchStartY - Math.sin(angleRad) * l2_px;

    ctx.moveTo(branchStartX, branchStartY);
    ctx.lineTo(branchEndX, branchEndY);

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
    const offset_px = this.mmToPx(this._l3);
    const l2_px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;

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

    const branchStartX = centerX + offset_px;
    const branchStartY = centerY;
    const branchEndX = branchStartX + Math.cos(angleRad) * l2_px;
    const branchEndY = branchStartY - Math.sin(angleRad) * l2_px;

    ctx.moveTo(branchStartX, branchStartY);
    ctx.lineTo(branchEndX, branchEndY);

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    const tolerance = this._hitTolerance;
    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const offset_px = this.mmToPx(this._l3);
    const l2_px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;
    const centerX = this.x;
    const centerY = this.y;

    // Проверка горизонтальной линии
    const isOnHorizontal = local.x >= topLeft.x &&
      local.x <= topLeft.x + width_px &&
      Math.abs(local.y - centerY) <= tolerance;

    // Проверка линии ответвления
    const branchStartX = centerX + offset_px;
    const branchStartY = centerY;
    const branchEndX = branchStartX + Math.cos(angleRad) * l2_px;
    const branchEndY = branchStartY - Math.sin(angleRad) * l2_px;

    const distToBranch = this.distanceToSegment(
      local.x, local.y,
      branchStartX, branchStartY,
      branchEndX, branchEndY
    );

    const isOnBranch = distToBranch <= tolerance;

    return isOnHorizontal || isOnBranch;
  }

  distanceToSegment(px, py, x1, y1, x2, y2) {
    const ax = px - x1;
    const ay = py - y1;
    const bx = x2 - x1;
    const by = y2 - y1;

    const dot = ax * bx + ay * by;
    const len2 = bx * bx + by * by;

    if (len2 === 0) return Math.sqrt(ax * ax + ay * ay);

    let t = dot / len2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * bx;
    const projY = y1 + t * by;

    const dx = px - projX;
    const dy = py - projY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      b: this._b,
      l1: this._l1,
      l2: this._l2,
      l3: this._l3,
      anglel2: this._anglel2,
    };
  }
}
