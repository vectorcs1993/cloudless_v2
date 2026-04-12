import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

// ========== ОТВОД ==========
export class Elbow extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'elbow', x_px, y_px, `${BaseElement.getAvailableTypes().elbow} ${id}`, sectionType, a);
    this._b = 100;                   // Высота отвода (B параметр)
    this._r = 125;           // Радиус изгиба (для обоих типов)
    this._segments = 4;              // Количество сегментов для круглого отвода
  }

  // Геттеры и сеттеры для высоты
  get b() { return this._b; }

  set b(newB) {
    if (this._b === newB) return;
    this._b = newB;
  }

  // Геттеры и сеттеры для радиуса
  get r() { return this._r; }

  set r(newR) {
    if (this._r === newR) return;
    this._r = newR;
    this.updatePorts();
  }

  get segments() { return this._segments; }
  set segments(value) {
    if (this._segments === value) return;
    this._segments = Math.max(3, Math.min(20, value)); // Ограничиваем от 3 до 20 сегментов
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._r) + this.getSizePx();
  }

  getHeight() {
    return this.mmToPx(this._r) + this.getSizePx();
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  getCalloutText() {
    const baseText = `${super.getCalloutText()}`;
    return `${baseText}\nR: ${this._r} мм`;
  }
  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, isHighlighted, false);
    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }
  getParameters() {
    const baseParams = super.getParameters();

    return [
      ...baseParams,
      {
        name: 'r',
        label: 'R',
        type: 'number',
        step: 5,
        min: 30,
        value: this._r,
        unit: 'мм'
      }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._r);
    const centerRadius_px = radius_px + size_px / 2;

    // Входной порт (слева)
    const inletX = topLeft.x;
    const inletY = topLeft.y + height_px - centerRadius_px;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, height_px - centerRadius_px, inletPos.x, inletPos.y
    ));

    // Выходной порт (снизу)
    const outletX = topLeft.x + centerRadius_px;
    const outletY = topLeft.y + height_px;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius_px, height_px, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._r);
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const outerRadius_px = radius_px + size_px;
    const innerRadius_px = radius_px;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, outerRadius_px, Math.PI * 1.5, Math.PI * 2);
    ctx.lineTo(
      bendCenterX + innerRadius_px * Math.cos(Math.PI * 2),
      bendCenterY + innerRadius_px * Math.sin(Math.PI * 2)
    );
    ctx.arc(bendCenterX, bendCenterY, innerRadius_px, Math.PI * 2, Math.PI * 1.5, true);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._r);
    const topLeft = this.getTopLeft();
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const centerRadius_px = radius_px + size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Плавная осевая линия дуги (для обоих типов сечений)
    ctx.arc(bendCenterX, bendCenterY, centerRadius_px, Math.PI * 1.5, Math.PI * 2);

    // Подводящая горизонтальная линия
    const startX = bendCenterX;
    const startY = bendCenterY - centerRadius_px;
    ctx.moveTo(startX, startY);
    ctx.lineTo(topLeft.x, startY);

    // Отводящая вертикальная линия
    const endX = bendCenterX + centerRadius_px;
    const endY = bendCenterY;
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX, topLeft.y + this.getHeight());

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._a || !this._r || this._a <= 0 || this._r <= 0) {
      return false;
    }

    // Проверяем линии с учетом толщины (2 * _hitTolerance)
    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._r);
    const centerRadius_px = radius_px + size_px / 2;
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();

    // Проверяем расстояние до подводящей горизонтальной линии
    const isOnHorizontalLine =
      local.x >= bendCenterX &&
      local.x <= bendCenterX + centerRadius_px &&
      Math.abs(local.y - (bendCenterY - centerRadius_px)) <= this._hitTolerance;

    // Проверяем расстояние до отводящей вертикальной линии
    const isOnVerticalLine =
      Math.abs(local.x - (bendCenterX + centerRadius_px)) <= this._hitTolerance &&
      local.y >= bendCenterY - centerRadius_px &&
      local.y <= bendCenterY;

    // Проверяем расстояние до дуги
    const distFromBendCenter = Math.sqrt(
      Math.pow(local.x - bendCenterX, 2) +
      Math.pow(local.y - bendCenterY, 2)
    );
    const isOnArc =
      Math.abs(distFromBendCenter - centerRadius_px) <= this._hitTolerance &&
      local.x >= bendCenterX &&
      local.y >= bendCenterY - centerRadius_px;

    return isOnHorizontalLine || isOnVerticalLine || isOnArc;
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._r);
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const centerRadius_px = radius_px + size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Рисуем дугу (центральная линия)
    ctx.arc(bendCenterX, bendCenterY, centerRadius_px, Math.PI * 1.5, Math.PI * 2);

    ctx.lineWidth = 2 * this._hitTolerance;
    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = isDarkTheme ? '#888' : '#333';
    }
    ctx.stroke();

    // Рисуем прямую подводящую линию
    ctx.beginPath();
    ctx.moveTo(bendCenterX, bendCenterY - centerRadius_px);
    ctx.lineTo(topLeft.x, bendCenterY - centerRadius_px);
    ctx.stroke();

    // Рисуем прямую отводящую линию
    ctx.beginPath();
    ctx.moveTo(bendCenterX + centerRadius_px, bendCenterY);
    ctx.lineTo(bendCenterX + centerRadius_px, topLeft.y + this.getHeight());
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }
  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      type: 'elbow',
      r: this._r,
      segments: this._segments,
    };
  }
}
