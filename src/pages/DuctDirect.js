import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, materialType = 'galvanized', sectionType = 'round', a = 125, b = 750, c = 125) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, materialType, sectionType, a, b, c);
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
      text += `\n${this._a}x${this._c} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }
    return text;
  }
  createPath(ctx) {
    const topLeft = this.getTopLeft();
    const endX = topLeft.x + this.getWidth();
    const centerY = this.y;

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(endX, centerY);
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
}
