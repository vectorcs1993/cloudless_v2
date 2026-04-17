import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class Cross extends DuctBase {
  constructor(id, x_px, y_px, materialType = 'galvanized', sectionType = 'round', a = 125) {
    super(id, 'cross', x_px, y_px, `${BaseElement.getAvailableTypes().cross} ${id}`, materialType, sectionType, a);
    this._b = 100;
    this._l1 = 250;
    this._l2 = 250;
  }

  get a() { return this._a; }
  set a(value) {
    this._a = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get b() { return this._b; }
  set b(newB) {
    this._b = Math.max(20, Math.min(1000, newB));
    this.updateCalloutText();
  }

  get l1() { return this._l1; }
  set l1(newLength) {
    this._l1 = Math.max(50, Math.min(5000, newLength));
    this.updatePorts();
  }

  get l2() { return this._l2; }
  set l2(newLength) {
    this._l2 = Math.max(50, Math.min(5000, newLength));
    this.updatePorts();
  }

  getWidth() { return this.mmToPx(this._l1); }
  getHeight() { return this.mmToPx(this._l2); }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    const baseText = `${this.name}\nA: ${this._a} мм`;
    if (this._sectionType === 'round') {
      return `${baseText}\nL1: ${this._l1} мм\nL2: ${this._l2} мм`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._l1} мм\nL2: ${this._l2} мм`;
    }
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'l1', label: 'L1', type: 'number', step: 10, min: 50, max: 5000, value: this._l1, unit: 'мм' },
      { name: 'l2', label: 'L2', type: 'number', step: 10, min: 50, max: 5000, value: this._l2, unit: 'мм' }
    ];
  }

  createPath(ctx) {
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width, centerY);
    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height);
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;

    const leftPos = this.rotatePoint(topLeft.x, centerY, centerX, centerY, rotation);
    const rightPos = this.rotatePoint(topLeft.x + width, centerY, centerX, centerY, rotation);
    const topPos = this.rotatePoint(centerX, topLeft.y, centerX, centerY, rotation);
    const bottomPos = this.rotatePoint(centerX, topLeft.y + height, centerX, centerY, rotation);

    ports.push(new Port(this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`, this.id, 'left', 'left', 0, height / 2, leftPos.x, leftPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`, this.id, 'right', 'right', width, height / 2, rightPos.x, rightPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'top')?.id || `port_${this.id}_top`, this.id, 'top', 'top', width / 2, 0, topPos.x, topPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'bottom')?.id || `port_${this.id}_bottom`, this.id, 'bottom', 'bottom', width / 2, height, bottomPos.x, bottomPos.y));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const height = this.getHeight();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, this.y);
    ctx.lineTo(topLeft.x + width, this.y);
    ctx.moveTo(this.x, topLeft.y);
    ctx.lineTo(this.x, topLeft.y + height);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), b: this._b, l1: this._l1, l2: this._l2 };
  }
}
