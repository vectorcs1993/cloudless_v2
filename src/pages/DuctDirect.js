import { BaseElement, DuctBase } from './Elements.js';

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 125, length = 3000) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, sectionType, size_mm);
    this._lengthHorizontal_mm = length;
  }

  get length_mm() { return this._lengthHorizontal_mm; }

  set length_mm(value) {
    if (this._lengthHorizontal_mm === value) return;
    const centerX = this.x;
    this._lengthHorizontal_mm = value;
    // Центр остается на месте
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._lengthHorizontal_mm);
  }

  getHeight() {
    return this.mmToPx(this._size_mm);
  }

  getCalloutText() {
    const length_m = this._lengthHorizontal_mm / 1000;
    const size_m = this._size_mm / 1000;
    const area = (length_m * size_m).toFixed(2);
    return `${super.getCalloutText()}\nДлина: ${this._lengthHorizontal_mm} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'length_mm',
        label: 'Длина',
        type: 'number',
        step: 10,
        min: 100,
        value: this._lengthHorizontal_mm,
        unit: 'мм'
      },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this.getWidth(), this.getHeight());
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.drawRectangular(ctx, this.getWidth(), this.getHeight(), isSelected, scale, showColors);
    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  hitTest(worldX, worldY, ctx) {
    return this.hitTestRectangular(worldX, worldY, this.getWidth(), this.getHeight());
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const width = this.getWidth();
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width, centerY);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      length_mm: this._lengthHorizontal_mm
    };
  }
}
