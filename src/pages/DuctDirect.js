import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, b = 750, c = 125) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, sectionType, a);
    this._b = b;
    this._c = c;
  }

  getSizePx() { return 0; }

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

  getEquivalentDiameter() {
    if (this._sectionType === 'round') return this._a;
    return (2 * this._a * this._c) / (this._a + this._c);
  }

  getWidth() { return this.mmToPx(this._b); }
  getHeight() { return this.mmToPx(this._a); }

  getTopLeft() {
    const width = this.getWidth();
    const height = this.getHeight();
    return { x: this.x - width / 2, y: this.y - height / 2 };
  }

  getCalloutText() {
    let text = `${super.getCalloutText()}\nB: ${this._b} мм`;
    if (this._sectionType === 'rectangular') {
      text += `\n${this._a}x${this._c} мм\nDэкв: ${this.getEquivalentDiameter().toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }
    return text;
  }

  getParameters() {
    const params = [...super.getParameters(), { name: 'b', label: 'B', type: 'number', step: 10, min: 30, value: this._b, unit: 'мм' }];
    if (this._sectionType === 'rectangular') {
      params.push({ name: 'c', label: 'C', type: 'number', step: 10, min: 20, value: this._c, unit: 'мм' });
    }
    return params;
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const inletPos = this.rotatePoint(topLeft.x, this.y, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(topLeft.x + this.getWidth(), this.y, this.x, this.y, rotation);
    ports.push(new Port(this.ports?.find(p => p.direction === 'inlet')?.id || Date.now(), this.id, 'inlet', 'left', 0, this.getHeight() / 2, inletPos.x, inletPos.y));
    ports.push(new Port(this.ports?.find(p => p.direction === 'outlet')?.id || Date.now(), this.id, 'outlet', 'right', this.getWidth(), this.getHeight() / 2, outletPos.x, outletPos.y));
    return ports;
  }

  // В DuctDirect.js, убедитесь что createPath правильно создает путь:

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const endX = topLeft.x + this.getWidth();
    const centerY = this.y;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    ctx.beginPath();  // ВАЖНО: beginPath должен быть здесь!
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

  // В DuctDirect.js, замените метод hitTest на этот:

  hitTest(worldX, worldY, ctx) {
    // Сохраняем состояние контекста
    ctx.save();

    // Применяем трансформации как при рисовании
    const rotation = this.rotation || 0;
    ctx.translate(this.x, this.y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    // Создаем путь
    this.createPath(ctx);

    // Увеличиваем толщину линии для hit test (важно!)
    const hitLineWidth = Math.max(this.lineWidth + 8, 15);
    ctx.lineWidth = hitLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Проверяем попадание в линию
    let hit = ctx.isPointInStroke(worldX, worldY);

    // Если не попали, проверяем точки вокруг (для надежности)
    if (!hit) {
      const offsets = [-3, -2, -1, 0, 1, 2, 3];
      for (const dx of offsets) {
        for (const dy of offsets) {
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

  toJSON() { return { ...super.toJSON(), b: this._b, c: this._c }; }
}
