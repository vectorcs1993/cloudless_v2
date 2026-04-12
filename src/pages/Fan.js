import { BaseElement } from './Elements.js';
import { Port } from './Port.js';

export class Fan extends BaseElement {
  constructor(id, x_px, y_px, sectionType = 'round', a = 100, b = 150) {
    super(id, 'fan', x_px, y_px, `${BaseElement.getAvailableTypes().fan} ${id}`);
    this._sectionType = sectionType;
    this._a = a;
    this._b = b;
    this._flow = 1000;
    this._pressure = 500;
  }

  get a() { return this._a; }
  set a(value) { this._a = Math.max(50, Math.min(500, value)); this.updateCalloutText(); }

  get b() { return this._b; }
  set b(value) { this._b = Math.max(50, Math.min(500, value)); this.updateCalloutText(); }

  get flow() { return this._flow; }
  set flow(value) { this._flow = Math.max(0, value); this.updateCalloutText(); }

  get pressure() { return this._pressure; }
  set pressure(value) { this._pressure = Math.max(0, value); this.updateCalloutText(); }

  get sectionType() { return this._sectionType; }
  set sectionType(value) { this._sectionType = value; this.updateCalloutText(); }

  getWidth() { return this.mmToPx(this._b); }
  getHeight() { return this.mmToPx(this._a); }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    const sizeStr = this._sectionType === 'round' ? `⌀${this._a} мм` : `${this._a}x${this._b} мм`;
    return `${this.name}\n${sizeStr}\nПроизводительность: ${this._flow} м³/ч\nНапор: ${this._pressure} Па`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'sectionType', label: 'Тип сечения', type: 'select', options: [{ value: 'rectangular', label: 'Прямоугольное' }, { value: 'round', label: 'Круглое' }], value: this._sectionType },
      { name: 'a', label: this._sectionType === 'round' ? 'Диаметр' : 'Ширина', type: 'number', step: 10, min: 50, max: 500, value: this._a, unit: 'мм' },
      { name: 'b', label: 'Высота', type: 'number', step: 10, min: 50, max: 500, value: this._b, unit: 'мм', visible: this._sectionType === 'rectangular' },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, min: 0, value: this._flow, unit: 'м³/ч' },
      { name: 'pressure', label: 'Напор', type: 'number', step: 50, min: 0, value: this._pressure, unit: 'Па' }
    ];
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const centerY = this.y;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width, centerY);

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.createPath(ctx);
    if (isSelected) ctx.strokeStyle = '#e5ff00';
    else if (isHighlighted) ctx.strokeStyle = '#00c8ff';
    else ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    // Рисуем кружок вентилятора
    const rotation = this.rotation || 0;
    const radius = this.getHeight() / 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    if (showColors) {
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    ctx.stroke();
    ctx.restore();

    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  hitTest(worldX, worldY, ctx) {
    const rotation = this.rotation || 0;
    const radius = this.getHeight() / 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);

    const dx = worldX - this.x;
    const dy = worldY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    ctx.restore();

    return dist <= radius;
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const centerY = this.y;

    const inletPos = this.rotatePoint(topLeft.x, centerY, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(topLeft.x + width, centerY, this.x, this.y, rotation);

    ports.push(new Port(this.ports?.find(p => p.direction === 'inlet')?.id || Date.now(), this.id, 'inlet', 'left', 0, 0, inletPos.x, inletPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'outlet')?.id || Date.now(), this.id, 'outlet', 'right', width, 0, outletPos.x, outletPos.y));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);
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

  toJSON() { return { ...super.toJSON(), a: this._a, b: this._b, flow: this._flow, pressure: this._pressure, sectionType: this._sectionType }; }
}
