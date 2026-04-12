import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class Transition extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', sectionType2 = 'round', a = 125, a2 = 200, b = 500, c = 125, c2 = 150) {
    super(id, 'transition', x_px, y_px, `${BaseElement.getAvailableTypes().transition} ${id}`, sectionType, a);
    this._sectionType2 = sectionType2;
    this._a2 = a2;
    this._b = b;
    this._c = c;
    this._c2 = c2;
  }

  getSizePx() { return 0; }

  get a2() { return this._a2; }
  set a2(value) {
    this._a2 = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get b() { return this._b; }
  set b(value) {
    this._b = Math.max(50, Math.min(3000, value));
    this.updatePorts();
    this.updateCalloutText();
  }

  get c() { return this._c; }
  set c(value) {
    this._c = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get c2() { return this._c2; }
  set c2(value) {
    this._c2 = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get sectionType2() { return this._sectionType2; }
  set sectionType2(value) {
    this._sectionType2 = value;
    this.updateCalloutText();
  }

  getWidth() {
    return this.mmToPx(this._b);
  }

  getHeight() {
    return Math.max(this.mmToPx(this._a), this.mmToPx(this._a2));
  }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getEquivalentDiameter() {
    const d1 = this._sectionType === 'round' ? this._a : (2 * this._a * this._c) / (this._a + this._c);
    const d2 = this._sectionType2 === 'round' ? this._a2 : (2 * this._a2 * this._c2) / (this._a2 + this._c2);
    return (d1 + d2) / 2;
  }

  getCalloutText() {
    const getSizeStr = (type, size, size2) => {
      if (type === 'round') return `⌀${size}`;
      return `${size}x${size2}`;
    };
    const inletStr = getSizeStr(this._sectionType, this._a, this._c);
    const outletStr = getSizeStr(this._sectionType2, this._a2, this._c2);
    const avgArea = (Math.PI * Math.pow(this.getEquivalentDiameter() / 2, 2)) / 1000000;
    return `${this.name}\n${inletStr} → ${outletStr} мм\nL: ${this._b} мм\nSср: ${avgArea.toFixed(2)} м²`;
  }

  getParameters() {
    const params = [
      ...super.getParameters(),
      {
        name: 'sectionType2',
        label: 'Тип сечения выхода',
        type: 'select',
        options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ],
        value: this._sectionType2
      },
      {
        name: 'a2',
        label: this._sectionType2 === 'round' ? 'Диаметр выхода' : 'Ширина выхода',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._a2,
        unit: 'мм'
      }
    ];

    if (this._sectionType2 === 'rectangular') {
      params.push({
        name: 'c2',
        label: 'Высота выхода',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._c2,
        unit: 'мм'
      });
    }

    params.push({
      name: 'b',
      label: 'Длина перехода',
      type: 'number',
      step: 10,
      min: 50,
      max: 3000,
      value: this._b,
      unit: 'мм'
    });

    return params;
  }

  // ИСПРАВЛЕННЫЙ createPath
  createPath(ctx) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const endX = topLeft.x + this.getWidth();
    const centerY = this.y;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(endX, centerY);

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

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const centerY = this.y;

    const inletPos = this.rotatePoint(topLeft.x, centerY, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(topLeft.x + width, centerY, this.x, this.y, rotation);

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, 0, inletPos.x, inletPos.y
    ));

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'right', width, 0, outletPos.x, outletPos.y
    ));

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

  toJSON() {
    return {
      ...super.toJSON(),
      a2: this._a2,
      b: this._b,
      c: this._c,
      c2: this._c2,
      sectionType2: this._sectionType2
    };
  }
}
