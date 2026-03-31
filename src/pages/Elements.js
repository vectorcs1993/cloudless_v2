import { Port } from './Port.js';
import { Callout } from './Callout.js';

// ========== ГЛОБАЛЬНЫЙ МАСШТАБ ==========
let globalMmPerPx = 1.0;

export function setGlobalMmPerPx(value) {
  globalMmPerPx = value;
}

export function getGlobalMmPerPx() {
  return globalMmPerPx;
}

// ========== БАЗОВЫЙ КЛАСС ЭЛЕМЕНТА ==========
class BaseElement {
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
    return globalMmPerPx;
  }

  // Конвертация мм в px
  mmToPx(mm) {
    return mm / globalMmPerPx;
  }

  // Конвертация px в мм
  pxToMm(px) {
    return px * globalMmPerPx;
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
      'elbowCircular': 'Отвод',
      'elbowRectangular': 'Отвод секционный',
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
class DuctBase extends BaseElement {
  constructor(id, type, x, y, name, sectionType = 'rectangular', size_mm) {
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

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'rectangular', size_mm = 125, length = 750) {
    super(id, 'duct', x_px, y_px, `Воздуховод ${id}`, sectionType, size_mm);
    this._lengthHorizontal_mm = length;
  }

  get length_mm() { return this._lengthHorizontal_mm; }

  set length_mm(value) {
    if (this._lengthHorizontal_mm === value) return;
    const centerX = this.x;
    this._lengthHorizontal_mm = value;
    // Центр остается на месте
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._lengthHorizontal_mm);
  }

  getHeight() {
    return this.mmToPx(this._size_mm);
  }

  getCalloutText() {
    const length_m = this._lengthHorizontal_mm / 1000;
    const size_m = this._size_mm / 1000;
    const area = (length_m * size_m).toFixed(2);
    return `${super.getCalloutText()}\nДлина: ${this._lengthHorizontal_mm} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'length_mm',
        label: 'Длина',
        type: 'number',
        step: 10,
        min: 100,
        value: this._lengthHorizontal_mm,
        unit: 'мм'
      },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this.getWidth(), this.getHeight());
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
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
    ctx.moveTo(topLeft.x - 20, centerY);
    ctx.lineTo(topLeft.x + width + 20, centerY);

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
      length_mm: this._lengthHorizontal_mm
    };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x_px, y_px, sectionType = 'rectangular', size_mm = 100) {
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
    ctx.moveTo(topLeft.x - 20, centerY);
    ctx.lineTo(topLeft.x + this.getWidth() + 20, centerY);

    const bottomY = centerY + branchHeight_px + 20;
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
  constructor(id, x_px, y_px, sectionType = 'rectangular', size_mm = 100) {
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
    ctx.moveTo(topLeft.x - 20, centerY);
    ctx.lineTo(topLeft.x + this.getWidth() + 20, centerY);

    const topY = centerY - verticalLength_px - 20;
    const bottomY = centerY + verticalLength_px + 20;
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

// ========== ОТВОД АБСТРАКТНЫЙ ==========
class ElbowBase extends DuctBase {
  constructor(id, type, x_px, y_px, name, sectionType = 'rectangular', size_mm) {
    super(id, type, x_px, y_px, name, sectionType, size_mm);
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
}

// ========== ОТВОД (СКРУГЛЕННЫЙ) ==========
export class ElbowCircular extends ElbowBase {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 100) {
    super(id, 'elbowCircular', x_px, y_px, `Отвод ${id}`, sectionType, size_mm);
    this._radius_mm = 100;
  }

  get radius_mm() { return this._radius_mm; }

  set radius_mm(newRadius) {
    if (this._radius_mm === newRadius) return;
    this._radius_mm = newRadius;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._radius_mm) + this.getSizePx();
  }

  getHeight() {
    return this.mmToPx(this._radius_mm) + this.getSizePx();
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  getCalloutText() {
    return `${super.getCalloutText()}\n${this._sectionType === 'round' ? 'Диаметр' : 'Ширина'}: ${this._size_mm} мм\nРадиус изгиба: ${this._radius_mm} мм\nУгол: 90°`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'radius_mm',
        label: 'Радиус изгиба',
        type: 'number',
        step: 5,
        min: 30,
        value: this._radius_mm,
        unit: 'мм'
      }
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
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const centerRadius_px = radius_px + size_px / 2;

    const inletX = topLeft.x;
    const inletY = topLeft.y + height_px - centerRadius_px;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, height_px - centerRadius_px, inletPos.x, inletPos.y
    ));

    const outletX = topLeft.x + centerRadius_px;
    const outletY = topLeft.y + height_px;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius_px, height_px, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const outerRadius_px = radius_px + size_px;
    const innerRadius_px = radius_px;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, outerRadius_px, Math.PI * 1.5, Math.PI * 2);
    ctx.lineTo(
      bendCenterX + innerRadius_px * Math.cos(Math.PI * 2),
      bendCenterY + innerRadius_px * Math.sin(Math.PI * 2)
    );
    ctx.arc(bendCenterX, bendCenterY, innerRadius_px, Math.PI * 2, Math.PI * 1.5, true);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const topLeft = this.getTopLeft();
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const centerRadius_px = radius_px + size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, centerRadius_px, Math.PI * 1.5, Math.PI * 2);

    const startX = bendCenterX;
    const startY = bendCenterY - centerRadius_px;
    ctx.moveTo(startX, startY);
    ctx.lineTo(topLeft.x - 20, startY);

    const endX = bendCenterX + centerRadius_px;
    const endY = bendCenterY;
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX, topLeft.y + this.getHeight() + 20);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._size_mm || !this._radius_mm || this._size_mm <= 0 || this._radius_mm <= 0) {
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
    return {
      ...super.toJSON(),
      radius_mm: this._radius_mm
    };
  }
}

// ========== ОТВОД СЕКЦИОННЫЙ ==========
export class ElbowRectangular extends ElbowBase {
  constructor(id, x_px, y_px, sectionType = 'rectangular', size_mm = 100) {
    super(id, 'elbowRectangular', x_px, y_px, `Отвод секционный ${id}`, sectionType, size_mm);
    this._horizontalLength_mm = 100;   // горизонтальная часть до изгиба в ММ
    this._verticalLength_mm = 100;     // вертикальная часть после изгиба в ММ
  }

  get horizontalLength_mm() { return this._horizontalLength_mm; }
  get verticalLength_mm() { return this._verticalLength_mm; }

  set horizontalLength_mm(newLength) {
    if (this._horizontalLength_mm === newLength) return;
    this._horizontalLength_mm = newLength;
    this.updatePorts();
  }

  set verticalLength_mm(newLength) {
    if (this._verticalLength_mm === newLength) return;
    this._verticalLength_mm = newLength;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._horizontalLength_mm) + this.getSizePx();
  }

  getHeight() {
    return this.mmToPx(this._verticalLength_mm) + this.getSizePx();
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
        name: 'horizontalLength_mm',
        label: 'Горизонтальная часть',
        type: 'number',
        step: 10,
        min: 20,
        value: this._horizontalLength_mm,
        unit: 'мм'
      },
      {
        name: 'verticalLength_mm',
        label: 'Вертикальная часть',
        type: 'number',
        step: 10,
        min: 20,
        value: this._verticalLength_mm,
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
    const size_px = this.getSizePx();
    const horizLen_px = this.mmToPx(this._horizontalLength_mm);
    const vertLen_px = this.mmToPx(this._verticalLength_mm);

    const inletX = topLeft.x;
    const inletY = topLeft.y + vertLen_px - size_px / 2;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left',
      0, vertLen_px - size_px / 2,
      inletPos.x, inletPos.y
    ));

    const outletX = topLeft.x + horizLen_px + size_px / 2;
    const outletY = topLeft.y + height_px;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom',
      horizLen_px + size_px / 2, height_px,
      outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    const size_px = this.getSizePx();
    const horizLen_px = this.mmToPx(this._horizontalLength_mm);
    const vertLen_px = this.mmToPx(this._verticalLength_mm);
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation + 180) * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    ctx.beginPath();

    ctx.moveTo(topLeft.x, topLeft.y + vertLen_px);
    ctx.lineTo(topLeft.x, topLeft.y);
    ctx.lineTo(topLeft.x + horizLen_px, topLeft.y);
    ctx.lineTo(topLeft.x + horizLen_px, topLeft.y + vertLen_px);
    ctx.lineTo(topLeft.x + horizLen_px + size_px, topLeft.y + vertLen_px);
    ctx.lineTo(topLeft.x + horizLen_px + size_px, topLeft.y + height_px);
    ctx.lineTo(topLeft.x, topLeft.y + height_px);
    ctx.closePath();

    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._size_mm || !this._horizontalLength_mm || !this._verticalLength_mm ||
      this._size_mm <= 0 || this._horizontalLength_mm <= 0 || this._verticalLength_mm <= 0) {
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

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const size_px = this.getSizePx();
    const horizLen_px = this.mmToPx(this._horizontalLength_mm);
    const vertLen_px = this.mmToPx(this._verticalLength_mm);
    const topLeft = this.getTopLeft();
    const cornerX = topLeft.x + horizLen_px;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);

    const horizontalCenterY = topLeft.y + vertLen_px - size_px / 2;
    ctx.moveTo(topLeft.x - 20, horizontalCenterY);
    ctx.lineTo(cornerX + size_px + 20, horizontalCenterY);
    ctx.stroke();

    const verticalCenterX = topLeft.x + horizLen_px + size_px / 2;
    ctx.moveTo(verticalCenterX, topLeft.y + vertLen_px - size_px - 20);
    ctx.lineTo(verticalCenterX, topLeft.y + this.getHeight() + 20);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      horizontalLength_mm: this._horizontalLength_mm,
      verticalLength_mm: this._verticalLength_mm,
    };
  }
}

// ========== ОТВОД (УНИВЕРСАЛЬНЫЙ) ==========
export class ElbowUniverse extends ElbowBase {
  constructor(id, x_px, y_px, sectionType = 'round', size_mm = 100) {
    super(id, 'elbowCircular', x_px, y_px, `Отвод ${id}`, sectionType, size_mm);
    this._radius_mm = 100;
  }

  get radius_mm() { return this._radius_mm; }

  set radius_mm(newRadius) {
    if (this._radius_mm === newRadius) return;
    this._radius_mm = newRadius;
    this.updatePorts();
  }

  getWidth() {
    return this.mmToPx(this._radius_mm) + this.getSizePx();
  }

  getHeight() {
    return this.mmToPx(this._radius_mm) + this.getSizePx();
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  getCalloutText() {
    return `${super.getCalloutText()}\n${this._sectionType === 'round' ? 'Диаметр' : 'Ширина'}: ${this._size_mm} мм\nРадиус изгиба: ${this._radius_mm} мм\nУгол: 90°`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'radius_mm',
        label: 'Радиус изгиба',
        type: 'number',
        step: 5,
        min: 30,
        value: this._radius_mm,
        unit: 'мм'
      }
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
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const centerRadius_px = radius_px + size_px / 2;

    const inletX = topLeft.x;
    const inletY = topLeft.y + height_px - centerRadius_px;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, height_px - centerRadius_px, inletPos.x, inletPos.y
    ));

    const outletX = topLeft.x + centerRadius_px;
    const outletY = topLeft.y + height_px;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius_px, height_px, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const topLeft = this.getTopLeft();
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const outerRadius_px = radius_px + size_px;
    const innerRadius_px = radius_px;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, outerRadius_px, Math.PI * 1.5, Math.PI * 2);
    ctx.lineTo(
      bendCenterX + innerRadius_px * Math.cos(Math.PI * 2),
      bendCenterY + innerRadius_px * Math.sin(Math.PI * 2)
    );
    ctx.arc(bendCenterX, bendCenterY, innerRadius_px, Math.PI * 2, Math.PI * 1.5, true);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const size_px = this.getSizePx();
    const radius_px = this.mmToPx(this._radius_mm);
    const topLeft = this.getTopLeft();
    const bendCenterX = topLeft.x;
    const bendCenterY = topLeft.y + this.getHeight();
    const centerRadius_px = radius_px + size_px / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, centerRadius_px, Math.PI * 1.5, Math.PI * 2);

    const startX = bendCenterX;
    const startY = bendCenterY - centerRadius_px;
    ctx.moveTo(startX, startY);
    ctx.lineTo(topLeft.x - 20, startY);

    const endX = bendCenterX + centerRadius_px;
    const endY = bendCenterY;
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX, topLeft.y + this.getHeight() + 20);

    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._size_mm || !this._radius_mm || this._size_mm <= 0 || this._radius_mm <= 0) {
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
    return {
      ...super.toJSON(),
      radius_mm: this._radius_mm
    };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'rectangular', size_mm = 440, length = 550) {
    super(id, x_px, y_px, sectionType, size_mm, length);
    this.type = 'fan';
    this.name = `Вентилятор ${id}`;
    this.flow = 1000;
    this.pressure = 500;
  }

  getCalloutText() {
    return `${super.getCalloutText()}\nПроизводительность: ${this.flow} м³/ч\nНапор: ${this.pressure} Па`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' },
      { name: 'pressure', label: 'Напор', type: 'number', step: 1, value: this.pressure, unit: 'Па' }
    ];
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    const width_px = this.getWidth();
    const height_px = this.getHeight();
    this.drawRectangular(ctx, width_px, height_px, isSelected, scale, showColors);

    const rotation = this.rotation || 0;
    const centerX = this.x;
    const centerY = this.y;
    const radius = height_px * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = Math.max(1, 1.5 / scale);
    ctx.stroke();

    const triangleSize = radius * 0.7;
    const direction = this.flow > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(centerX + triangleSize * direction, centerY);
    ctx.lineTo(centerX - triangleSize * 0.8 * direction, centerY - triangleSize * 0.8);
    ctx.lineTo(centerX - triangleSize * 0.8 * direction, centerY + triangleSize * 0.8);
    ctx.closePath();
    ctx.strokeStyle = '#666';
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: 'fan',
      flow: this.flow,
      pressure: this.pressure,
      length_mm: this._lengthHorizontal_mm
    };
  }
}

// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x_px, y_px, params = {}) {
    const sectionType = params.sectionType || 'rectangular';
    const size_mm = params.size_mm || 50;

    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x_px, y_px, sectionType, size_mm, params.length_mm);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        if (params.color) duct.color = params.color;
        return duct;
      case 'tee':
        const tee = new Tee(id, x_px, y_px, sectionType, size_mm);
        if (params.length_mm !== undefined) tee._lengthHorizontal_mm = params.length_mm;
        if (params.branchHeight_mm !== undefined) tee._branchHeight_mm = params.branchHeight_mm;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        if (params.color) tee.color = params.color;
        return tee;
      case 'cross':
        const cross = new Cross(id, x_px, y_px, sectionType, size_mm);
        if (params.lengthHorizontal_mm !== undefined) cross._lengthHorizontal_mm = params.lengthHorizontal_mm;
        if (params.lengthVertical_mm !== undefined) cross._lengthVertical_mm = params.lengthVertical_mm;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        if (params.color) cross.color = params.color;
        return cross;
      case 'elbowCircular':
        const elbow = new ElbowCircular(id, x_px, y_px, sectionType, size_mm);
        if (params.radius_mm !== undefined) elbow._radius_mm = params.radius_mm;
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        if (params.color) elbow.color = params.color;
        return elbow;
      case 'elbowRectangular':
        const elbowRect = new ElbowRectangular(id, x_px, y_px, sectionType, size_mm);
        if (params.horizontalLength_mm !== undefined) elbowRect._horizontalLength_mm = params.horizontalLength_mm;
        if (params.verticalLength_mm !== undefined) elbowRect._verticalLength_mm = params.verticalLength_mm;
        if (params.rotation !== undefined) elbowRect.rotation = params.rotation;
        if (params.name) elbowRect.name = params.name;
        if (params.color) elbowRect.color = params.color;
        return elbowRect;
      case 'fan':
        const fan = new Fan(id, x_px, y_px, sectionType, size_mm);
        if (params.length_mm !== undefined) fan._lengthHorizontal_mm = params.length_mm;
        if (params.flow !== undefined) fan.flow = params.flow;
        if (params.pressure !== undefined) fan.pressure = params.pressure;
        if (params.rotation !== undefined) fan.rotation = params.rotation;
        if (params.name) fan.name = params.name;
        if (params.color) fan.color = params.color;
        return fan;
      case 'group':
        const elements = (params.elements || []).map(elJson => this.createFromJSON(elJson));
        const group = new Group(params.id || Date.now() + Math.random(), elements);
        group.name = params.name || group.name;
        group.color = params.color || group.color;
        group.rotation = params.rotation || 0;
        group.x = params.x || 0;
        group.y = params.y || 0;
        group.callouts = (params.callouts || []).map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
        return group;
      default:
        throw new Error(`Unknown element type: ${type}`);
    }
  }

  static createFromJSON(jsonData) {
    let element = this.createElement(
      jsonData.type,
      jsonData.id,
      jsonData.x,
      jsonData.y,
      {
        sectionType: jsonData.sectionType,
        size_mm: jsonData.size_mm !== undefined ? jsonData.size_mm : jsonData.size,
        length_mm: jsonData.length_mm !== undefined ? jsonData.length_mm : jsonData.length,
        branchHeight_mm: jsonData.branchHeight_mm,
        lengthHorizontal_mm: jsonData.lengthHorizontal_mm,
        lengthVertical_mm: jsonData.lengthVertical_mm,
        radius_mm: jsonData.radius_mm !== undefined ? jsonData.radius_mm : jsonData.radius,
        horizontalLength_mm: jsonData.horizontalLength_mm,
        verticalLength_mm: jsonData.verticalLength_mm,
        flow: jsonData.flow,
        pressure: jsonData.pressure,
        rotation: jsonData.rotation,
        elements: jsonData.elements,
        name: jsonData.name,
        color: jsonData.color,
        callouts: jsonData.callouts
      }
    );

    if (jsonData.ports) {
      element.ports = jsonData.ports.map(p => new Port(
        p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
      ));

      element.ports.forEach(port => {
        const foundPort = jsonData.ports.find(op => op.id === port.id);
        if (foundPort) {
          port.connectedElementId = foundPort.connectedElementId || null;
          port.connectedPortId = foundPort.connectedPortId || null;
        }
      });
    }

    if (jsonData.callouts && jsonData.callouts.length > 0 && element.type !== 'group') {
      element.callouts = [];
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
    } else if (element.type !== 'group') {
      element.callouts = [];
    }

    return element;
  }
}

// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements) {
    const groupId = (typeof id === 'number' && id !== undefined) ? id : Date.now() + Math.random();
    super(groupId, 'group', 0, 0, `Группа ${groupId}`, '#9e9e9e');
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
