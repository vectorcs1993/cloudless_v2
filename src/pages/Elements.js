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
      'elbowCircular': 'Отвод',
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

    // Перемещаем в систему координат центра элемента
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    // Поворачиваем обратно (отрицательный угол)
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
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;
    const rotation = this.rotation || 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    // Горизонтальная осевая линия
    ctx.moveTo(this.x, centerY);
    ctx.lineTo(this.x + width, centerY);
    // Вертикальная осевая линия
    ctx.moveTo(centerX, this.y);
    ctx.lineTo(centerX, this.y + height);
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
  getRelativeCalloutEntryPoint() {
    const ports = this.getPorts();
    const inletPort = ports.find(p => p.direction === 'inlet');

    if (inletPort) {
      return { x: inletPort.localX + 40, y: inletPort.localY };
    }
    return { x: 20, y: this.getHeight() / 2 };
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
    if (jsonData.length !== undefined) this._lengthHorizontal = jsonData.length;
    if (jsonData.radius !== undefined) this._radius = jsonData.radius;
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
  constructor(id, x, y, length = 750, sectionType = 'rectangular', size = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3', sectionType, size);
    this._lengthHorizontal = length;
  }

  get length() { return this._lengthHorizontal; }
  set length(value) {
    if (this._lengthHorizontal === value) return;
    const centerX = this.x + this._lengthHorizontal / 2;
    this._lengthHorizontal = value;
    this.x = centerX - this._lengthHorizontal / 2;
    this.updatePorts();
  }

  getWidth() { return this._lengthHorizontal; }
  getHeight() { return this._size; }

  getCalloutText() {
    const area = (this._lengthHorizontal * this._size / 1000000).toFixed(2);
    return `${this.name}\nДлина: ${this._lengthHorizontal} мм\nШирина: ${this._size} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'length', label: 'Длина', type: 'number', step: 1, min: 100, value: this._lengthHorizontal, unit: 'мм' },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this._lengthHorizontal, this._size);
  }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    this.drawRectangular(ctx, this._lengthHorizontal, this._size, isSelected, scale, showColors);
    if (showElementAxes) {
      this.drawCenterLines(ctx, scale, isDarkTheme);
    }
  }

  // ИСПРАВЛЕННЫЙ hitTest - теперь правильно обрабатывает поворот
  hitTest(worldX, worldY, ctx) {
    const width = this.getWidth();
    const height = this.getHeight();

    // Преобразуем мировые координаты в локальные координаты элемента (с учетом поворота)
    const local = this.transformToLocalCoords(worldX, worldY);

    // Проверяем попадание в прямоугольник в локальных координатах
    const isHit = local.x >= this.x && local.x <= this.x + width &&
      local.y >= this.y && local.y <= this.y + height;

    // Для отладки (можно убрать)
    if (isHit) {
      // console.log(`Hit test on ${this.name} (${this.rotation}°): world(${worldX},${worldY}) -> local(${local.x},${local.y})`);
    }

    return isHit;
  }

  // Исправленный метод transformToLocalCoords в базовом классе BaseElement
  transformToLocalCoords(worldX, worldY) {
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    const rotation = this.rotation || 0;

    if (rotation === 0) {
      return { x: worldX, y: worldY };
    }

    // Перемещаем в систему координат центра элемента
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    // Поворачиваем обратно (отрицательный угол)
    const angle = -rotation * Math.PI / 180;
    const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);

    return {
      x: rotatedX + centerX,
      y: rotatedY + centerY
    };
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;
    const rotation = this.rotation || 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    // Горизонтальная осевая линия
    ctx.moveTo(this.x - 20, centerY);
    ctx.lineTo(this.x + width + 20, centerY);

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
      length: this._lengthHorizontal
    };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0', sectionType, size);
    this._lengthHorizontal = 300;
    this._branchHeight = 150;
  }

  get length() { return this._lengthHorizontal; }
  get branchHeight() { return this._branchHeight; }

  set length(newLength) {
    if (this._lengthHorizontal === newLength) return;
    const oldCenterX = this.x + this._lengthHorizontal / 2;
    this._lengthHorizontal = newLength;
    this.x = oldCenterX - this._lengthHorizontal / 2;
    this.updatePorts();
  }

  set branchHeight(newHeight) {
    if (this._branchHeight === newHeight) return;
    const oldCenterY = this.y + this.getHeight() / 2;
    this._branchHeight = newHeight;
    this.y = oldCenterY - this.getHeight() / 2;
    this.updatePorts();
  }

  getWidth() { return this._lengthHorizontal; }

  getHeight() {
    return this._size + this._branchHeight;
  }

  getCenterX() {
    return this.x + this._lengthHorizontal / 2;
  }

  getCenterY() {
    return this.y + this.getHeight() / 2;
  }

  getCalloutText() {
    const area = (this._lengthHorizontal * this._size / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._size} мм\nДлина гор.: ${this._lengthHorizontal} мм\nВысота ветки: ${this._branchHeight} мм\nТип: тройник\nСечение: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'length', label: 'Длина горизонтальная', type: 'number', step: 10, min: 50, value: this._lengthHorizontal, unit: 'мм' },
      { name: 'branchHeight', label: 'Высота ветки', type: 'number', step: 10, min: 20, value: this._branchHeight, unit: 'мм' },
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const halfSize = this._size / 2;
    const bottomBranchY = centerY + this._branchHeight;

    // Inlet порт (слева)
    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.getHeight() / 2, inletPos.x, inletPos.y
    ));

    // Outlet порт (справа)
    const outletPos = this.rotatePoint(this.x + this._lengthHorizontal, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._lengthHorizontal, this.getHeight() / 2, outletPos.x, outletPos.y
    ));

    // Branch порт (снизу)
    const branchPos = this.rotatePoint(centerX, bottomBranchY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this._lengthHorizontal / 2, this.getHeight() / 2 + this._branchHeight, branchPos.x, branchPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const halfSize = this._size / 2;
    const bottomBranchY = centerY + this._branchHeight;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const leftX = this.x;
    const rightX = this.x + this._lengthHorizontal;
    const mainTopY = centerY - halfSize;
    const mainBottomY = centerY + halfSize;
    const branchLeftX = centerX - halfSize;
    const branchRightX = centerX + halfSize;

    // Рисуем тройник
    ctx.moveTo(leftX, mainTopY);
    ctx.lineTo(rightX, mainTopY);
    ctx.lineTo(rightX, mainBottomY);
    ctx.lineTo(branchRightX, mainBottomY);
    ctx.lineTo(branchRightX, bottomBranchY);
    ctx.lineTo(branchLeftX, bottomBranchY);
    ctx.lineTo(branchLeftX, mainBottomY);
    ctx.lineTo(leftX, mainBottomY);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const rotation = this.rotation || 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    // Горизонтальная осевая линия (через весь горизонтальный канал)
    ctx.moveTo(this.x - 20, centerY);
    ctx.lineTo(this.x + this._lengthHorizontal + 20, centerY);

    // Вертикальная осевая линия (от центра до низа)
    const bottomY = centerY + this._branchHeight + 20;
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
      length: this._lengthHorizontal,
      branchHeight: this._branchHeight
    };
  }
}

// ========== КРЕСТОВИНА ==========
export class Cross extends DuctBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'cross', x, y, `Крестовина ${id}`, '#e91e63', sectionType, size);
    this._lengthHorizontal = 300;
    this._lengthVertical = 150;
  }

  get lengthHorizontal() { return this._lengthHorizontal; }
  get lengthVertical() { return this._lengthVertical; }

  set lengthHorizontal(newLength) {
    if (this._lengthHorizontal === newLength) return;
    const oldCenterX = this.x + this._lengthHorizontal / 2;
    this._lengthHorizontal = newLength;
    this.x = oldCenterX - this._lengthHorizontal / 2;
    this.updatePorts();
  }

  set lengthVertical(newLength) {
    if (this._lengthVertical === newLength) return;
    const oldCenterY = this.y + this.getHeight() / 2;
    this._lengthVertical = newLength;
    this.y = oldCenterY - this.getHeight() / 2;
    this.updatePorts();
  }

  getWidth() { return this._lengthHorizontal; }

  getHeight() {
    return this._size + this._lengthVertical * 2;
  }

  getCenterX() {
    return this.x + this._lengthHorizontal / 2;
  }

  getCenterY() {
    return this.y + this.getHeight() / 2;
  }

  getCalloutText() {
    const area = (this._lengthHorizontal * this._size / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._size} мм\nДлина гор.: ${this._lengthHorizontal} мм\nДлина верт.: ${this._lengthVertical} мм\nТип: крестовина\nСечение: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'lengthHorizontal', label: 'Длина горизонтальная', type: 'number', step: 10, min: 50, value: this._lengthHorizontal, unit: 'мм' },
      { name: 'lengthVertical', label: 'Длина вертикальная', type: 'number', step: 10, min: 20, value: this._lengthVertical, unit: 'мм' },
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const halfSize = this._size / 2;
    const topBranchY = centerY - this._lengthVertical;
    const bottomBranchY = centerY + this._lengthVertical;

    // Inlet порт (слева)
    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.getHeight() / 2, inletPos.x, inletPos.y
    ));

    // Outlet порт (справа)
    const outletPos = this.rotatePoint(this.x + this._lengthHorizontal, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._lengthHorizontal, this.getHeight() / 2, outletPos.x, outletPos.y
    ));

    // Branch порт (снизу)
    const branchPos = this.rotatePoint(centerX, bottomBranchY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this._lengthHorizontal / 2, this.getHeight() / 2 + this._lengthVertical, branchPos.x, branchPos.y
    ));

    // Верхний порт
    const topPos = this.rotatePoint(centerX, topBranchY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'top')?.id || Date.now() + Math.random(),
      this.id, 'top', 'top', this._lengthHorizontal / 2, this.getHeight() / 2 - this._lengthVertical, topPos.x, topPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const halfSize = this._size / 2;
    const topBranchY = centerY - this._lengthVertical;
    const bottomBranchY = centerY + this._lengthVertical;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    const leftX = this.x;
    const rightX = this.x + this._lengthHorizontal;
    const mainTopY = centerY - halfSize;
    const mainBottomY = centerY + halfSize;
    const branchLeftX = centerX - halfSize;
    const branchRightX = centerX + halfSize;

    // Рисуем симметричную крестовину
    ctx.moveTo(branchLeftX, topBranchY);
    ctx.lineTo(branchRightX, topBranchY);
    ctx.lineTo(branchRightX, mainTopY);
    ctx.lineTo(rightX, mainTopY);
    ctx.lineTo(rightX, mainBottomY);
    ctx.lineTo(branchRightX, mainBottomY);
    ctx.lineTo(branchRightX, bottomBranchY);
    ctx.lineTo(branchLeftX, bottomBranchY);
    ctx.lineTo(branchLeftX, mainBottomY);
    ctx.lineTo(leftX, mainBottomY);
    ctx.lineTo(leftX, mainTopY);
    ctx.lineTo(branchLeftX, mainTopY);
    ctx.lineTo(branchLeftX, topBranchY);
    ctx.closePath();

    ctx.restore();
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const rotation = this.rotation || 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    // Горизонтальная осевая линия (через весь горизонтальный канал)
    ctx.moveTo(this.x - 20, centerY);
    ctx.lineTo(this.x + this._lengthHorizontal + 20, centerY);

    // Вертикальная осевая линия (через весь вертикальный канал)
    const topY = centerY - this._lengthVertical - 20;
    const bottomY = centerY + this._lengthVertical + 20;
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
      lengthHorizontal: this._lengthHorizontal,
      lengthVertical: this._lengthVertical
    };
  }
}
// ========== ОТВОД АБСТРАКТНЫЙ ==========
class ElbowBase extends DuctBase {
  constructor(id, type, x, y, name, color, sectionType = 'rectangular', size) {
    super(id, type, x, y, name, color, sectionType, size);
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
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'elbowCircular', x, y, `Отвод ${id}`, '#00ff00', sectionType, size);
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
    return this._radius + this._size;
  }

  getHeight() {
    return this._radius + this._size;
  }

  getCenterX() {
    return this.x + this.getWidth() / 2;
  }

  getCenterY() {
    return this.y + this.getHeight() / 2;
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
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const centerRadius = this._radius + this._size / 2;

    // Inlet порт (слева)
    const inletX = this.x;
    const inletY = this.y + this.getHeight() - centerRadius;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, this.getHeight() - centerRadius, inletPos.x, inletPos.y
    ));

    // Outlet порт (снизу)
    const outletX = this.x + centerRadius;
    const outletY = this.y + this.getHeight();
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius, this.getHeight(), outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const bendCenterX = this.x;
    const bendCenterY = this.y + this.getHeight();
    const outerRadius = this._radius + this._size;
    const innerRadius = this._radius;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

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

  drawCenterLines(ctx, scale, isDarkTheme) {
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const rotation = this.rotation || 0;
    const bendCenterX = this.x;
    const bendCenterY = this.y + this.getHeight();
    const centerRadius = this._radius + this._size / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Центральная дуга (осевая линия) от 270° до 360°
    ctx.arc(bendCenterX, bendCenterY, centerRadius, Math.PI * 1.5, Math.PI * 2);

    // От левого конца дуги к левому краю
    const startX = bendCenterX;
    const startY = bendCenterY - centerRadius;
    ctx.moveTo(startX, startY);
    ctx.lineTo(this.x - 20, startY);

    // От нижнего конца дуги к нижнему краю
    const endX = bendCenterX + centerRadius;
    const endY = bendCenterY;
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX, this.y + this.getHeight() + 20);

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
export class ElbowRectangular extends ElbowBase {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    super(id, 'elbowRectangular', x, y, `Отвод секционный ${id}`, '#0000ff', sectionType, size);
    this._horizontalLength = 100; // Длина горизонтальной части до изгиба
    this._verticalLength = 100;   // Длина вертикальной части после изгиба
  }

  get horizontalLength() {
    return this._horizontalLength;
  }

  set horizontalLength(newLength) {
    if (this._horizontalLength === newLength) return;
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    this._horizontalLength = newLength;
    this.x = centerX - this.getWidth() / 2;
    this.y = centerY - this.getHeight() / 2;
    this.updatePorts();
  }

  get verticalLength() {
    return this._verticalLength;
  }

  set verticalLength(newLength) {
    if (this._verticalLength === newLength) return;
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    this._verticalLength = newLength;
    this.x = centerX - this.getWidth() / 2;
    this.y = centerY - this.getHeight() / 2;
    this.updatePorts();
  }

  // Для обратной совместимости
  get width() {
    return this._horizontalLength;
  }

  set width(value) {
    this.horizontalLength = value;
  }

  get height() {
    return this._verticalLength;
  }

  set height(value) {
    this.verticalLength = value;
  }

  getWidth() {
    return this._horizontalLength + this._size;
  }

  getHeight() {
    return this._verticalLength + this._size;
  }
  getCenterX() {
    return this.x + this.getWidth() / 2;
  }

  getCenterY() {
    return this.y + this.getHeight() / 2;
  }
  getCalloutText() {
    return `${this.name}\nСечение: ${this._size}×${this._size} мм`;
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    const size = this._size;
    const horizLen = this._horizontalLength;
    const vertLen = this._verticalLength;

    // Inlet порт (слева) - на левой стороне на уровне vertLen
    // Это точка входа воздуховода
    const inletX = this.x;
    const inletY = this.y + vertLen - size / 2;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left',
      0, vertLen - size / 2, // локальные координаты относительно x,y
      inletPos.x, inletPos.y
    ));

    // Outlet порт (снизу) - на нижней стороне на уровне horizLen
    // Это точка выхода воздуховода
    const outletX = this.x + horizLen + size / 2;
    const outletY = this.y + height;
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom',
      horizLen + size / 2, height, // локальные координаты относительно x,y
      outletPos.x, outletPos.y
    ));

    return ports;
  }

  createPath(ctx) {
    const rotation = this.rotation || 0;
    const width = this.getWidth();
    const height = this.getHeight();
    const elemCenterX = this.x + width / 2;
    const elemCenterY = this.y + height / 2;

    const size = this._size;
    const horizLen = this._horizontalLength;
    const vertLen = this._verticalLength;

    ctx.save();
    ctx.translate(elemCenterX, elemCenterY);
    ctx.rotate((rotation + 180) * Math.PI / 180);
    ctx.translate(-elemCenterX, -elemCenterY);
    ctx.beginPath();

    // Рисуем L-образную форму
    ctx.moveTo(this.x, this.y + vertLen);
    ctx.lineTo(this.x, this.y);
    ctx.lineTo(this.x + horizLen, this.y);
    ctx.lineTo(this.x + horizLen, this.y + vertLen);
    ctx.lineTo(this.x + horizLen + size, this.y + vertLen);
    ctx.lineTo(this.x + horizLen + size, this.y + height);
    ctx.lineTo(this.x, this.y + height);
    ctx.closePath();

    ctx.restore();
  }

  hitTest(worldX, worldY, ctx) {
    if (!this._size || !this._horizontalLength || !this._verticalLength ||
      this._size <= 0 || this._horizontalLength <= 0 || this._verticalLength <= 0) {
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
    const centerX = this.getCenterX();
    const centerY = this.getCenterY();
    const rotation = this.rotation || 0;

    const size = this._size;
    const horizLen = this._horizontalLength;
    const vertLen = this._verticalLength;

    // Точка внутреннего угла L-образной формы
    const cornerX = this.x + horizLen;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);

    // Горизонтальная осевая линия (через центр горизонтальной части)
    const horizontalCenterY = this.y + vertLen - size / 2;
    ctx.moveTo(this.x - 20, horizontalCenterY);
    ctx.lineTo(cornerX + size + 20, horizontalCenterY);
    ctx.stroke();

    // Вертикальная осевая линия (через центр вертикальной части)
    const verticalCenterX = this.x + horizLen + size / 2;
    ctx.moveTo(verticalCenterX, this.y + vertLen - size - 20);
    ctx.lineTo(verticalCenterX, this.y + this.getHeight() + 20);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }
  toJSON() {
    return {
      ...super.toJSON(),
      horizontalLength: this._horizontalLength,
      verticalLength: this._verticalLength,
    };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends DuctDirect {
  constructor(id, x, y, sectionType = 'rectangular', size = 100) {
    // Вызываем конструктор DuctDirect, но меняем тип на 'fan'
    super(id, x, y, size, sectionType, size); // length = size (квадратный вентилятор)
    this.type = 'fan';
    this.name = `Вентилятор ${id}`;
    this.color = '#ff9800';
    this.flow = 1000;
    this.pressure = 500;
  }

  getCalloutText() {
    const area = (this._size * this._size / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._size}×${this._size} мм\nПлощадь: ${area} м²\nПроизводительность: ${this.flow} м³/ч\nНапор: ${this.pressure} Па`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' },
      { name: 'pressure', label: 'Напор', type: 'number', step: 1, value: this.pressure, unit: 'Па' }
    ];
  }

  // Переопределяем draw для добавления специфических элементов вентилятора
  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors, showElementAxes) {
    // Рисуем прямоугольник (корпус)
    this.drawRectangular(ctx, this._lengthHorizontal, this._size, isSelected, scale, showColors);

    // Рисуем внутренности вентилятора
    const rotation = this.rotation || 0;
    const centerX = this.x + this._lengthHorizontal / 2;
    const centerY = this.y + this._size / 2;
    const radius = this._size * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Круг (крыльчатка)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = Math.max(1, 1.5 / scale);
    ctx.stroke();

    // Стрелка направления потока
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
      pressure: this.pressure
    };
  }
}
// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    const sectionType = params.sectionType || 'rectangular';
    const size = params.size || 50;

    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x, y, params.length || 750, sectionType, size);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        if (params.color) duct.color = params.color;
        return duct;
      case 'tee':
        const tee = new Tee(id, x, y, sectionType, size);
        if (params.length !== undefined) tee._lengthHorizontal = params.length;
        if (params.centerY !== undefined) tee._centerY = params.centerY;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        if (params.color) tee.color = params.color;
        return tee;
      case 'cross':
        const cross = new Cross(id, x, y, sectionType, size);
        if (params.length !== undefined) cross._lengthHorizontal = params.length;
        if (params.centerY !== undefined) cross._centerY = params.centerY;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        if (params.color) cross.color = params.color;
        return cross;
      case 'elbowCircular':
        const elbow = new ElbowCircular(id, x, y, sectionType, size);
        if (params.radius !== undefined) elbow._radius = params.radius;
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        if (params.color) elbow.color = params.color;
        return elbow;
      case 'elbowRectangular':
        const elbowRect = new ElbowRectangular(id, x, y, sectionType, size);
        if (params.width !== undefined) elbowRect.width = params.width;
        if (params.height !== undefined) elbowRect.height = params.height;
        if (params.rotation !== undefined) elbowRect.rotation = params.rotation;
        if (params.name) elbowRect.name = params.name;
        if (params.color) elbowRect.color = params.color;
        return elbowRect;
      case 'fan':
        const fan = new Fan(id, x, y, sectionType, size);
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

    // Восстанавливаем выноски только если они есть в JSON и элемент не группа
    // И только если это не процесс вставки (мы передаем пустой массив callouts)
    if (jsonData.callouts && jsonData.callouts.length > 0 && element.type !== 'group') {
      // Очищаем существующие выноски, чтобы избежать дублирования
      element.callouts = [];
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
    } else if (element.type !== 'group') {
      // Если выносок нет в JSON, убеждаемся, что массив пустой
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
