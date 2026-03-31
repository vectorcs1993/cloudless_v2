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
  constructor(id, type, x, y, name, sectionType = 'round', size_mm) {
    super(id, type, x, y, name);
    this._size_mm = size_mm;
    this._sectionType = sectionType;
  }

  get size_mm() { return this._size_mm; }

  set size_mm(value) {
    if (this._size_mm === value) return;
    this._size_mm = value;
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
    return this.mmToPx(this._size_mm);
  }

  getCalloutText() {
    return `${super.getCalloutText()}\nШирина: ${this._size_mm} мм`;
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
        name: 'size_mm',
        label: this._sectionType === 'round' ? 'Диаметр' : 'Ширина',
        type: 'number',
        step: 10,
        min: 20,
        value: this._size_mm,
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
      size_mm: this._size_mm,
      sectionType: this._sectionType
    };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 100) {
    super(id, 'tee', x_px, y_px, `Тройник ${id}`, sectionType, size_mm);
    this._lengthHorizontal_mm = 300;   // горизонтальная длина в ММ
    this._branchHeight_mm = 150;       // высота ветки в ММ
  }

  get length_mm() { return this._lengthHorizontal_mm; }
  get branchHeight_mm() { return this._branchHeight_mm; }

  set length_mm(newLength) {
    if (this._lengthHorizontal_mm === newLength) return;
    this._lengthHorizontal_mm = newLength;
    this.updatePorts();
  }

  set branchHeight_mm(newHeight) {
    if (this._branchHeight_mm === newHeight) return;
    this._branchHeight_mm = newHeight;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._lengthHorizontal_mm);
  }

  getHeight() {
    return this.mmToPx(this._size_mm) + this.mmToPx(this._branchHeight_mm);
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'length_mm',
        label: 'Длина горизонтальная',
        type: 'number',
        step: 10,
        min: 50,
        value: this._lengthHorizontal_mm,
        unit: 'мм'
      },
      {
        name: 'branchHeight_mm',
        label: 'Высота ветки',
        type: 'number',
        step: 10,
        min: 20,
        value: this._branchHeight_mm,
        unit: 'мм'
      },
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const branchHeight_px = this.mmToPx(this._branchHeight_mm);

    const inletPos = this.rotatePoint(topLeft.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, height_px / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(topLeft.x + width_px, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width_px, height_px / 2, outletPos.x, outletPos.y
    ));

    const branchPos = this.rotatePoint(centerX, centerY + branchHeight_px, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', width_px / 2, height_px / 2 + branchHeight_px, branchPos.x, branchPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx();
    const branchHeight_px = this.mmToPx(this._branchHeight_mm);
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const leftX = topLeft.x;
    const rightX = topLeft.x + width_px;
    const mainTopY = centerY - size_px / 2;
    const mainBottomY = centerY + size_px / 2;
    const branchLeftX = centerX - size_px / 2;
    const branchRightX = centerX + size_px / 2;

    ctx.moveTo(leftX, mainTopY);
    ctx.lineTo(rightX, mainTopY);
    ctx.lineTo(rightX, mainBottomY);
    ctx.lineTo(branchRightX, mainBottomY);
    ctx.lineTo(branchRightX, centerY + branchHeight_px);
    ctx.lineTo(branchLeftX, centerY + branchHeight_px);
    ctx.lineTo(branchLeftX, mainBottomY);
    ctx.lineTo(leftX, mainBottomY);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const branchHeight_px = this.mmToPx(this._branchHeight_mm);
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + this.getWidth(), centerY);

    const bottomY = centerY + branchHeight_px;
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, bottomY);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);
    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  hitTest(worldX, worldY, ctx) {
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
    return {
      ...super.toJSON(),
      length_mm: this._lengthHorizontal_mm,
      branchHeight_mm: this._branchHeight_mm
    };
  }
}

// ========== КРЕСТОВИНА ==========
export class Cross extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 100) {
    super(id, 'cross', x_px, y_px, `Крестовина ${id}`, sectionType, size_mm);
    this._lengthHorizontal_mm = 300;
    this._lengthVertical_mm = 150;
  }

  get lengthHorizontal_mm() { return this._lengthHorizontal_mm; }
  get lengthVertical_mm() { return this._lengthVertical_mm; }

  set lengthHorizontal_mm(newLength) {
    if (this._lengthHorizontal_mm === newLength) return;
    this._lengthHorizontal_mm = newLength;
    this.updatePorts();
  }

  set lengthVertical_mm(newLength) {
    if (this._lengthVertical_mm === newLength) return;
    this._lengthVertical_mm = newLength;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._lengthHorizontal_mm);
  }

  getHeight() {
    return this.mmToPx(this._size_mm) + this.mmToPx(this._lengthVertical_mm) * 2;
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'lengthHorizontal_mm',
        label: 'Длина горизонтальная',
        type: 'number',
        step: 10,
        min: 50,
        value: this._lengthHorizontal_mm,
        unit: 'мм'
      },
      {
        name: 'lengthVertical_mm',
        label: 'Длина вертикальная',
        type: 'number',
        step: 10,
        min: 20,
        value: this._lengthVertical_mm,
        unit: 'мм'
      },
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const verticalLength_px = this.mmToPx(this._lengthVertical_mm);

    const inletPos = this.rotatePoint(topLeft.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, height_px / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(topLeft.x + width_px, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width_px, height_px / 2, outletPos.x, outletPos.y
    ));

    const branchPos = this.rotatePoint(centerX, centerY + verticalLength_px, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', width_px / 2, height_px / 2 + verticalLength_px, branchPos.x, branchPos.y
    ));

    const topPos = this.rotatePoint(centerX, centerY - verticalLength_px, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'top')?.id || Date.now() + Math.random(),
      this.id, 'top', 'top', width_px / 2, height_px / 2 - verticalLength_px, topPos.x, topPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const size_px = this.getSizePx();
    const verticalLength_px = this.mmToPx(this._lengthVertical_mm);
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const leftX = topLeft.x;
    const rightX = topLeft.x + width_px;
    const mainTopY = centerY - size_px / 2;
    const mainBottomY = centerY + size_px / 2;
    const branchLeftX = centerX - size_px / 2;
    const branchRightX = centerX + size_px / 2;
    const topY = centerY - verticalLength_px;
    const bottomY = centerY + verticalLength_px;

    ctx.moveTo(branchLeftX, topY);
    ctx.lineTo(branchRightX, topY);
    ctx.lineTo(branchRightX, mainTopY);
    ctx.lineTo(rightX, mainTopY);
    ctx.lineTo(rightX, mainBottomY);
    ctx.lineTo(branchRightX, mainBottomY);
    ctx.lineTo(branchRightX, bottomY);
    ctx.lineTo(branchLeftX, bottomY);
    ctx.lineTo(branchLeftX, mainBottomY);
    ctx.lineTo(leftX, mainBottomY);
    ctx.lineTo(leftX, mainTopY);
    ctx.lineTo(branchLeftX, mainTopY);
    ctx.lineTo(branchLeftX, topY);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const verticalLength_px = this.mmToPx(this._lengthVertical_mm);
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + this.getWidth(), centerY);

    const topY = centerY - verticalLength_px;
    const bottomY = centerY + verticalLength_px;
    ctx.moveTo(centerX, topY);
    ctx.lineTo(centerX, bottomY);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);
    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  hitTest(worldX, worldY, ctx) {
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
    return {
      ...super.toJSON(),
      lengthHorizontal_mm: this._lengthHorizontal_mm,
      lengthVertical_mm: this._lengthVertical_mm
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
