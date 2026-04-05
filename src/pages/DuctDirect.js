import { BaseElement, DuctBase } from './Elements.js';

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125, b = 3000, c = 125) {
    super(id, 'duct', x_px, y_px, `${BaseElement.getAvailableTypes().duct} ${id}`, sectionType, a);
    this._b = b; // Длина воздуховода
    this._c = c; // Высота для прямоугольного сечения (только для расчетов экв. диаметра)
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

  // Расчет эквивалентного диаметра для прямоугольного сечения
  getEquivalentDiameter() {
    if (this._sectionType === 'round') {
      return this._a;
    } else {
      // Формула: Dэкв = 2 * a * c / (a + c)
      return (2 * this._a * this._c) / (this._a + this._c);
    }
  }

  getWidth() {
    return this.mmToPx(this._b);
  }

  getHeight() {
    // Для отрисовки используем ТОЛЬКО a (ширина/диаметр трубы)
    // c используется только для расчетов
    return this.mmToPx(this._a);
  }

  getCalloutText() {
    let text = `${super.getCalloutText()}\nB: ${this._b} мм`;

    if (this._sectionType === 'rectangular') {
      const eqDiameter = this.getEquivalentDiameter();
      text += `\n${this._a}x${this._c} мм\nDэкв: ${eqDiameter.toFixed(0)} мм`;
    } else {
      text += `\n⌀${this._a} мм`;
    }

    return text;
  }

  getParameters() {
    const params = [
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
    if (this._sectionType === 'rectangular') {
      params.push({
        name: 'c',
        label: 'C',
        type: 'number',
        step: 10,
        min: 20,
        value: this._c,
        unit: 'мм'
      });
    }
    return params;
  }

  getPorts() {
    return this.createLinearPorts(this.getWidth(), this.getHeight());
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    // Отрисовка использует a (ширина трубы), c игнорируется
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
      b: this._b,
      c: this._c
    };
  }
}
