import { Port } from './Port.js';
import { Callout } from './Callout.js';

// ========== БАЗОВЫЙ КЛАСС ЭЛЕМЕНТА ==========
class BaseElement {
  constructor(id, type, x, y, name, color) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.name = name;
    this.color = color;
    this.rotation = 0;
    this.ports = [];
    this.callouts = [];
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
    return `${this.name}\n${this.getTypeName()}`;
  }

  getElementText() {
    return '';
  }

  getParameters() {
    return [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      { name: 'x', label: 'X', type: 'number', step: 1, min: 20, value: this.x, unit: 'px' },
      { name: 'y', label: 'Y', type: 'number', step: 1, min: 20, value: this.y, unit: 'px' },
      { name: 'rotation', label: 'Поворот', type: 'number', step: 1, min: 0, value: this.rotation, unit: '°' },
      {
        name: 'color', label: 'Цвет', type: 'select', options: [
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
        ], value: this.color
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
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;
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
      x: this.x + this.getWidth() / 2,
      y: this.y + this.getHeight() / 2
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
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    const rotation = this.rotation || 0;

    if (rotation === 0) {
      return { x: worldX, y: worldY };
    }

    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const angle = -rotation * Math.PI / 180;
    return {
      x: dx * Math.cos(angle) - dy * Math.sin(angle) + centerX,
      y: dx * Math.sin(angle) + dy * Math.cos(angle) + centerY
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
  constructor(id, type, x, y, name, color, sectionType = 'rectangular', size) {
    super(id, type, x, y, name, color);
    this._size = size;
    this._sectionType = sectionType;
    this._originalX = x;
    this._originalY = y;
  }

  get size() {
    return this._size;
  }

  set size(newSize) {
    if (this._size === newSize) return;

    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    this._size = newSize;
    this.x = centerX - this.getWidth() / 2;
    this.y = centerY - this.getHeight() / 2;
    this.updatePorts();
  }

  get sectionType() {
    return this._sectionType;
  }

  set sectionType(newType) {
    if (this._sectionType === newType) return;
    this._sectionType = newType;
    this.updateCalloutText();
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
      { name: 'size', label: this._sectionType === 'round' ? 'Диаметр' : 'Ширина', type: 'number', step: 1, min: 20, value: this.size, unit: 'мм' },
    ];
  }

  fromJSON(jsonData) {
    this._size = jsonData.size;
    if (jsonData.sectionType !== undefined) this._sectionType = jsonData.sectionType;
    if (jsonData.length !== undefined) this._length = jsonData.length;
    if (jsonData.radius !== undefined) this._radius = jsonData.radius;
    if (jsonData.branchHeight !== undefined) this._branchHeight = jsonData.branchHeight;
    if (jsonData.centerY !== undefined) this._centerY = jsonData.centerY;
  }

  createLinearPorts(width, height, offsetX = 0, offsetY = 0) {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    const inletPos = this.rotatePoint(this.x + offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', offsetX, height / 2 + offsetY, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + width - offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width - offsetX, height / 2 + offsetY, outletPos.x, outletPos.y
    ));

    return ports;
  }

  drawRectangular(ctx, width, height, isSelected, scale, showColors) {
    const rotation = this.rotation || 0;
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    ctx.beginPath();

    ctx.rect(this.x, this.y, width, height);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

    ctx.restore();
  }

  hitTestRectangular(worldX, worldY, width, height) {
    const local = this.transformToLocalCoords(worldX, worldY);
    return local.x >= this.x && local.x <= this.x + width &&
      local.y >= this.y && local.y <= this.y + height;
  }

  toJSON() {
    return { ...super.toJSON(), size: this._size, sectionType: this._sectionType };
  }
}

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x, y, length = 1250, sectionType = 'rectangular', size = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3', sectionType, size);
    this._length = length;
  }

  get length() { return this._length; }
  set length(value) {
    if (this._length === value) return;
    const centerX = this.x + this._length / 2;
    this._length = value;
    this.x = centerX - this._length / 2;
    this.updatePorts();
  }

  getWidth() { return this._length; }
  getHeight() { return this._size; }

  getCalloutText() {
    const area = (this._length * this._size / 1000000).toFixed(2);
    return `${this.name}\nДлина: ${this._length} мм\nШирина: ${this._size} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'length', label: 'Длина', type: 'number', step: 1, min: 100, value: this._length, unit: 'мм' },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this._length, this._size);
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    this.drawRectangular(ctx, this._length, this._size, isSelected, scale, showColors);
  }

  hitTest(worldX, worldY, ctx) {
    return this.hitTestRectangular(worldX, worldY, this._length, this._size);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      length: this._length
    };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0', sectionType, size);
    this._length = 300;
    this._branchHeight = 150;
    this._centerY = 100;
  }

  get length() { return this._length; }
  get branchHeight() { return this._branchHeight; }
  get centerY() { return this._centerY; }

  set length(newLength) {
    if (this._length === newLength) return;
    const oldCenterX = this.x + this._length / 2;
    this._length = newLength;
    this.x = oldCenterX - this._length / 2;
    this.updatePorts();
  }

  set branchHeight(newHeight) {
    if (this._branchHeight === newHeight) return;
    const bottomY = this.y + this._centerY + this._branchHeight;
    this._branchHeight = newHeight;
    this.y = bottomY - this._centerY - this._branchHeight;
    this.updatePorts();
  }

  set centerY(newCenterY) {
    if (this._centerY === newCenterY) return;
    const centerYPos = this.y + this._centerY;
    this._centerY = newCenterY;
    this.y = centerYPos - this._centerY;
    this.updatePorts();
  }

  getWidth() { return this._length; }
  getHeight() { return this._centerY + this._size / 2 + this._branchHeight; }

  getCalloutText() {
    const area = (this._length * this._size / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._size} мм\nДлина: ${this._length} мм\nТип: тройник\nСечение: ${area} м²`;
  }

  getRelativeCalloutEntryPoint() {
    return { x: this._length / 2, y: this._centerY };
  }

  getRotationCenter() {
    return { x: this.x + this._length / 2, y: this.y + this._centerY };
  }

  getAbsoluteCalloutPoint() {
    const relativePoint = this.getRelativeCalloutEntryPoint();
    const rotationCenterX = this.x + this._length / 2;
    const rotationCenterY = this.y + this._centerY;
    const absoluteX = this.x + relativePoint.x;
    const absoluteY = this.y + relativePoint.y;
    const dx = absoluteX - rotationCenterX;
    const dy = absoluteY - rotationCenterY;
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
    return {
      x: rotationCenterX + rotatedX,
      y: rotationCenterY + rotatedY
    };
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;

    // Inlet порт (слева)
    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._centerY, inletPos.x, inletPos.y
    ));

    // Outlet порт (справа)
    const outletPos = this.rotatePoint(this.x + this._length, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._length, this._centerY, outletPos.x, outletPos.y
    ));

    // Branch порт (снизу)
    const branchBottomY = centerY + this._branchHeight;
    const branchCenterX = this.x + this._length / 2;
    const branchPos = this.rotatePoint(branchCenterX, branchBottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this._length / 2, this._centerY + this._branchHeight, branchPos.x, branchPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;
    const halfSize = this._size / 2;
    const branchBottomY = centerY + this._branchHeight;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    const leftX = this.x;
    const rightX = this.x + this._length;
    const topY = centerY - halfSize;
    const bottomY = centerY + halfSize;
    const branchLeftX = centerX - halfSize;
    const branchRightX = centerX + halfSize;

    ctx.moveTo(leftX, topY);
    ctx.lineTo(rightX, topY);
    ctx.lineTo(rightX, bottomY);
    ctx.lineTo(branchRightX, bottomY);
    ctx.lineTo(branchRightX, branchBottomY);
    ctx.lineTo(branchLeftX, branchBottomY);
    ctx.lineTo(branchLeftX, bottomY);
    ctx.lineTo(leftX, bottomY);
    ctx.closePath();

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

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
      length: this._length,
      branchHeight: this._branchHeight,
      centerY: this._centerY
    };
  }
}

