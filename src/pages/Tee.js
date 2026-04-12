import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'tee', x_px, y_px, `${BaseElement.getAvailableTypes().tee} ${id}`, sectionType, a);
    this._b = 100;
    this._l1 = 250;
    this._l2 = 150;
    this._l3 = 0;
    this._anglel2 = 90;
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
    this._l2 = Math.max(50, Math.min(3000, newLength));
    this.updatePorts();
  }

  get l3() { return this._l3; }
  set l3(newOffset) {
    const maxOffset = this._l1 / 2;
    this._l3 = Math.max(-maxOffset, Math.min(maxOffset, newOffset));
    this.updatePorts();
  }

  get angle() { return this._anglel2; }
  set angle(newAngle) {
    this._anglel2 = Math.max(30, Math.min(150, newAngle));
    this.updatePorts();
  }

  getWidth() { return this.mmToPx(this._l1); }
  getHeight() {
    const angleRad = this._anglel2 * Math.PI / 180;
    const l2Px = this.mmToPx(this._l2);
    return Math.abs(Math.sin(angleRad) * l2Px);
  }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    const baseText = `${this.name}\nA: ${this._a} мм`;
    if (this._sectionType === 'round') {
      return `${baseText}\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм\nУгол: ${this._anglel2}°`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._l1} мм\nL2: ${this._l2} мм\nL3: ${this._l3} мм\nУгол: ${this._anglel2}°`;
    }
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'l1', label: 'L1', type: 'number', step: 10, min: 50, max: 5000, value: this._l1, unit: 'мм' },
      { name: 'l2', label: 'L2', type: 'number', step: 10, min: 50, max: 3000, value: this._l2, unit: 'мм' },
      { name: 'l3', label: 'L3', type: 'number', step: 10, min: -this._l1 / 2, max: this._l1 / 2, value: this._l3, unit: 'мм' },
      { name: 'angle', label: 'Угол', type: 'number', step: 5, min: 30, max: 150, value: this._anglel2, unit: '°' }
    ];
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const offsetPx = this.mmToPx(this._l3);
    const l2Px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;
    const centerX = this.x;
    const centerY = this.y;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width, centerY);
    ctx.moveTo(centerX + offsetPx, centerY);
    ctx.lineTo(centerX + offsetPx + Math.cos(angleRad) * l2Px, centerY - Math.sin(angleRad) * l2Px);

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.createPath(ctx);
    if (isSelected) ctx.strokeStyle = '#e5ff00';
    else if (isHighlighted) ctx.strokeStyle = '#00c8ff';
    else ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();
    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  // В Tee.js и Cross.js, замените hitTest:

  hitTest(worldX, worldY, ctx) {
    ctx.save();

    const rotation = this.rotation || 0;
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    this.createPath(ctx);
    const hitLineWidth = Math.max(this.lineWidth + 8, 15);
    ctx.lineWidth = hitLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let hit = ctx.isPointInStroke(worldX, worldY);

    if (!hit) {
      const offsets = [-3, -2, -1, 0, 1, 2, 3];
      for (const dx of offsets) {
        for (const dy of offsets) {
          ctx.beginPath();
          this.createPath(ctx);
          if (ctx.isPointInStroke(worldX + dx, worldY + dy)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }

    ctx.restore();
    return hit;
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const offsetPx = this.mmToPx(this._l3);
    const l2Px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;
    const centerX = this.x;
    const centerY = this.y;

    const leftPos = this.rotatePoint(topLeft.x, centerY, centerX, centerY, rotation);
    const rightPos = this.rotatePoint(topLeft.x + width, centerY, centerX, centerY, rotation);
    const branchEnd = {
      x: centerX + offsetPx + Math.cos(angleRad) * l2Px,
      y: centerY - Math.sin(angleRad) * l2Px
    };
    const branchPos = this.rotatePoint(branchEnd.x, branchEnd.y, centerX, centerY, rotation);

    ports.push(new Port(this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`, this.id, 'left', 'left', 0, 0, leftPos.x, leftPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`, this.id, 'right', 'right', width, 0, rightPos.x, rightPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'branch')?.id || `port_${this.id}_branch`, this.id, 'branch', 'branch', 0, 0, branchPos.x, branchPos.y));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const offsetPx = this.mmToPx(this._l3);
    const l2Px = this.mmToPx(this._l2);
    const angleRad = this._anglel2 * Math.PI / 180;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, this.y);
    ctx.lineTo(topLeft.x + width, this.y);
    ctx.moveTo(this.x + offsetPx, this.y);
    ctx.lineTo(this.x + offsetPx + Math.cos(angleRad) * l2Px, this.y - Math.sin(angleRad) * l2Px);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), b: this._b, l1: this._l1, l2: this._l2, l3: this._l3, anglel2: this._anglel2 };
  }
}
