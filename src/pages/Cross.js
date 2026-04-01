import { BaseElement, DuctBase } from './Elements.js';
import { Port } from './Port.js';

// ========== КРЕСТОВИНА ==========
export class Cross extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'cross', x_px, y_px, `${BaseElement.getAvailableTypes().cross} ${id}`, sectionType, a);
    this._b = 100;                   // Высота для прямоугольного сечения (только для расчета эквивалентного диаметра)
    this._horizontalLength_mm = 250; // Горизонтальная длина крестовины
    this._verticalLength_mm = 250;   // Вертикальная длина крестовины
  }

  // Геттеры и сеттеры

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;
    if (this._a > this._horizontalLength_mm * 0.6 || this._a > this._verticalLength_mm  * 0.6) return;
    this._a = value;
    this.updatePorts();
  }

  get b() { return this._b; }

  set b(newB) {
    if (this._b === newB) return;
    this._b = newB;
    // b не влияет на форму крестовины, только на расчет эквивалентного диаметра
    this.updateCalloutText();
  }

  // Геттеры и сеттеры для горизонтальной длины
  get horizontalLength_mm() { return this._horizontalLength_mm; }

  set horizontalLength_mm(newLength) {
    if (this._horizontalLength_mm === newLength) return;
    this._horizontalLength_mm = Math.max(this._a * 2, newLength);
    this.updatePorts();
  }

  // Геттеры и сеттеры для вертикальной длины
  get verticalLength_mm() { return this._verticalLength_mm; }

  set verticalLength_mm(newLength) {
    if (this._verticalLength_mm === newLength) return;
    this._verticalLength_mm = Math.max(this._a * 2, newLength);
    this.updatePorts();
  }

  // Получаем полные размеры элемента (bounding box)
  getWidth() {
    return this.mmToPx(this._horizontalLength_mm);
  }

  getHeight() {
    return this.mmToPx(this._verticalLength_mm);
  }

  // Получаем точку привязки (верхний левый угол bounding box)
  getTopLeft() {
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    return {
      x: this.x - width_px / 2,
      y: this.y - height_px / 2
    };
  }

  getCalloutText() {
    const baseText = `${super.getCalloutText()}`;
    if (this._sectionType === 'round') {
      return `${baseText}\nL1: ${this._horizontalLength_mm} мм\nL2: ${this._verticalLength_mm} мм`;
    } else {
      // Для прямоугольного сечения показываем параметр B для информации
      return `${baseText}\nB: ${this._b} мм\nL1: ${this._horizontalLength_mm} мм\nL2: ${this._verticalLength_mm} мм`;
    }
  }

  getParameters() {
    const baseParams = super.getParameters();

    if (this._sectionType === 'round') {
      return [
        ...baseParams,
        {
          name: 'horizontalLength_mm',
          label: 'L1',
          type: 'number',
          step: 10,
          min: 50,
          value: this._horizontalLength_mm,
          unit: 'мм'
        },
        {
          name: 'verticalLength_mm',
          label: 'L2',
          type: 'number',
          step: 10,
          min: 50,
          value: this._verticalLength_mm,
          unit: 'мм'
        }
      ];
    } else {
      return [
        ...baseParams,
        {
          name: 'b',
          label: 'B',
          type: 'number',
          step: 10,
          min: 30,
          value: this._b,
          unit: 'мм'
        },
        {
          name: 'horizontalLength_mm',
          label: 'L1',
          type: 'number',
          step: 10,
          min: 50,
          value: this._horizontalLength_mm,
          unit: 'мм'
        },
        {
          name: 'verticalLength_mm',
          label: 'L2',
          type: 'number',
          step: 10,
          min: 50,
          value: this._verticalLength_mm,
          unit: 'мм'
        }
      ];
    }
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx(); // Ширина воздуховода (параметр A)

    // Левый порт
    const leftX = topLeft.x;
    const leftY = centerY;
    const leftPos = this.rotatePoint(leftX, leftY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`,
      this.id, 'left', 'left', 0, height_px / 2, leftPos.x, leftPos.y
    ));

    // Правый порт
    const rightX = topLeft.x + width_px;
    const rightY = centerY;
    const rightPos = this.rotatePoint(rightX, rightY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`,
      this.id, 'right', 'right', width_px, height_px / 2, rightPos.x, rightPos.y
    ));

    // Верхний порт
    const topX = centerX;
    const topY = topLeft.y;
    const topPos = this.rotatePoint(topX, topY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'top')?.id || `port_${this.id}_top`,
      this.id, 'top', 'top', width_px / 2, 0, topPos.x, topPos.y
    ));

    // Нижний порт
    const bottomX = centerX;
    const bottomY = topLeft.y + height_px;
    const bottomPos = this.rotatePoint(bottomX, bottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'bottom')?.id || `port_${this.id}_bottom`,
      this.id, 'bottom', 'bottom', width_px / 2, height_px, bottomPos.x, bottomPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    if (this._sectionType === 'round') {
      this._createRoundCross(ctx);
    } else {
      this._createRectangularCross(ctx);
    }
  }

  // Круглая крестовина
  _createRoundCross(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx();  // Диаметр круглого сечения (параметр A)
    const radius_px = size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная труба (круглое сечение)
    const horizontalY = centerY - radius_px;
    ctx.rect(topLeft.x, horizontalY, width_px, size_px);

    // Вертикальная труба (круглое сечение)
    const verticalX = centerX - radius_px;
    ctx.rect(verticalX, topLeft.y, size_px, height_px);

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Прямоугольная крестовина
  _createRectangularCross(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const a_px = this.getSizePx();  // Ширина прямоугольного сечения (параметр A)
    // Параметр B НЕ используется для отрисовки ширины!

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Горизонтальная труба (ширина = A, высота = A)
    const horizontalY = centerY - a_px / 2;
    ctx.rect(topLeft.x, horizontalY, width_px, a_px);

    // Вертикальная труба (ширина = A, высота = A)
    const verticalX = centerX - a_px / 2;
    ctx.rect(verticalX, topLeft.y, a_px, height_px);

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    // Рисуем основной контур
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);

    // Горизонтальная центральная линия
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Вертикальная центральная линия
    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height_px);

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._a || this._a <= 0) {
      return false;
    }

    if (ctx) {
      this.createPath(ctx);
      return ctx.isPointInPath(worldX, worldY);
    }

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    this.createPath(tempCtx);
    return tempCtx.isPointInPath(worldX, worldY);
  }

  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      type: 'cross',
      b: this._b,
      horizontalLength_mm: this._horizontalLength_mm,
      verticalLength_mm: this._verticalLength_mm,
    };
  }
}