// ========== КРЕСТОВИНА ==========
export class Cross extends DuctBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'cross', x, y, `Крестовина ${id}`, '#e91e63', sectionType, size);
    this._length = 300;
    this._branchHeight = 150;
    this._centerY = 50;
  }

  get length() { return this._length; }
  get branchHeight() { return this._branchHeight; }
  get centerY() { return this._centerY; }

  set length(newLength) {
    if (this._length === newLength) return;
    const oldCenterX = this.x + this._length / 2;
    this._length = newLength;
    this.x = oldCenterX - this._length / 2;
    this.updatePorts();
  }

  set branchHeight(newHeight) {
    if (this._branchHeight === newHeight) return;
    const bottomY = this.y + this._centerY + this._branchHeight;
    this._branchHeight = newHeight;
    this.y = bottomY - this._centerY - this._branchHeight;
    this.updatePorts();
  }

  set centerY(newCenterY) {
    if (this._centerY === newCenterY) return;
    const centerYPos = this.y + this._centerY;
    this._centerY = newCenterY;
    this.y = centerYPos - this._centerY;
    this.updatePorts();
  }

  getWidth() { return this._length; }
  getHeight() { return this._centerY + this._size / 2 + this._branchHeight; }

  getCalloutText() {
    const area = (this._length * this._size / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._size} мм\nДлина: ${this._length} мм\nТип: крестовина\nСечение: ${area} м²`;
  }

  getRelativeCalloutEntryPoint() {
    return { x: this._length / 2, y: this._centerY };
  }

  getRotationCenter() {
    return { x: this.x + this._length / 2, y: this.y + this._centerY };
  }

  getAbsoluteCalloutPoint() {
    const relativePoint = this.getRelativeCalloutEntryPoint();
    const rotationCenterX = this.x + this._length / 2;
    const rotationCenterY = this.y + this._centerY;
    const absoluteX = this.x + relativePoint.x;
    const absoluteY = this.y + relativePoint.y;
    const dx = absoluteX - rotationCenterX;
    const dy = absoluteY - rotationCenterY;
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
    return {
      x: rotationCenterX + rotatedX,
      y: rotationCenterY + rotatedY
    };
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;
    const halfSize = this._size / 2;
    const branchBottomY = centerY + this._branchHeight;
    const branchTopY = centerY - this._branchHeight;

    // Inlet порт (слева)
    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._centerY, inletPos.x, inletPos.y
    ));

    // Outlet порт (справа)
    const outletPos = this.rotatePoint(this.x + this._length, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._length, this._centerY, outletPos.x, outletPos.y
    ));

    // Branch порт (снизу)
    const branchPos = this.rotatePoint(centerX, branchBottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this._length / 2, this._centerY + this._branchHeight, branchPos.x, branchPos.y
    ));

    // Верхний порт
    const topPos = this.rotatePoint(centerX, branchTopY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'top')?.id || Date.now() + Math.random(),
      this.id, 'top', 'top', this._length / 2, this._centerY - this._branchHeight, topPos.x, topPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;
    const halfSize = this._size / 2;
    const branchBottomY = centerY + this._branchHeight;
    const branchTopY = centerY - this._branchHeight;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    const leftX = this.x;
    const rightX = this.x + this._length;
    const topY = centerY - halfSize;
    const bottomY = centerY + halfSize;
    const branchLeftX = centerX - halfSize;
    const branchRightX = centerX + halfSize;

    // Начинаем с верхнего отростка
    ctx.moveTo(branchLeftX, branchTopY);
    ctx.lineTo(branchRightX, branchTopY);
    ctx.lineTo(branchRightX, topY);
    ctx.lineTo(rightX, topY);
    ctx.lineTo(rightX, bottomY);
    ctx.lineTo(branchRightX, bottomY);
    ctx.lineTo(branchRightX, branchBottomY);
    ctx.lineTo(branchLeftX, branchBottomY);
    ctx.lineTo(branchLeftX, bottomY);
    ctx.lineTo(leftX, bottomY);
    ctx.lineTo(leftX, topY);
    ctx.lineTo(branchLeftX, topY);
    ctx.lineTo(branchLeftX, branchTopY);
    ctx.closePath();

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

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
      length: this._length,
      branchHeight: this._branchHeight,
      centerY: this._centerY
    };
  }
}

// ========== ОТВОД ==========
export class Elbow extends DuctBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'elbow', x, y, `Отвод ${id}`, '#00ff00', sectionType, size);
    this._radius = 100;
  }

  get radius() {
    return this._radius;
  }

  set radius(newRadius) {
    if (this._radius === newRadius) return;

    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    this._radius = newRadius;
    this.x = centerX - this.getWidth() / 2;
    this.y = centerY - this.getHeight() / 2;
    this.updatePorts();
  }

  getWidth() {
    return (this._radius || 50) + (this._size || 50);
  }

  getHeight() {
    return (this._radius || 50) + (this._size || 50);
  }

  getCalloutText() {
    return `${this.name}\nДиаметр: ${this._size} мм\nРадиус изгиба: ${this._radius} мм\nУгол: 90°`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'radius', label: 'Радиус изгиба', type: 'number', step: 5, min: 30, value: this._radius, unit: 'мм' }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;
    const centerRadius = this._radius + this._size / 2;

    // Inlet порт (слева)
    const inletX = this.x;
    const inletY = this.y + height - centerRadius;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, height - centerRadius, inletPos.x, inletPos.y
    ));

    // Outlet порт (снизу)
    const outletX = this.x + centerRadius;
    const outletY = this.y + height;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius, height, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const width = this.getWidth();
    const height = this.getHeight();
    const elemCenterX = this.x + width / 2;
    const elemCenterY = this.y + height / 2;
    const bendCenterX = this.x;
    const bendCenterY = this.y + height;
    const outerRadius = this._radius + this._size;
    const innerRadius = this._radius;

    ctx.save();
    ctx.translate(elemCenterX, elemCenterY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-elemCenterX, -elemCenterY);

    ctx.beginPath();

    // Внешняя дуга от 270° до 360°
    ctx.arc(bendCenterX, bendCenterY, outerRadius, Math.PI * 1.5, Math.PI * 2);

    // Прямая линия от конца внешней дуги к началу внутренней
    ctx.lineTo(
      bendCenterX + innerRadius * Math.cos(Math.PI * 2),
      bendCenterY + innerRadius * Math.sin(Math.PI * 2)
    );

    // Внутренняя дуга от 360° до 270° (против часовой стрелки)
    ctx.arc(bendCenterX, bendCenterY, innerRadius, Math.PI * 2, Math.PI * 1.5, true);

    ctx.closePath();

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    this.createPath(ctx);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

  }

  hitTest(worldX, worldY, ctx) {
    // Проверяем валидность размеров
    if (!this._size || !this._radius || this._size <= 0 || this._radius <= 0) {
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
      radius: this._radius
    };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends BaseElement {
  constructor(id, x, y, size = 100) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800', size);
    this._size = size;
    this.flow = 1000;
    this.pressure = 500;
  }

  get size() { return this._size; }
  set size(value) {
    if (this._size === value) return;
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    this._size = value;
    this.x = centerX - this.getWidth() / 2;
    this.y = centerY - this.getHeight() / 2;
    this.updatePorts();
  }

  getWidth() { return this._size; }
  getHeight() { return this._size; }

  getCalloutText() {
    return `${this.name}\nРазмер: ${this._size}×${this._size} мм\nПроизводительность: ${this.flow} м³/ч\nНапор: ${this.pressure} Па`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'size', label: 'Размер', type: 'number', step: 10, min: 50, value: this._size, unit: 'мм' },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' },
      { name: 'pressure', label: 'Напор', type: 'number', step: 1, value: this.pressure, unit: 'Па' }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this._size / 2;
    const centerY = this.y + this._size / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._size / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this._size, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._size, this._size / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createRectPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._size / 2;
    const centerY = this.y + this._size / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    ctx.beginPath();
    ctx.rect(this.x, this.y, this._size, this._size);
    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._size / 2;
    const centerY = this.y + this._size / 2;
    const radius = this._size * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Корпус
    ctx.beginPath();
    ctx.rect(this.x, this.y, this._size, this._size);
    if (showColors) {
      this.setFillStyle(ctx, isSelected, false);
    }
    this.setStrokeStyle(ctx, scale, isSelected, false);

    // Круг
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#666';
    ctx.stroke();

    // Стрелка
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
  }

  hitTest(worldX, worldY, ctx) {
    if (ctx) {
      this.createRectPath(ctx);
      return ctx.isPointInPath(worldX, worldY);
    }
    const local = this.transformToLocalCoords(worldX, worldY);
    return local.x >= this.x && local.x <= this.x + this._size &&
      local.y >= this.y && local.y <= this.y + this._size;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      size: this._size,
      flow: this.flow,
      pressure: this.pressure
    };
  }
}

// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    const name = params.name || `Элемент ${id}`;
    const sectionType = params.sectionType || 'rectangular';
    const size = params.size || 50;

    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x, y, params.length || 1250, sectionType, size);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        return duct;
      case 'tee':
        const tee = new Tee(id, x, y, sectionType, size);
        if (params.length !== undefined) tee._length = params.length;
        if (params.branchHeight !== undefined) tee._branchHeight = params.branchHeight;
        if (params.centerY !== undefined) tee._centerY = params.centerY;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        return tee;
      case 'cross':
        const cross = new Cross(id, x, y, sectionType, size);
        if (params.length !== undefined) cross._length = params.length;
        if (params.branchHeight !== undefined) cross._branchHeight = params.branchHeight;
        if (params.centerY !== undefined) cross._centerY = params.centerY;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        return cross;
      case 'elbow':
        const elbow = new Elbow(id, x, y, sectionType, size);
        if (params.radius !== undefined) elbow._radius = params.radius;
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        return elbow;
      case 'fan':
        const fan = new Fan(id, x, y, size);
        if (params.flow !== undefined) fan.flow = params.flow;
        if (params.pressure !== undefined) fan.pressure = params.pressure;
        if (params.rotation !== undefined) fan.rotation = params.rotation;
        if (params.name) fan.name = params.name;
        return fan;
      case 'group':
        const elements = (params.elements || []).map(elJson => this.createFromJSON(elJson));
        const group = new Group(params.id || Date.now() + Math.random(), elements);
        group.name = params.name || group.name;
        group.color = params.color || group.color;
        group.rotation = params.rotation || 0;
        group._x = params._x || 0;
        group._y = params._y || 0;
        group.width = params.width || 0;
        group.height = params.height || 0;
        // Восстанавливаем выноски группы
        group.callouts = (params.callouts || []).map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
        return group;
      default:
        throw new Error(`Unknown element type: ${type}`);
    }
  }

  static createFromJSON(jsonData) {
    // Создаем элемент с базовыми параметрами
    let element = this.createElement(
      jsonData.type,
      jsonData.id,
      jsonData.x,
      jsonData.y,
      {
        sectionType: jsonData.sectionType,
        size: jsonData.size,
        length: jsonData.length,
        branchHeight: jsonData.branchHeight,
        centerY: jsonData.centerY,
        radius: jsonData.radius,
        flow: jsonData.flow,
        pressure: jsonData.pressure,
        rotation: jsonData.rotation,
        elements: jsonData.elements,
        name: jsonData.name,
        color: jsonData.color,
        _x: jsonData._x,
        _y: jsonData._y,
        width: jsonData.width,
        height: jsonData.height,
        callouts: jsonData.callouts
      }
    );

    // Восстанавливаем порты
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

    // Восстанавливаем выноски для НЕ-групп (для групп уже восстановили выше)
    if (jsonData.callouts && element.type !== 'group') {
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
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
    this._x = 0;
    this._y = 0;
    this.width = 0;
    this.height = 0;
    this.updateBounds();
  }

  updateBounds() {
    if (!this.elements || this.elements.length === 0) {
      this._x = 0;
      this._y = 0;
      this.width = 0;
      this.height = 0;
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    this.elements.forEach(element => {
      if (!element) return;
      const elementMinX = element.x;
      const elementMinY = element.y;
      const elementMaxX = element.x + element.getWidth();
      const elementMaxY = element.y + element.getHeight();

      minX = Math.min(minX, elementMinX);
      minY = Math.min(minY, elementMinY);
      maxX = Math.max(maxX, elementMaxX);
      maxY = Math.max(maxY, elementMaxY);
    });

    this._x = minX;
    this._y = minY;
    this.width = maxX - minX;
    this.height = maxY - minY;
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

  get x() {
    return this._x;
  }

  set x(value) {
    const deltaX = value - this._x;
    if (deltaX !== 0 && !isNaN(deltaX) && isFinite(deltaX)) {
      this.move(deltaX, 0);
    }
  }

  get y() {
    return this._y;
  }

  set y(value) {
    const deltaY = value - this._y;
    if (deltaY !== 0 && !isNaN(deltaY) && isFinite(deltaY)) {
      this.move(0, deltaY);
    }
  }

  getCalloutText() {
    return `${this.name}\nКоличество элементов: ${this.elements ? this.elements.length : 0}`;
  }

  getParameters() {
    return [{ name: 'name', label: 'Имя', type: 'text', value: this.name },];
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
    ctx.strokeRect(this._x, this._y, this.width, this.height);
    ctx.setLineDash([]);
    ctx.fillStyle = isDarkTheme ? '#444444' : '#000';
    ctx.font = `26px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText(this.name, this._x + 10, this._y + 16 / scale);
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
      height: this.height,
      _x: this._x,
      _y: this._y
    };
  }
}
