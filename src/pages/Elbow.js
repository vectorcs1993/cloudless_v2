import { DuctDirect } from './DuctDirect.js';
import { Port } from './Port.js';
import { BaseElement } from './Elements.js';

// ========== ОТВОД ==========
export class Elbow extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, r = 125) {
    super(id, x_px, y_px, sectionType, a, r, a);
    this._r = r;           // Радиус изгиба
    this.type = 'elbow';
    this.name = `${BaseElement.getAvailableTypes().elbow} ${id}`;
  }

  // Геттеры и сеттеры для радиуса
  get r() { return this._r; }

  set r(newR) {
    if (this._r === newR) return;
    this._r = newR;
    this._b = newR; // Длина = радиусу
    this.updatePorts(); // Обновляем порты
    this.updateCalloutText(); // Обновляем текст выноски
  }
  getAbsoluteCalloutPoint() {
    const radius_px = this.mmToPx(this._r);
    const topLeft = this.getTopLeft();
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();

    // Берем середину дуги (угол 45 градусов от начала)
    // Начало дуги: угол PI*1.5 (270°), конец: PI*2 (360°)
    // Середина: PI*1.75 (315°)
    const angle = Math.PI * 1.75; // 315 градусов

    // Точка на дуге
    const pointOnArc = {
      x: bendCenterX + Math.cos(angle) * radius_px,
      y: bendCenterY + Math.sin(angle) * radius_px
    };

    // Поворачиваем относительно центра элемента
    return this.rotatePoint(
      pointOnArc.x,
      pointOnArc.y,
      this.x,
      this.y,
      this.rotation || 0
    );
  }
  // Переопределяем getWidth и getHeight
  getWidth() {
    return this.mmToPx(this._r);
  }

  getHeight() {
    return this.mmToPx(this._r);
  }

  // Переопределяем getCalloutText - убираем параметр B
  getCalloutText() {
    let text = `${this.name}\nR: ${this._r} мм`;

    if (this._sectionType === 'rectangular') {
      const eqDiameter = this.getEquivalentDiameter();
      text += `\n${this._a}x${this._c} мм\nDэкв: ${eqDiameter.toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }

    return text;
  }

  getParameters() {
    // Получаем параметры от родителя и убираем B
    const parentParams = super.getParameters();
    const paramsWithoutB = parentParams.filter(param => param.name !== 'b');

    return [
      ...paramsWithoutB,
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


  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    const radius_px = this.mmToPx(this._r);
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Рисуем дугу (осевая линия)
    ctx.arc(bendCenterX, bendCenterY, radius_px, Math.PI * 1.5, Math.PI * 2);

    // Подводящая горизонтальная линия
    ctx.moveTo(bendCenterX, bendCenterY - radius_px);
    ctx.lineTo(topLeft.x, bendCenterY - radius_px);

    // Отводящая вертикальная линия
    ctx.moveTo(bendCenterX + radius_px, bendCenterY);
    ctx.lineTo(bendCenterX + radius_px, topLeft.y + this.getHeight());

    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = this.color;
    }
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const height_px = this.getHeight();
    const topLeft = this.getTopLeft();
    const radius_px = this.mmToPx(this._r);

    // Входной порт (слева, на горизонтальном участке)
    // Порт должен быть на конце горизонтальной линии
    const inletX = topLeft.x;
    const inletY = topLeft.y + height_px - radius_px;
    const inletPos = this.rotatePoint(inletX, inletY, this.x, this.y, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, height_px - radius_px, inletPos.x, inletPos.y
    ));

    // Выходной порт (снизу, на вертикальном участке)
    const outletX = topLeft.x + radius_px;
    const outletY = topLeft.y + height_px;
    const outletPos = this.rotatePoint(outletX, outletY, this.x, this.y, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', radius_px, height_px, outletPos.x, outletPos.y
    ));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const radius_px = this.mmToPx(this._r);
    const topLeft = this.getTopLeft();
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();

    // Осевая линия дуги
    ctx.arc(bendCenterX, bendCenterY, radius_px, Math.PI * 1.5, Math.PI * 2);

    // Подводящая горизонтальная линия
    ctx.moveTo(bendCenterX, bendCenterY - radius_px);
    ctx.lineTo(topLeft.x, bendCenterY - radius_px);

    // Отводящая вертикальная линия
    ctx.moveTo(bendCenterX + radius_px, bendCenterY);
    ctx.lineTo(bendCenterX + radius_px, topLeft.y + this.getHeight());

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._r || this._r <= 0) {
      return false;
    }

    const tolerance = this._hitTolerance;
    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    const radius_px = this.mmToPx(this._r);

    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();

    const dx = local.x - bendCenterX;
    const dy = local.y - bendCenterY;
    const distFromBendCenter = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const isOnArc = Math.abs(distFromBendCenter - radius_px) <= tolerance &&
      angle >= -90 && angle <= 0;

    const isOnHorizontal = Math.abs(local.y - (bendCenterY - radius_px)) <= tolerance &&
      local.x >= topLeft.x && local.x <= bendCenterX;

    const isOnVertical = Math.abs(local.x - (bendCenterX + radius_px)) <= tolerance &&
      local.y >= bendCenterY && local.y <= topLeft.y + this.getHeight();

    return isOnArc || isOnHorizontal || isOnVertical;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      r: this._r,
    };
  }
}
