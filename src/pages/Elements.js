import { Port } from './Port.js';
import { Callout } from './Callout.js';
import { globalScale } from './GlobalScale.js';


// ========== БАЗОВЫЙ КЛАСС ЭЛЕМЕНТА ==========
export class BaseElement {
  constructor(id, type, x, y, name) {
    this.id = id;
    this.type = type;
    this.x = x;          // в пикселях - координаты ЦЕНТРА!
    this.y = y;          // в пикселях - координаты ЦЕНТРА!
    this.name = name;
    this.color = this.getColors()[0].value;
    this.rotation = 0;
    this.ports = [];
    this.callouts = [];
  }

  // Получение текущего масштаба мм/px
  getMmPerPx() {
    return globalScale.getMmPerPx();
  }

  // Конвертация мм в px
  mmToPx(mm) {
    return globalScale.mmToPx(mm);
  }

  // Конвертация px в мм
  pxToMm(px) {
    return globalScale.pxToMm(px);
  }

  // Получение левого верхнего угла (для отрисовки)
  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  static getAvailableTypes() {
    return {
      'duct': 'Прямой воздуховод',
      'fan': 'Вентилятор',
      'tee': 'Тройник',
      'elbow': 'Отвод',
      'cross': 'Крестовина',
      'group': 'Группа элементов'
    };
  }

  // Абстрактные методы (должны быть переопределены)
  getWidth() { throw new Error('Метод getWidth должен быть переопределен'); }
  getHeight() { throw new Error('Метод getHeight должен быть переопределен'); }
  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  draw(ctx, scale, isSelected, isDarkTheme) { throw new Error('Метод draw должен быть переопределен'); }
  hitTest(worldX, worldY) { throw new Error('Метод hitTest должен быть переопределен'); }

  setStrokeStyle(ctx, scale, isSelected, isDarkTheme) {
    ctx.lineWidth = Math.max(1, 2 / scale);
    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else {
      ctx.strokeStyle = '#666';
    }
    ctx.stroke();
  }

  setFillStyle(ctx, isSelected, isDarkTheme) {
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  getTypeName() {
    return BaseElement.getAvailableTypes()[this.type] || this.type;
  }

  getCalloutText() {
    return `${this.name}`;
  }

  getElementText() {
    return '';
  }

  getColors() {
    return [
      { value: '#C9C9C9', label: 'Серый' },
      { value: '#ff0000', label: 'Красный' },
      { value: '#00ff00', label: 'Зеленый' },
      { value: '#0000ff', label: 'Синий' },
      { value: '#ffff00', label: 'Желтый' },
      { value: '#9c27b0', label: 'Фиолетовый' },
      { value: '#2196f3', label: 'Голубой' },
      { value: '#ff6600', label: 'Оранжевый' },
      { value: '#ff3399', label: 'Розовый' },
      { value: '#663399', label: 'Пурпурный' },
      { value: '#0099ff', label: 'Лазурный' }
    ];
  }

  getParameters() {
    return [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      { name: 'x', label: 'Позиция по X', type: 'number', step: 1, min: 20, value: this.x, unit: 'px' },
      { name: 'y', label: 'Позиция по Y', type: 'number', step: 1, min: 20, value: this.y, unit: 'px' },
      { name: 'rotation', label: 'Поворот', type: 'number', step: 1, min: 0, value: this.rotation, unit: '°' },
      {
        name: 'color', label: 'Цвет', type: 'select', options: this.getColors(), value: this.color
      },
    ];
  }

  getRelativeCalloutEntryPoint() {
    return { x: this.getWidth() / 2, y: this.getHeight() / 2 };
  }

  getAbsoluteCalloutPoint() {
    const relativePoint = this.getRelativeCalloutEntryPoint();
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const dx = relativePoint.x - width / 2;
    const dy = relativePoint.y - height / 2;
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    return {
      x: centerX + rotatedX,
      y: centerY + rotatedY
    };
  }

  getRotationCenter() {
    return {
      x: this.x,
      y: this.y
    };
  }

  rotatePoint(x, y, centerX, centerY, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX,
      y: dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY
    };
  }

  transformToLocalCoords(worldX, worldY) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;

