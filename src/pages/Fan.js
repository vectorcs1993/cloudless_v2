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

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Линия подвода
    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(centerX - radius * 0.8, centerY);
    ctx.stroke();

    // Линия отвода
    ctx.beginPath();
    ctx.moveTo(centerX + radius * 0.8, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);
    ctx.stroke();

    // Треугольник (вентилятор)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX + radius, centerY);
    ctx.lineTo(centerX, centerY + radius);
    ctx.closePath();

    ctx.lineWidth = 2 * this._hitTolerance;
    ctx.strokeStyle = isSelected ? '#e5ff00' : (isDarkTheme ? '#888' : '#333');
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }
  toJSON() {
    return {
      ...super.toJSON(),
      type: 'fan',
      flow: this.flow,
      pressure: this.pressure,
    };
  }
}
