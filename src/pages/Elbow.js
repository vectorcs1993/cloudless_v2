import { DuctDirect } from './DuctDirect.js';
import { Port } from './Port.js';

export class Elbow extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, r = 125) {
    super(id, x_px, y_px, sectionType, a, r, a);
    this._r = r;
    this._direction = 'bottom';
    this.type = 'elbow';
  }

  getSizePx() { return 0; }

  get r() { return this._r; }
  set r(newR) {
    this._r = newR;
    this._b = newR;
    this.updatePorts();
    this.updateCalloutText();
  }

  get direction() { return this._direction; }
  set direction(newDir) {
    this._direction = newDir;
    this.updatePorts();
    this.updateCalloutText();
  }

  getPathPoints() {
    const dir = this._direction;
    const size = this.mmToPx(this._r);
    const topLeft = this.getTopLeft();
    const inlet = { x: topLeft.x, y: topLeft.y + size };
    const corner = { x: topLeft.x + size, y: topLeft.y + size };
    let outlet;
    switch (dir) {
      case 'bottom': outlet = { x: topLeft.x + size, y: topLeft.y + size * 2 }; break;
      case 'bottom-left': outlet = { x: topLeft.x, y: topLeft.y + size * 2 }; break;
      case 'bottom-right': outlet = { x: topLeft.x + size * 2, y: topLeft.y + size * 2 }; break;
      default: outlet = { x: topLeft.x + size, y: topLeft.y + size * 2 };
    }
    return { inlet, corner, outlet };
  }

  getWidth() {
    const dir = this._direction;
    const size = this.mmToPx(this._r);
    if (dir === 'bottom-right') return size * 2;
    return size;
  }

  getHeight() {
    const size = this.mmToPx(this._r);
    return size * 2;
  }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    let text = `${this.name}\nРадиус: ${this._r} мм`;
    if (this._sectionType === 'rectangular') {
      text += `\n${this._a}x${this._c} мм\nDэкв: ${this.getEquivalentDiameter().toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }
    return text;
  }

  getParameters() {
    const parentParams = super.getParameters();
    const paramsWithoutB = parentParams.filter(p => p.name !== 'b');
    return [...paramsWithoutB,
    {
      name: 'direction', label: 'Направление', type: 'select', options: [
        { value: 'bottom', label: '↓' },
        { value: 'bottom-left', label: '↙' },
        { value: 'bottom-right', label: '↘' }
      ], value: this._direction
    },
    { name: 'r', label: 'Радиус', type: 'number', step: 10, min: 30, value: this._r, unit: 'мм' }
    ];
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const { inlet, corner, outlet } = this.getPathPoints();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();
    ctx.moveTo(inlet.x, inlet.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(outlet.x, outlet.y);

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

  // В Elbow.js, замените метод hitTest:

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
    const { inlet, outlet } = this.getPathPoints();
    const inletPos = this.rotatePoint(inlet.x, inlet.y, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(outlet.x, outlet.y, this.x, this.y, rotation);

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, 0, inletPos.x, inletPos.y
    ));
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', 0, 0, outletPos.x, outletPos.y
    ));
    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const { inlet, corner, outlet } = this.getPathPoints();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);
    ctx.beginPath();
    ctx.moveTo(inlet.x, inlet.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(outlet.x, outlet.y);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), r: this._r, direction: this._direction };
  }
}