    if (rotation === 0) {
      return { x: worldX, y: worldY };
    }

    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const angle = -rotation * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    return {
      x: rotatedX + centerX,
      y: rotatedY + centerY
    };
  }

  updatePortsWorldCoordinates() {
    if (!this.ports || this.ports.length === 0) return;

    const currentPorts = this.getPorts();
    this.ports.forEach((port, index) => {
      const updatedPort = currentPorts[index];
      if (updatedPort) {
        port.worldX = updatedPort.worldX;
        port.worldY = updatedPort.worldY;
        port.localX = updatedPort.localX;
        port.localY = updatedPort.localY;
      }
    });
  }

  updatePorts() {
    const oldPorts = this.ports;
    const newPorts = this.getPorts();
    newPorts.forEach(newPort => {
      const oldPort = oldPorts.find(p => p.direction === newPort.direction);
      if (oldPort) {
        newPort.id = oldPort.id;
        newPort.connectedElementId = oldPort.connectedElementId;
        newPort.connectedPortId = oldPort.connectedPortId;
      }
    });
    this.ports = newPorts;
  }

  getPortsAfterMove(deltaX, deltaY) {
    if (!this.ports) return [];
    return this.ports.map(port => ({
      ...port,
      worldX: port.worldX + deltaX,
      worldY: port.worldY + deltaY,
    }));
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    this.callouts.push(callout);
    return callout;
  }

  removeCallout(calloutId) {
    const index = this.callouts.findIndex(c => c.id === calloutId);
    if (index !== -1) {
      this.callouts.splice(index, 1);
    }
  }

  updateCalloutText() {
    if (this.callouts.length > 0) {
      this.callouts[0].text = this.getCalloutText();
    }
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const width = this.getWidth();
    const height = this.getHeight();
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
    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return {
      id: this.id, type: this.type, x: this.x, y: this.y, name: this.name,
      color: this.color, rotation: this.rotation,
      ports: this.ports.map(p => p.toJSON()),
      callouts: this.callouts.map(c => c.toJSON())
    };
  }
}

// ========== БАЗОВЫЙ КЛАСС ВОЗДУХОВОДА ==========
export class DuctBase extends BaseElement {
  constructor(id, type, x, y, name, sectionType = 'round', size) {
    super(id, type, x, y, name);
    this._a = size;
    this._sectionType = sectionType;
  }

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;
    this._a = value;
    // Центр остается на месте, размеры изменяются
    this.updatePorts();
  }

  get sectionType() { return this._sectionType; }

  set sectionType(newType) {
    if (this._sectionType === newType) return;
    this._sectionType = newType;
    this.updateCalloutText();
  }

  // Размер в пикселях для отрисовки
  getSizePx() {
    return this.mmToPx(this._a);
  }
  getCalloutText() {
    return `${super.getCalloutText()}\nA: ${this._a} мм`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'sectionType', label: 'Тип сечения', type: 'select', options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ], value: this.sectionType
      },
      {
        name: 'a',
        label: 'A',
        type: 'number',
        step: 10,
        min: 20,
        value: this._a,
        unit: 'мм'
      },
    ];
  }

  createLinearPorts(width_px, height_px, offsetX = 0, offsetY = 0) {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    const inletPos = this.rotatePoint(topLeft.x + offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', offsetX, height_px / 2 + offsetY, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(topLeft.x + width_px - offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width_px - offsetX, height_px / 2 + offsetY, outletPos.x, outletPos.y
    ));

    return ports;
  }

  drawRectangular(ctx, width_px, height_px, isSelected, scale, showColors) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    ctx.beginPath();

    ctx.rect(topLeft.x, topLeft.y, width_px, height_px);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

    ctx.restore();
  }

  hitTestRectangular(worldX, worldY, width_px, height_px) {
    const local = this.transformToLocalCoords(worldX, worldY);
    const topLeft = this.getTopLeft();
    return local.x >= topLeft.x && local.x <= topLeft.x + width_px &&
      local.y >= topLeft.y && local.y <= topLeft.y + height_px;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      a: this._a,
      sectionType: this._sectionType
    };
  }
}

