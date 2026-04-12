import { DuctDirect } from './DuctDirect.js';
import { Port } from './Port.js';

// ========== ПЕРЕХОД ==========
export class Transition extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', sectionType2 = 'round', a1 = 125, a2 = 200, b = 500, c = 125, c2 = 125) {
    super(id, x_px, y_px, sectionType, a1, b, c);
    this.type = 'transition';
    this.name = `Переход ${id}`;
    this._sectionType2 = sectionType2;
    this._a2 = a2;
    this._c2 = c2;
  }
  get sectionType2() { return this._sectionType2; }
  set sectionType2(value) {
    if (this._sectionType2 === value) return;
    this._sectionType2 = value;
    this.updatePorts();
    this.updateCalloutText();
  }

  get a2() { return this._a2; }
  set a2(value) {
    if (this._a2 === value) return;
    this._a2 = value;
    this.updatePorts();
    this.updateCalloutText();
  }


  get c2() { return this._c2; }
  set c2(value) {
    if (this._c2 === value) return;
    this._c2 = value;
    this.updatePorts();
    this.updateCalloutText();
  }


  getWidth() {
    return this.mmToPx(this._b); // _b это длина перехода
  }

  getHeight() {
    const maxSize = Math.max(this._a, this._a2);
    return this.mmToPx(maxSize);
  }

  // Получаем левый верхний угол с учетом максимальной высоты
  getTopLeft() {
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    return {
      x: this.x - width_px / 2,
      y: this.y - height_px / 2
    };
  }

  getSizeAt(t) {
    return this._a + (this._a2 - this._a) * t;
  }

  getCalloutText() {
    const length_m = this._b / 1000;
    const size1_m = this._a / 1000;
    const size2_m = this._a2 / 1000;
    const avgArea = ((size1_m + size2_m) / 2 * length_m).toFixed(2);
    const typeText = this._sectionType === 'round' ? '⌀' : '□';
    const typeText2 = this._sectionType2 === 'round' ? '⌀' : '□';
    const s1 = this._sectionType === 'round' ? this._a : `${this._a}x${this.c}`;
    const s2 = this._sectionType2 === 'round' ? this._a2 : `${this._a2}x${this.c}`;
    return `${this.name}\n${typeText}${s1} → ${typeText2}${s2} мм\nL: ${this._b} мм\nSср: ${avgArea} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'sectionType2', label: 'Тип сечения 2', type: 'select', options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ], value: this.sectionType2
      },
      {
        name: 'a2',
        label: `A2`,
        type: 'number',
        step: 10,
        min: 20,
        value: this._a2,
        unit: 'мм'
      },
      {
        name: 'c2',
        label: `C2`,
        type: 'number',
        step: 10,
        min: 20,
        value: this._c2,
        unit: 'мм'
      },
    ];
  }

  getPorts() {
    const width_px = this.getWidth();
    const height1_px = this.mmToPx(this._a);
    const height2_px = this.mmToPx(this._a2);
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    const ports = [];

    // Левый порт (меньшее сечение)
    const inletPos = this.rotatePoint(
      topLeft.x,
      centerY,
      centerX, centerY, rotation
    );
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, height1_px / 2, inletPos.x, inletPos.y
    ));

    // Правый порт (большее сечение)
    const outletPos = this.rotatePoint(
      topLeft.x + width_px,
      centerY,
      centerX, centerY, rotation
    );
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width_px, height2_px / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  // Замените метод draw
  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const width_px = this.getWidth();
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Центральная линия перехода
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    ctx.lineWidth = 2 * this._hitTolerance;
    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = isDarkTheme ? '#888' : '#333';
    }
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
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

  hitTest(worldX, worldY, ctx) {
    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    const centerY = this.y;
    const width_px = this.getWidth();

    // Проверяем, находится ли курсор ровно на линии
    const isOnLine =
      local.x >= topLeft.x &&
      local.x <= topLeft.x + width_px &&
      Math.abs(local.y - centerY) <= this._hitTolerance;

    return isOnLine;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      a2: this._a2,
      c2: this._c2,
      sectionType2: this._sectionType2,
    };
  }
}
