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
    const height_px = this.getHeight();
    const topLeft = this.getTopLeft();
    const connectorLength = Math.min(this.mmToPx(10), width_px * 0.15);
    const triangleLeftX = topLeft.x + connectorLength;
    const triangleTipX = topLeft.x + width_px - connectorLength;
    const leftPortX = topLeft.x;
    const rightPortX = topLeft.x + width_px;
    const topY = centerY - height_px / 2;
    const bottomY = centerY + height_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.lineWidth = 2 * this._hitTolerance;
    ctx.strokeStyle = isSelected ? '#e5ff00' : (isDarkTheme ? '#888' : '#333');

    // Линия подвода от треугольника до левого порта
    ctx.beginPath();
    ctx.moveTo(triangleLeftX, centerY);
    ctx.lineTo(leftPortX, centerY);
    ctx.stroke();

    // Линия отвода от треугольника до правого порта
    ctx.beginPath();
    ctx.moveTo(triangleTipX, centerY);
    ctx.lineTo(rightPortX, centerY);
    ctx.stroke();

    // Треугольник (вентилятор) — центрированный правый треугольник
    const baseX = triangleLeftX;
    const tipX = triangleTipX;

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
    // Ширина отрисовки по параметру A
    return this.mmToPx(this._a);
  }

  getHeight() {
    // Высота треугольника по параметру B
    return this.mmToPx(this._b);
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
    const height_px = this.getHeight();
    const triangleLeftX = topLeft.x + Math.min(this.mmToPx(10), width_px * 0.15);
    const triangleTipX = topLeft.x + width_px - Math.min(this.mmToPx(10), width_px * 0.15);
    const leftPortX = topLeft.x;
    const rightPortX = topLeft.x + width_px;
    const topY = centerY - height_px / 2;
    const bottomY = centerY + height_px / 2;

    // Проверяем левую линию подвода от треугольника до порта
    const isOnLeftConnector =
      local.x >= leftPortX &&
      local.x <= triangleLeftX &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    // Проверяем правую линию отвода от треугольника до порта
    const isOnRightConnector =
      local.x >= triangleTipX &&
      local.x <= rightPortX &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    // Проверяем треугольник (вентилятор) - центрированный правый треугольник
    const tipX = triangleTipX;
    const baseX = triangleLeftX;

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
