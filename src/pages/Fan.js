import { DuctDirect } from './DuctDirect.js';
import { BaseElement } from './Elements.js';

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', width = 440, length = 550) {
    super(id, x_px, y_px, sectionType, width, length);
    this.type = 'fan';
    this.name = `${BaseElement.getAvailableTypes().fan} ${id}`;
    this.flow = 1000;
    this.pressure = 500;
  }

  getCalloutText() {
    return `${super.getCalloutText()}\nПроизводительность: ${this.flow} м³/ч\nНапор: ${this.pressure} Па`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' },
      { name: 'pressure', label: 'Напор', type: 'number', step: 1, value: this.pressure, unit: 'Па' }
    ];
  }

  // Замените метод draw
  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const width_px = this.getWidth();
    const radius = Math.min(width_px * 0.3, this.mmToPx(60));
    const topLeft = this.getTopLeft();
    const connectorLength = 5; // Длина линии соединения с портом

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.lineWidth = 2 * this._hitTolerance;
    ctx.strokeStyle = isSelected ? '#e5ff00' : (isDarkTheme ? '#888' : '#333');

    // Линия подвода (5px слева)
    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + connectorLength, centerY);
    ctx.stroke();

    // Линия отвода (5px справа)
    ctx.beginPath();
    ctx.moveTo(topLeft.x + width_px - connectorLength, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);
    ctx.stroke();

    // Треугольник (вентилятор) — центрированный правый треугольник
    const tipX = centerX + radius;
    const baseX = centerX - radius / 2;
    const topY = centerY - radius;
    const bottomY = centerY + radius;

    ctx.beginPath();
    ctx.moveTo(baseX, topY);
    ctx.lineTo(tipX, centerY);
    ctx.lineTo(baseX, bottomY);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  getWidth() {
    // Фиксированная ширина вентилятора, параметр B не влияет на отрисовку
    return this.mmToPx(this._a);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: 'fan',
      flow: this.flow,
      pressure: this.pressure,
    };
  }

  hitTest(worldX, worldY, ctx) {
    const width_px = this.getWidth();
    if (!width_px || width_px <= 0) {
      return false;
    }

    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    const centerX = this.x;
    const centerY = this.y;
    const radius = Math.min(width_px * 0.3, this.mmToPx(60));
    const connectorLength = 5;

    // Проверяем левую линию подвода (5px)
    const isOnLeftConnector =
      local.x >= topLeft.x &&
      local.x <= topLeft.x + connectorLength &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    // Проверяем правую линию отвода (5px)
    const isOnRightConnector =
      local.x >= topLeft.x + width_px - connectorLength &&
      local.x <= topLeft.x + width_px &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    // Проверяем треугольник (вентилятор) - центрированный правый треугольник
    const tipX = centerX + radius;
    const baseX = centerX - radius / 2;
    const topY = centerY - radius;
    const bottomY = centerY + radius;

    const dist1 = this.pointToLineDistance(local, baseX, topY, tipX, centerY);
    const isOnLine1 = dist1 <= this._hitTolerance;

    const dist2 = this.pointToLineDistance(local, tipX, centerY, baseX, bottomY);
    const isOnLine2 = dist2 <= this._hitTolerance;

    const dist3 = this.pointToLineDistance(local, baseX, bottomY, baseX, topY);
    const isOnLine3 = dist3 <= this._hitTolerance;

    return isOnLeftConnector || isOnRightConnector || isOnLine1 || isOnLine2 || isOnLine3;
  }

  // Вспомогательный метод для расчета расстояния от точки до линии
  pointToLineDistance(point, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.sqrt((point.x - x1) ** 2 + (point.y - y1) ** 2);

    let t = ((point.x - x1) * dx + (point.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
  }
}
