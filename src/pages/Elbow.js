import { DuctDirect } from './DuctDirect.js';
import { Port } from './Port.js';
import { BaseElement } from './Elements.js';

// ========== ОТВОД (АКСОНОМЕТРИЯ) ==========
export class Elbow extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, r = 125) {
    super(id, x_px, y_px, sectionType, a, r, a);
    this._r = r;
    this._direction = 'bottom';
    this.type = 'elbow';
    this.name = `${BaseElement.getAvailableTypes().elbow} ${id}`;
  }

  get r() { return this._r; }
  set r(newR) {
    if (this._r === newR) return;
    this._r = newR;
    this._b = newR;
    this.updatePorts();
    this.updateCalloutText();
  }

  get direction() { return this._direction; }
  set direction(newDir) {
    if (this._direction === newDir) return;
    this._direction = newDir;
    this.updatePorts();
    this.updateCalloutText();
  }

  getPathPoints() {
    const dir = this._direction;
    const size = this.mmToPx(this._r);
    const topLeft = this.getTopLeft();

    const inletPoint = { x: topLeft.x, y: topLeft.y + size };
    const cornerPoint = { x: topLeft.x + size, y: topLeft.y + size };
    let outletPoint;

    switch (dir) {
      case 'bottom':
        outletPoint = { x: topLeft.x + size, y: topLeft.y + size * 2 };
        break;
      case 'bottom-left':
        outletPoint = { x: topLeft.x, y: topLeft.y + size * 2 };
        break;
      case 'bottom-right':
        outletPoint = { x: topLeft.x + size * 2, y: topLeft.y + size * 2 };
        break;
      default:
        outletPoint = { x: topLeft.x + size, y: topLeft.y + size * 2 };
    }

    return { inletPoint, cornerPoint, outletPoint };
  }

  getWidth() {
    const dir = this._direction;
    const size = this.mmToPx(this._r);
    if (dir === 'bottom-right') return size * 2;
    if (dir === 'bottom-left') return size;
    return size;
  }

  getHeight() {
    const dir = this._direction;
    const size = this.mmToPx(this._r);
    if (dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right') return size * 2;
    return size;
  }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return {
      x: this.x - width / 2,
      y: this.y - height / 2
    };
  }

  getAbsoluteCalloutPoint() {
    const { cornerPoint } = this.getPathPoints();
    const rotatedPoint = this.rotatePoint(cornerPoint.x, cornerPoint.y, this.x, this.y, this.rotation || 0);
    return rotatedPoint;
  }

  getCalloutText() {
    let text = `${this.name}\nРазмер: ${this._r} мм`;
    if (this._sectionType === 'rectangular') {
      const eqDiameter = this.getEquivalentDiameter();
      text += `\n${this._a}x${this._c} мм\nDэкв: ${eqDiameter.toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }
    return text;
  }

  getParameters() {
    const parentParams = super.getParameters();
    const paramsWithoutB = parentParams.filter(param => param.name !== 'b');
    return [
      ...paramsWithoutB,
      {
        name: 'direction',
        label: 'Направление выхода',
        type: 'select',
        options: [
          { value: 'bottom', label: '↓ (вниз)' },
          { value: 'bottom-left', label: '↙ (вниз-влево)' },
          { value: 'bottom-right', label: '↘ (вниз-вправо)' }
        ],
        value: this._direction
      },
      {
        name: 'r',
        label: 'Размер (длина плеча)',
        type: 'number',
        step: 10,
        min: 30,
        value: this._r,
        unit: 'мм'
      }
    ];
  }

  // СОЗДАЕМ ЗАМКНУТЫЙ КОНТУР (толстую линию как прямоугольник)
  createPath(ctx) {
    const { inletPoint, cornerPoint, outletPoint } = this.getPathPoints();
    const halfWidth = this.lineWidth / 2;

    // Функция для создания перпендикулярного вектора
    const getPerpendicular = (p1, p2) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return { x: 0, y: 0 };
      return { x: -dy / len * halfWidth, y: dx / len * halfWidth };
    };

    // Получаем перпендикуляры для каждого сегмента
    const perp1 = getPerpendicular(inletPoint, cornerPoint);
    const perp2 = getPerpendicular(cornerPoint, outletPoint);

    // Строим замкнутый контур
    ctx.beginPath();

    // Верхняя сторона
    ctx.moveTo(inletPoint.x - perp1.x, inletPoint.y - perp1.y);
    ctx.lineTo(cornerPoint.x - perp1.x, cornerPoint.y - perp1.y);
    ctx.lineTo(outletPoint.x - perp2.x, outletPoint.y - perp2.y);

    // Нижняя сторона (обратный путь)
    ctx.lineTo(outletPoint.x + perp2.x, outletPoint.y + perp2.y);
    ctx.lineTo(cornerPoint.x + perp1.x, cornerPoint.y + perp1.y);
    ctx.lineTo(inletPoint.x + perp1.x, inletPoint.y + perp1.y);

    ctx.closePath();
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const { inletPoint, cornerPoint, outletPoint } = this.getPathPoints();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(inletPoint.x, inletPoint.y);
    ctx.lineTo(cornerPoint.x, cornerPoint.y);
    ctx.lineTo(outletPoint.x, outletPoint.y);

    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = this.color;
    }
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const { inletPoint, outletPoint } = this.getPathPoints();
    const dir = this._direction;

    let inletSide = 'left';
    let outletSide = 'bottom';

    const sideMap = {
      'bottom': 'bottom',
      'bottom-left': 'bottom',
      'bottom-right': 'bottom'
    };

    outletSide = sideMap[dir] || 'bottom';

    const inletPos = this.rotatePoint(inletPoint.x, inletPoint.y, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(outletPoint.x, outletPoint.y, this.x, this.y, rotation);

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', inletSide, 0, 0, inletPos.x, inletPos.y
    ));

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', outletSide, 0, 0, outletPos.x, outletPos.y
    ));

    return ports;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const { inletPoint, cornerPoint, outletPoint } = this.getPathPoints();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();
    ctx.moveTo(inletPoint.x, inletPoint.y);
    ctx.lineTo(cornerPoint.x, cornerPoint.y);
    ctx.lineTo(outletPoint.x, outletPoint.y);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._r || this._r <= 0) return false;

    const tolerance = this._hitTolerance;
    const local = this.transformToLocalCoords(worldX, worldY);
    const { inletPoint, cornerPoint, outletPoint } = this.getPathPoints();

    const distToInlet = this.distanceToSegment(local.x, local.y, inletPoint.x, inletPoint.y, cornerPoint.x, cornerPoint.y);
    const distToOutlet = this.distanceToSegment(local.x, local.y, cornerPoint.x, cornerPoint.y, outletPoint.x, outletPoint.y);

    return distToInlet <= tolerance || distToOutlet <= tolerance;
  }

  distanceToSegment(px, py, x1, y1, x2, y2) {
    const ax = px - x1;
    const ay = py - y1;
    const bx = x2 - x1;
    const by = y2 - y1;

    const dot = ax * bx + ay * by;
    const len2 = bx * bx + by * by;

    if (len2 === 0) return Math.sqrt(ax * ax + ay * ay);

    let t = dot / len2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * bx;
    const projY = y1 + t * by;

    const dx = px - projX;
    const dy = py - projY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      r: this._r,
      direction: this._direction
    };
  }
}
