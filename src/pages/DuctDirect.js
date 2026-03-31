import { BaseElement, DuctBase } from './Elements.js';

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', width = 125, length = 3000) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, sectionType, width);
    this._b = length;
  }

  get b() { return this._b; }

  set b(value) {
    if (this._b === value) return;
    this._b = value;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._b);
  }

  getHeight() {
    return this.mmToPx(this._a);
  }

  getCalloutText() {
    const length_m = this._b / 1000;
    const size_m = this._a / 1000;
    const area = (length_m * size_m).toFixed(2);
    return `${super.getCalloutText()}\nB: ${this._b} мм\nS: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'b',
        label: 'B',
        type: 'number',
        step: 10,
        min: 30,
        value: this._b,
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
      b: this._b
    };
  }
}
