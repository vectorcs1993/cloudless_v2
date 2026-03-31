import { DuctDirect } from './DuctDirect.js';

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 440, length = 550) {
    super(id, x_px, y_px, sectionType, size_mm, length);
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

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    this.drawRectangular(ctx, width_px, height_px, isSelected, scale, showColors);

    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const radius = height_px * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = Math.max(1, 1.5 / scale);
    ctx.stroke();

    const triangleSize = radius * 0.7;
    const direction = this.flow > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(centerX + triangleSize * direction, centerY);
    ctx.lineTo(centerX - triangleSize * 0.8 * direction, centerY - triangleSize * 0.8);
    ctx.lineTo(centerX - triangleSize * 0.8 * direction, centerY + triangleSize * 0.8);
    ctx.closePath();
    ctx.strokeStyle = '#666';
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
      length_mm: this._lengthHorizontal_mm
    };
  }
}