// ========== ТРОЙНИК (Т-образный) ==========
export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', a = 125) {
    super(id, 'tee', x_px, y_px, `${BaseElement.getAvailableTypes().tee} ${id}`, sectionType, a);
    this._b = 100;                   // Высота для прямоугольного сечения
    this._branchLength_mm = 125;     // Длина ответвления
    this._mainLength_mm = 250;       // Длина основной магистрали
  }

  // Геттеры и сеттеры для высоты прямоугольного сечения
  get b() { return this._b; }

  set b(newB) {
    if (this._b === newB) return;
    this._b = newB;
    this.updatePorts();
  }

  // Геттеры и сеттеры для длины ответвления
  get branchLength_mm() { return this._branchLength_mm; }

  set branchLength_mm(newLength) {
    if (this._branchLength_mm === newLength) return;
    this._branchLength_mm = Math.max(this._a, newLength);
    this.updatePorts();
  }

  // Геттеры и сеттеры для длины основной магистрали
  get mainLength_mm() { return this._mainLength_mm; }

  set mainLength_mm(newLength) {
    if (this._mainLength_mm === newLength) return;
    this._mainLength_mm = Math.max(this._a * 2, newLength);
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._mainLength_mm);
  }

  getHeight() {
    if (this._sectionType === 'round') {
      return this.mmToPx(this._branchLength_mm);
    } else {
      return this.mmToPx(this._branchLength_mm);
    }
  }

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
      return `${baseText}\nMain: ${this._mainLength_mm} мм\nBranch: ${this._branchLength_mm} мм`;
    } else {
      return `${baseText}\nB: ${this._b} мм\nMain: ${this._mainLength_mm} мм\nBranch: ${this._branchLength_mm} мм`;
    }
  }

  getParameters() {
    const baseParams = super.getParameters();

    if (this._sectionType === 'round') {
      return [
        ...baseParams,
        {
          name: 'mainLength_mm',
          label: 'Main L',
          type: 'number',
          step: 10,
          min: 50,
          value: this._mainLength_mm,
          unit: 'мм'
        },
        {
          name: 'branchLength_mm',
          label: 'Branch L',
          type: 'number',
          step: 10,
          min: 50,
          value: this._branchLength_mm,
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
          name: 'mainLength_mm',
          label: 'Main L',
          type: 'number',
          step: 10,
          min: 50,
          value: this._mainLength_mm,
          unit: 'мм'
        },
        {
          name: 'branchLength_mm',
          label: 'Branch L',
          type: 'number',
          step: 10,
          min: 50,
          value: this._branchLength_mm,
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
    const size_px = this.getSizePx();

    if (this._sectionType === 'round') {
      const radius_px = size_px / 2;

      // Левый порт (вход/выход основной магистрали)
      const leftX = topLeft.x;
      const leftY = centerY;
      const leftPos = this.rotatePoint(leftX, leftY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`,
        this.id, 'left', 'left', 0, height_px / 2, leftPos.x, leftPos.y
      ));

      // Правый порт (вход/выход основной магистрали)
      const rightX = topLeft.x + width_px;
      const rightY = centerY;
      const rightPos = this.rotatePoint(rightX, rightY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`,
        this.id, 'right', 'right', width_px, height_px / 2, rightPos.x, rightPos.y
      ));

      // Верхний порт (ответвление)
      const topX = centerX;
      const topY = topLeft.y;
      const topPos = this.rotatePoint(topX, topY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'branch')?.id || `port_${this.id}_branch`,
        this.id, 'branch', 'top', width_px / 2, 0, topPos.x, topPos.y
      ));

    } else {
      // Прямоугольное сечение
      const b_px = this.mmToPx(this._b);

      // Левый порт (вход/выход основной магистрали)
      const leftX = topLeft.x;
      const leftY = centerY;
      const leftPos = this.rotatePoint(leftX, leftY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'left')?.id || `port_${this.id}_left`,
        this.id, 'left', 'left', 0, height_px / 2, leftPos.x, leftPos.y
      ));

      // Правый порт (вход/выход основной магистрали)
      const rightX = topLeft.x + width_px;
      const rightY = centerY;
      const rightPos = this.rotatePoint(rightX, rightY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'right')?.id || `port_${this.id}_right`,
        this.id, 'right', 'right', width_px, height_px / 2, rightPos.x, rightPos.y
      ));

      // Верхний порт (ответвление)
      const topX = centerX;
      const topY = topLeft.y;
      const topPos = this.rotatePoint(topX, topY, centerX, centerY, rotation);
      ports.push(new Port(
        this.ports?.find(p => p.direction === 'branch')?.id || `port_${this.id}_branch`,
        this.id, 'branch', 'top', width_px / 2, 0, topPos.x, topPos.y
      ));
    }

    return ports;
  }

  createPath(ctx) {
    if (this._sectionType === 'round') {
      this._createRoundTee(ctx);
    } else {
      this._createRectangularTee(ctx);
    }
  }

  // Круглый Т-образный тройник
  _createRoundTee(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx();
    const radius_px = size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Рисуем основную горизонтальную магистраль
    ctx.beginPath();
    const mainY = centerY - radius_px;
    ctx.rect(topLeft.x, mainY, width_px, size_px);
    ctx.fill();
    ctx.stroke();

    // Рисуем ответвление (вертикальная труба) - Т-образная форма
    ctx.beginPath();
    const branchX = centerX - radius_px;
    const branchTop = topLeft.y;
    const branchBottom = topLeft.y + height_px;
    const mainTop = mainY;
    const mainBottom = mainY + size_px;

    // Верхняя часть ответвления (над основной магистралью)
    if (branchTop < mainTop) {
      ctx.rect(branchX, branchTop, size_px, mainTop - branchTop);
      ctx.fill();
      ctx.stroke();
    }

    // Центральная часть ответвления (боковые стороны вокруг основной магистрали)
    // Левая половина
    ctx.beginPath();
    ctx.rect(branchX, mainTop, radius_px, size_px);
    ctx.fill();
    ctx.stroke();

    // Правая половина
    ctx.beginPath();
    ctx.rect(branchX + radius_px, mainTop, radius_px, size_px);
    ctx.fill();
    ctx.stroke();

    // Нижняя часть ответвления (под основной магистралью)
    if (mainBottom < branchBottom) {
      ctx.beginPath();
      ctx.rect(branchX, mainBottom, size_px, branchBottom - mainBottom);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // Прямоугольный Т-образный тройник
  _createRectangularTee(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const b_px = this.mmToPx(this._b);
    const branchWidth_px = this.mmToPx(this._branchLength_mm);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Рисуем основную горизонтальную магистраль
    ctx.beginPath();
    const mainY = centerY - b_px / 2;
    ctx.rect(topLeft.x, mainY, width_px, b_px);
    ctx.fill();
    ctx.stroke();

    // Рисуем ответвление (вертикальная труба) - Т-образная форма
    ctx.beginPath();
    const branchX = centerX - branchWidth_px / 2;
    const branchTop = topLeft.y;
    const branchBottom = topLeft.y + height_px;
    const mainTop = mainY;
    const mainBottom = mainY + b_px;

    // Верхняя часть ответвления (над основной магистралью)
    if (branchTop < mainTop) {
      ctx.rect(branchX, branchTop, branchWidth_px, mainTop - branchTop);
      ctx.fill();
      ctx.stroke();
    }

    // Центральная часть ответвления (боковые стороны вокруг основной магистрали)
    // Левая половина
    ctx.beginPath();
    ctx.rect(branchX, mainTop, branchWidth_px / 2, b_px);
    ctx.fill();
    ctx.stroke();

    // Правая половина
    ctx.beginPath();
    ctx.rect(branchX + branchWidth_px / 2, mainTop, branchWidth_px / 2, b_px);
    ctx.fill();
    ctx.stroke();

    // Нижняя часть ответвления (под основной магистралью)
    if (mainBottom < branchBottom) {
      ctx.beginPath();
      ctx.rect(branchX, mainBottom, branchWidth_px, branchBottom - mainBottom);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    // Рисуем основной контур
    this.createPath(ctx);

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

    // Горизонтальная центральная линия (основная магистраль)
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width_px, centerY);

    // Вертикальная центральная линия (ответвление)
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
      type: 'tee',
      b: this._b,
      branchLength_mm: this._branchLength_mm,
      mainLength_mm: this._mainLength_mm,
    };
  }
}


// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements) {
    const groupId = (typeof id === 'number' && id !== undefined) ? id : Date.now() + Math.random();
    super(groupId, 'group', 0, 0, `Группа ${groupId}`);
    this.elements = elements || [];
    this.updateBounds();
  }

  updateBounds() {
    if (!this.elements || this.elements.length === 0) {
      this.x = 0;
      this.y = 0;
      this.width = 0;
      this.height = 0;
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    this.elements.forEach(element => {
      if (!element) return;
      const topLeft = element.getTopLeft();
      const elementMinX = topLeft.x;
      const elementMinY = topLeft.y;
      const elementMaxX = topLeft.x + element.getWidth();
      const elementMaxY = topLeft.y + element.getHeight();

      minX = Math.min(minX, elementMinX);
      minY = Math.min(minY, elementMinY);
      maxX = Math.max(maxX, elementMaxX);
      maxY = Math.max(maxY, elementMaxY);
    });

    // Центр группы - это центр ограничивающего прямоугольника
    this.x = (minX + maxX) / 2;
    this.y = (minY + maxY) / 2;
    this.width = maxX - minX;
    this.height = maxY - minY;
  }

  getTopLeft() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2
    };
  }

  getElements() {
    return [...(this.elements || [])];
  }

  getPortsAfterMove(deltaX, deltaY) {
    const allPorts = [];
    const collect = (element) => {
      if (element.ports) {
        element.ports.forEach(port => {
          allPorts.push({
            ...port,
            worldX: port.worldX + deltaX,
            worldY: port.worldY + deltaY,
          });
        });
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(collect);
      }
    };
    collect(this);
    return allPorts;
  }

  getWidth() {
    return this.width || 0;
  }

  getHeight() {
    return this.height || 0;
  }

  getCalloutText() {
    return `${this.name}\nКоличество элементов: ${this.elements ? this.elements.length : 0}`;
  }

  getParameters() {
    return [{ name: 'name', label: 'Имя', type: 'text', value: this.name }];
  }

  getPorts() {
    return [];
  }

  getAllPorts() {
    const allPorts = [];

    const collectPorts = (element) => {
      if (element.ports && element.ports.length > 0) {
        allPorts.push(...element.ports);
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(collectPorts);
      }
    };

    collectPorts(this);
    return allPorts;
  }

  move(deltaX, deltaY) {
    if (!this.elements || this.elements.length === 0) return;

    if (isNaN(deltaX) || isNaN(deltaY) || !isFinite(deltaX) || !isFinite(deltaY)) {
      console.warn('Invalid delta in group move:', deltaX, deltaY);
      return;
    }

    this.elements.forEach(element => {
      if (element) {
        element.x += deltaX;
        element.y += deltaY;

        if (element.callouts && element.callouts.length > 0) {
          element.callouts.forEach(callout => {
            callout.x += deltaX;
            callout.y += deltaY;
          });
        }

        if (element.updatePorts) element.updatePorts();
        if (element.updateCalloutText) element.updateCalloutText();
      }
    });

    this.updateBounds();
  }

  createPath(ctx) { }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.draw) {
          element.draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors);
        }
      });
    }

    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.callouts && element.callouts.length > 0) {
          for (const callout of element.callouts) {
            callout.draw(ctx, scale, isDarkTheme, element);
          }
        }
      });
    }

    ctx.save();
    ctx.lineWidth = Math.max(2, 3 / scale);
    if (isSelected && this.width > 0 && this.height > 0) {
      ctx.strokeStyle = '#ff6600';
    } else {
      ctx.strokeStyle = '#444444';
    }
    ctx.setLineDash([5 / scale, 5 / scale]);
    const topLeft = this.getTopLeft();
    ctx.strokeRect(topLeft.x, topLeft.y, this.width, this.height);
    ctx.setLineDash([]);
    ctx.fillStyle = isDarkTheme ? '#444444' : '#000';
    ctx.font = `26px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText(this.name, topLeft.x + 10, topLeft.y + 16 / scale);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this.elements) return false;
    for (const element of this.elements) {
      if (element && element.hitTest && element.hitTest(worldX, worldY, ctx)) {
        return true;
      }
    }
    return false;
  }

  updatePorts() {
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.updatePorts) element.updatePorts();
      });
    }
  }

  updateCalloutText() {
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.updateCalloutText) element.updateCalloutText();
      });
    }
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    if (!this.callouts) this.callouts = [];
    this.callouts.push(callout);
    return callout;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: 'group',
      elements: this.elements ? this.elements.map(el => el.toJSON()) : [],
      width: this.width,
      height: this.height
    };
  }
}
