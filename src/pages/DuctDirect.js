import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, b = 750, c = 125) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, sectionType, a);
    this._b = b;
    this._c = c;
  }

  get b() { return this._b; }
  set b(value) {
    if (this._b === value) return;
    this._b = value;
    this.updatePorts();
    this.updateCalloutText();
  }

  get c() { return this._c; }
  set c(value) {
    if (this._c === value) return;
    this._c = value;
    this.updateCalloutText();
  }

  getWidth() { return this.mmToPx(this._b); }
  getHeight() { return this.mmToPx(this._a); }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    let text = `${super.getCalloutText()}\nL: ${this._b} мм`;
    if (this._sectionType === 'rectangular') {
      text += `\n${this._a}x${this._c} мм\nDэкв: ${this.getEquivalentDiameter().toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }
    return text;
  }

  getParameters() {
    const params = [...super.getParameters(),
    { name: 'b', label: 'Длина', type: 'number', step: 10, min: 30, value: this._b, unit: 'мм' }
    ];
    if (this._sectionType === 'rectangular') {
      params.push({ name: 'c', label: 'Высота', type: 'number', step: 10, min: 20, value: this._c, unit: 'мм' });
    }
    return params;
  }

  // ЕДИНЫЙ createPath для всех прямых элементов (DuctDirect и Transition)
  createPath(ctx) {
    const topLeft = this.getTopLeft();
    const endX = topLeft.x + this.getWidth();
    const centerY = this.y;

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(endX, centerY);
  }

  // ЕДИНЫЙ draw для всех прямых элементов
  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    ctx.save();

    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation || 0) * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    this.createPath(ctx);

    if (isSelected) ctx.strokeStyle = '#e5ff00';
    else if (isHighlighted) ctx.strokeStyle = '#00c8ff';
    else ctx.strokeStyle = this.color;

    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const centerY = this.y;

    const inletPos = this.rotatePoint(topLeft.x, centerY, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(topLeft.x + this.getWidth(), centerY, this.x, this.y, rotation);

    ports.push(new Port(this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, 0, inletPos.x, inletPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'right', this.getWidth(), 0, outletPos.x, outletPos.y));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    ctx.save();

    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation || 0) * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    const topLeft = this.getTopLeft();
    const width = this.getWidth();

    ctx.beginPath();
    ctx.moveTo(topLeft.x, this.y);
    ctx.lineTo(topLeft.x + width, this.y);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), b: this._b, c: this._c };
  }
}
