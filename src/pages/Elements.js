
// ========== КЛАСС ВЫНОСКИ ==========
export class Callout {
  constructor(id, elementId, text, x, y) {
    this.id = id;
    this.elementId = elementId;
    this.text = text;
    this.x = x;
    this.y = y;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.anchorPoint = { x: 0, y: 0 };
  }

  // Обновить точку привязки на основе элемента
  updateAnchorPoint(element) {
    const absolutePoint = element.getAbsoluteCalloutPoint();
    this.anchorPoint = { x: absolutePoint.x, y: absolutePoint.y };
  }

  updatePosition(newX, newY) {
    this.x = newX;
    this.y = newY;
  }

  hitTest(worldX, worldY, scale, element) {
    // Фиксированные размеры в пикселях (не зависят от scale для hit test)
    const padding = 8;
    const fontSize = 14;
    const lineHeight = 20;

    // Временный контекст для измерения текста
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSize}px Arial`;

    const lines = this.text.split('\n');
    const maxWidth = Math.max(...lines.map(l => tempCtx.measureText(l).width));
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    const handleRadius = 8;

    const relativePoint = element.getRelativeCalloutEntryPoint();

    let handleX = this.x;
    let handleY = this.y + boxHeight / 2;

    if (relativePoint.x <= 0.33) {
      handleX = this.x;
    } else if (relativePoint.x >= 0.67) {
      handleX = this.x + boxWidth;
    } else {
      handleX = this.x + boxWidth / 2;
    }

    if (relativePoint.y <= 0.33) {
      handleY = this.y;
    } else if (relativePoint.y >= 0.67) {
      handleY = this.y + boxHeight;
    } else {
      handleY = this.y + boxHeight / 2;
    }

    const inDragHandle = Math.hypot(worldX - handleX, worldY - handleY) < handleRadius;
    const inTextArea = worldX >= this.x && worldX <= this.x + boxWidth &&
      worldY >= this.y && worldY <= this.y + boxHeight;

    return { hit: inTextArea || inDragHandle, isHandle: inDragHandle };
  }

  draw(ctx, scale, isDarkTheme, element) {
    // Обновляем точку привязки из элемента
    this.updateAnchorPoint(element);

    // Фиксированные размеры в пикселях (не зависят от scale!)
    // Потому что canvas уже масштабирован через ctx.scale()
    const padding = 8;
    const fontSize = 14;
    const lineHeight = 20;
    const lineWidth = 2;

    ctx.save();

    ctx.font = `${fontSize}px Arial`;

    const lines = this.text.split('\n');
    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    const calloutCenterX = this.x + boxWidth / 2;
    const calloutCenterY = this.y + boxHeight / 2;

    let calloutEdgePoint = { x: this.x, y: this.y + boxHeight / 2 };
    const dx = this.anchorPoint.x - calloutCenterX;
    const dy = this.anchorPoint.y - calloutCenterY;

    // Определяем точку на границе выноски
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        calloutEdgePoint = { x: this.x + boxWidth, y: calloutCenterY };
      } else {
        calloutEdgePoint = { x: this.x, y: calloutCenterY };
      }
    } else {
      if (dy > 0) {
        calloutEdgePoint = { x: calloutCenterX, y: this.y + boxHeight };
      } else {
        calloutEdgePoint = { x: calloutCenterX, y: this.y };
      }
    }

    // Рисуем линию от внутренней точки элемента до выноски
    ctx.beginPath();
    ctx.moveTo(this.anchorPoint.x, this.anchorPoint.y);
    ctx.lineTo(calloutEdgePoint.x, calloutEdgePoint.y);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Рисуем фон и рамку
    ctx.strokeStyle = isDarkTheme ? '#888' : '#333';
    ctx.lineWidth = lineWidth / 2;
    ctx.strokeRect(this.x, this.y, boxWidth, boxHeight);

    // Рисуем текст
    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, this.x + padding, this.y + padding + i * lineHeight);
    });

    ctx.restore();
  }

  toJSON() {
    return {
      id: this.id,
      elementId: this.elementId,
      text: this.text,
      x: this.x,
      y: this.y
    };
  }
}

// ========== КЛАСС ПОРТА ==========
export class Port {
  constructor(id, elementId, direction, side, localX, localY, worldX, worldY) {
    this.id = id;
    this.elementId = elementId;
    this.direction = direction;
    this.side = side;
    this.localX = localX;
    this.localY = localY;
    this.worldX = worldX;
    this.worldY = worldY;
    this.connectedElementId = null;
    this.connectedPortId = null;
    // Фиксированный радиус порта в пикселях
    this.radius = 5;
  }

  isConnected() {
    return this.connectedElementId !== null;
  }

  disconnect() {
    this.connectedElementId = null;
    this.connectedPortId = null;
  }

  connectTo(port) {
    this.connectedElementId = port.elementId;
    this.connectedPortId = port.id;
  }

  getDirectionName() {
    const directions = { 'inlet': 'Вход', 'outlet': 'Выход', 'branch': 'Ответвление' };
    return directions[this.direction] || this.direction;
  }

  updateWorldPosition(centerX, centerY, rotation, pointX, pointY) {
    const angleRad = rotation * Math.PI / 180;
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    this.worldX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX;
    this.worldY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY;
  }

  toJSON() {
    return {
      id: this.id,
      elementId: this.elementId,
      direction: this.direction,
      side: this.side,
      localX: this.localX,
      localY: this.localY,
      worldX: this.worldX,
      worldY: this.worldY,
      connectedElementId: this.connectedElementId,
      connectedPortId: this.connectedPortId,
      radius: this.radius
    };
  }
}

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
      'cross': 'Крестовина'
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
      ctx.strokeStyle = '#ff0000';
    } else {
      ctx.strokeStyle = '#666';
    }
    ctx.stroke();
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
    return [];
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

// ========== АБСТРАКТНЫЙ КЛАСС ВОЗДУХОВОДА ==========
class DuctBase extends BaseElement {
  constructor(id, type, x, y, name, color, size) {
    super(id, type, x, y, name, color);
    this._size = size;
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

  getParameters() {
    return [
      { name: 'size', label: 'Ширина/Диаметр', type: 'number', step: 1, min: 20, value: this.size, unit: 'мм' }
    ];
  }

  // Добавляем метод для восстановления из JSON
  fromJSON(jsonData) {
    this._size = jsonData.size;
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

  drawRectangular(ctx, width, height, isSelected, scale) {
    const rotation = this.rotation || 0;
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    this.setStrokeStyle(ctx, scale, isSelected, false);
    ctx.restore();
  }

  hitTestRectangular(worldX, worldY, width, height) {
    const local = this.transformToLocalCoords(worldX, worldY);
    return local.x >= this.x && local.x <= this.x + width &&
      local.y >= this.y && local.y <= this.y + height;
  }

  toJSON() {
    return { ...super.toJSON(), size: this._size };
  }
}

// ========== БАЗОВЫЙ КЛАСС ДЛЯ ЭЛЕМЕНТОВ С ЛИНЕЙНЫМИ ПОРТАМИ ==========
class LinearPortsElement extends BaseElement {
  constructor(id, type, x, y, name, color, width, height) {
    super(id, type, x, y, name, color);
    this._width = width;
    this._height = height;
  }

  get width() { return this._width; }
  get height() { return this._height; }
  getWidth() { return this._width; }
  getHeight() { return this._height; }

  set width(value) {
    if (this._width === value) return;
    const centerX = this.x + this._width / 2;
    this._width = value;
    this.x = centerX - this._width / 2;
    this.updatePorts();
  }

  set height(value) {
    if (this._height === value) return;
    const centerY = this.y + this._height / 2;
    this._height = value;
    this.y = centerY - this._height / 2;
    this.updatePorts();
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this._width / 2;
    const centerY = this.y + this._height / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._height / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this._width, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._width, this._height / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  createRectPath(ctx) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._width / 2;
    const centerY = this.y + this._height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    ctx.beginPath();
    ctx.rect(this.x, this.y, this._width, this._height);
    ctx.restore();
  }

  drawRect(ctx, scale, isSelected, color) {
    this.createRectPath(ctx);

    this.setStrokeStyle(ctx, scale, isSelected, false);
  }

  hitTestRect(worldX, worldY, ctx) {
    if (ctx) {
      this.createRectPath(ctx);
      return ctx.isPointInPath(worldX, worldY);
    }
    const local = this.transformToLocalCoords(worldX, worldY);
    return local.x >= this.x && local.x <= this.x + this._width &&
      local.y >= this.y && local.y <= this.y + this._height;
  }

  toJSON() {
    return { ...super.toJSON(), width: this._width, height: this._height };
  }
}

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends LinearPortsElement {
  constructor(id, x, y, length = 200, size = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3', length, size);
  }

  get length() { return this._width; }
  set length(value) { this.width = value; }
  get size() { return this._height; }
  set size(value) { this.height = value; }

  getCalloutText() {
    const area = (this._width * this._height / 1000000).toFixed(2);
    return `${this.name}\nДлина: ${this._width} мм\nШирина: ${this._height} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      { name: 'size', label: 'Ширина/Диаметр', type: 'number', step: 1, min: 20, value: this._height, unit: 'мм' },
      { name: 'length', label: 'Длина', type: 'number', step: 1, min: 100, value: this._width, unit: 'мм' },
    ];
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.drawRect(ctx, scale, isSelected, this.color);
  }

  hitTest(worldX, worldY, ctx) {
    return this.hitTestRect(worldX, worldY, ctx);
  }

  toJSON() {
    // Сохраняем как size и length для единообразия
    return {
      ...super.toJSON(),
      size: this._height,
      length: this._width
    };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends BaseElement {
  constructor(id, x, y, size = 50) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0');
    this._size = size;
    this._length = 150;
    this._branchHeight = 75;
    this._centerY = 50;
  }

  // Геттеры
  get size() { return this._size; }
  get length() { return this._length; }
  get branchHeight() { return this._branchHeight; }
  get centerY() { return this._centerY; }

  // Сеттеры с сохранением оси
  set size(newSize) {
    if (this._size === newSize) return;
    const oldCenterX = this.x + this._length / 2;
    const oldCenterY = this.y + this._centerY;
    this._size = newSize;
    this.x = oldCenterX - this._length / 2;
    this.y = oldCenterY - this._centerY;
    this.updatePorts();
  }

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

  getParameters() {
    return [
      { name: 'size', label: 'Ширина/Диаметр', type: 'number', step: 1, min: 20, value: this._size, unit: 'мм' }
    ];
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

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.createPath(ctx);

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
      size: this._size,
      length: this._length,
      branchHeight: this._branchHeight,
      centerY: this._centerY
    };
  }
}

// ========== КРЕСТОВИНА ==========
export class Cross extends BaseElement {
  constructor(id, x, y, size = 50) {
    super(id, 'cross', x, y, `Крестовина ${id}`, '#e91e63');
    this._size = size;
    this._length = 150;
    this._branchHeight = 75;
    this._centerY = 50;
  }

  // Геттеры
  get size() { return this._size; }
  get length() { return this._length; }
  get branchHeight() { return this._branchHeight; }
  get centerY() { return this._centerY; }

  // Сеттеры с сохранением оси
  set size(newSize) {
    if (this._size === newSize) return;
    const oldCenterX = this.x + this._length / 2;
    const oldCenterY = this.y + this._centerY;
    this._size = newSize;
    this.x = oldCenterX - this._length / 2;
    this.y = oldCenterY - this._centerY;
    this.updatePorts();
  }

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

  getParameters() {
    return [
      { name: 'size', label: 'Ширина/Диаметр', type: 'number', step: 1, min: 20, value: this._size, unit: 'мм' }
    ];
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
    // Левая верхняя точка верхнего отростка
    ctx.moveTo(branchLeftX, branchTopY);
    // Идём вправо по верхней границе верхнего отростка
    ctx.lineTo(branchRightX, branchTopY);
    // Идём вниз по правой границе верхнего отростка
    ctx.lineTo(branchRightX, topY);
    // Идём вправо по верхней границе горизонтального канала
    ctx.lineTo(rightX, topY);
    // Идём вниз по правой границе горизонтального канала
    ctx.lineTo(rightX, bottomY);
    // Идём влево к началу нижнего отростка
    ctx.lineTo(branchRightX, bottomY);
    // Идём вниз по правой границе нижнего отростка
    ctx.lineTo(branchRightX, branchBottomY);
    // Идём влево по нижней границе нижнего отростка
    ctx.lineTo(branchLeftX, branchBottomY);
    // Идём вверх по левой границе нижнего отростка
    ctx.lineTo(branchLeftX, bottomY);
    // Идём влево по нижней границе горизонтального канала
    ctx.lineTo(leftX, bottomY);
    // Идём вверх по левой границе горизонтального канала
    ctx.lineTo(leftX, topY);
    // Идём вправо по верхней границе горизонтального канала к левой границе верхнего отростка
    ctx.lineTo(branchLeftX, topY);
    // Идём вверх по левой границе верхнего отростка
    ctx.lineTo(branchLeftX, branchTopY);
    ctx.closePath();

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.createPath(ctx);

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
      size: this._size,
      length: this._length,
      branchHeight: this._branchHeight,
      centerY: this._centerY
    };
  }
}
// ========== ОТВОД ==========
export class Elbow extends DuctBase {
  constructor(id, x, y, size = 50) {
    super(id, 'elbow', x, y, `Отвод ${id}`, '#4caf50', size);
    this._radius = 50;
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

  getWidth() { return this._radius + this.size; }
  getHeight() { return this._radius + this.size; }

  getCalloutText() {
    return `${this.name}\nДиаметр: ${this.size} мм\nРадиус изгиба: ${this._radius} мм\nУгол: 90°`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'radius', label: 'Радиус изгиба', type: 'number', step: 5, min: 30, value: this._radius, unit: 'мм' }
    ];
  }

  getRelativeCalloutEntryPoint() {
    const centerRadius = this._radius + this.size / 2;
    const angle = 315 * Math.PI / 180;
    const x = centerRadius * Math.cos(angle);
    const y = this.getHeight() + centerRadius * Math.sin(angle);
    return { x, y };
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getWidth() / 2;
    const centerY = this.y + this.getHeight() / 2;
    const centerRadius = this._radius + this.size / 2;

    const inletX = this.x;
    const inletY = this.y + this.getHeight() - centerRadius;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, this.getHeight() - centerRadius, inletPos.x, inletPos.y
    ));

    const outletX = this.x + centerRadius;
    const outletY = this.y + this.getHeight();
    const outletPos = this.rotatePoint(outletX, outletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'bottom', centerRadius, this.getHeight(), outletPos.x, outletPos.y
    ));

    return ports;
  }

  // Создание пути для отвода
  createPath(ctx) {
    const rotation = this.rotation || 0;
    const elemCenterX = this.x + this.getWidth() / 2;
    const elemCenterY = this.y + this.getHeight() / 2;
    const bendCenterX = this.x;
    const bendCenterY = this.y + this.getHeight();
    const outerRadius = this._radius + this.size;
    const innerRadius = this._radius;

    ctx.save();
    ctx.translate(elemCenterX, elemCenterY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-elemCenterX, -elemCenterY);

    ctx.beginPath();
    ctx.arc(bendCenterX, bendCenterY, outerRadius, 3 * Math.PI / 2, 2 * Math.PI);
    ctx.lineTo(
      bendCenterX + innerRadius * Math.cos(2 * Math.PI),
      bendCenterY + innerRadius * Math.sin(2 * Math.PI)
    );
    ctx.arc(bendCenterX, bendCenterY, innerRadius, 2 * Math.PI, 3 * Math.PI / 2, true);
    ctx.closePath();

    ctx.restore();
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.createPath(ctx);

    this.setStrokeStyle(ctx, scale, isSelected, false);
  }

  hitTest(worldX, worldY, ctx) {
    // Если передан контекст, используем его
    if (ctx) {
      this.createPath(ctx);
      return ctx.isPointInPath(worldX, worldY);
    }

    // Fallback: создаём временный canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    this.createPath(tempCtx);
    return tempCtx.isPointInPath(worldX, worldY);
  }

  toJSON() {
    return { ...super.toJSON(), radius: this._radius };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends LinearPortsElement {
  constructor(id, x, y, size = 100) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800', size, size);
    this.flow = 1000;
  }

  get size() { return this._width; }
  set size(value) { this.height = this.width = value; }

  getCalloutText() {
    const area = (this._width * this._height / 1000000).toFixed(2);
    return `${this.name}\nРазмер: ${this._width}×${this._height} мм\nПроизводительность: ${this.flow} м³/ч\nМощность: ${(this.flow * 0.3).toFixed(1)} Вт`;
  }

  getParameters() {
    return [
      { name: 'size', label: 'Размер', type: 'number', step: 10, min: 50, value: this._width, unit: 'мм' },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' }
    ];
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._width / 2;
    const centerY = this.y + this._height / 2;
    const radius = Math.min(this._width, this._height) * 0.35;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Корпус
    ctx.beginPath();
    ctx.rect(this.x, this.y, this._width, this._height);

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
    return this.hitTestRect(worldX, worldY, ctx);
  }

  toJSON() {
    // Сохраняем как size для единообразия
    return {
      ...super.toJSON(),
      flow: this.flow,
      size: this._width
    };
  }
}
// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    let element;
    switch (type) {
      case 'duct':
        const ductSize = params.size || params.width || 100;
        const ductLength = params.length || 200;
        element = new DuctDirect(id, x, y, ductLength, ductSize);
        break;
      case 'tee':
        element = new Tee(id, x, y, params.size || 50);
        break;
      case 'cross':
        element = new Cross(id, x, y, params.size || 50);
        break;
      case 'elbow':
        element = new Elbow(id, x, y, params.size || 50);
        break;
      case 'fan':
        // Унифицируем: используем size, диаметр или size
        const fanSize = params.size || params.diameter || 100;
        element = new Fan(id, x, y, fanSize);
        break;
      case 'group': {
        const elements = (params.elements || []).map(elJson => this.createFromJSON(elJson));
        const newGroupId = Date.now() + Math.random();
        element = new Group(newGroupId, elements);
        element.name = params.name;
        element.color = params.color;
        element.rotation = params.rotation || 0;
        element._x = params._x || 0;
        element._y = params._y || 0;
        element.width = params.width || 0;
        element.height = params.height || 0;
        element.callouts = params.callouts?.map(c => {
          const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y);
          return callout;
        }) || [];
        return element;
      }
      default:
        throw new Error(`Unknown element type: ${type}`);
    }

    return element;
  }

  static createFromJSON(jsonData) {
    let element;

    if (jsonData.type === 'duct') {
      const ductSize = jsonData.size || jsonData.width || 100;
      const ductLength = jsonData.length || 200;
      element = new DuctDirect(jsonData.id, jsonData.x, jsonData.y, ductLength, ductSize);
    } else if (jsonData.type === 'fan') {
      element = new Fan(jsonData.id, jsonData.x, jsonData.y, jsonData.size || jsonData.diameter || 100);
    } else if (jsonData.type === 'tee') {
      element = new Tee(jsonData.id, jsonData.x, jsonData.y, jsonData.size);
      if (jsonData.length !== undefined) element._length = jsonData.length;
      if (jsonData.branchHeight !== undefined) element._branchHeight = jsonData.branchHeight;
      if (jsonData.centerY !== undefined) element._centerY = jsonData.centerY;
    } else if (jsonData.type === 'cross') {
      element = new Cross(jsonData.id, jsonData.x, jsonData.y, jsonData.size);
      if (jsonData.length !== undefined) element._length = jsonData.length;
      if (jsonData.branchHeight !== undefined) element._branchHeight = jsonData.branchHeight;
      if (jsonData.centerY !== undefined) element._centerY = jsonData.centerY;
    } else if (jsonData.type === 'elbow') {
      element = new Elbow(jsonData.id, jsonData.x, jsonData.y, jsonData.size);
      if (jsonData.radius !== undefined) element._radius = jsonData.radius;
    } else if (jsonData.type === 'group') {
      const elements = (jsonData.elements || []).map(elJson => this.createFromJSON(elJson));
      const group = new Group(jsonData.id, elements);
      group.name = jsonData.name;
      group.color = jsonData.color;
      group.rotation = jsonData.rotation || 0;
      group._x = jsonData._x || 0;
      group._y = jsonData._y || 0;
      group.width = jsonData.width || 0;
      group.height = jsonData.height || 0;
      group.callouts = jsonData.callouts?.map(c => {
        const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y);
        return callout;
      }) || [];
      return group;
    } else {
      throw new Error(`Unknown element type: ${jsonData.type}`);
    }

    // Общие поля для всех элементов
    element.name = jsonData.name;
    element.color = jsonData.color;
    element.rotation = jsonData.rotation || 0;
    element.flow = jsonData.flow || element.flow;

    // Восстанавливаем порты
    element.ports = jsonData.ports?.map(p => new Port(
      p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
    )) || [];

    element.ports.forEach(port => {
      const foundPort = jsonData.ports?.find(op => op.id === port.id);
      if (foundPort) {
        port.connectedElementId = foundPort.connectedElementId || null;
        port.connectedPortId = foundPort.connectedPortId || null;
      }
    });

    // Восстанавливаем выноски
    element.callouts = jsonData.callouts?.map(c => {
      const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y);
      return callout;
    }) || [];

    return element;
  }
}

// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements) {
    // Генерируем уникальный ID если не передан или это не число
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
    return [];
  }

  // Реализуем метод getPorts для группы
  getPorts() {
    // Группа сама по себе не имеет портов, возвращаем пустой массив
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

  // Метод для перемещения всех элементов группы
  move(deltaX, deltaY) {
    if (!this.elements || this.elements.length === 0) return;

    // Проверяем, что дельта корректна
    if (isNaN(deltaX) || isNaN(deltaY) || !isFinite(deltaX) || !isFinite(deltaY)) {
      console.warn('Invalid delta in group move:', deltaX, deltaY);
      return;
    }

    console.log('Group move - delta:', deltaX, deltaY, 'current pos:', this._x, this._y);

    // Перемещаем каждый элемент
    this.elements.forEach(element => {
      if (element) {
        element.x += deltaX;
        element.y += deltaY;

        // Перемещаем выноски элемента вместе с ним
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

    // Обновляем границы группы
    this.updateBounds();

    console.log('Group move - new pos:', this._x, this._y);
  }

  // Создание пути для группы (для hitTest)
  createPath(ctx) {
    // Группа не имеет собственного пути, так как состоит из других элементов
    // Этот метод не должен вызываться для группы
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    // Рисуем все элементы группы
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.draw) {
          element.draw(ctx, scale, isSelected, isDarkTheme);
        }
      });
    }

    // Рисуем выноски всех элементов группы
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.callouts && element.callouts.length > 0) {
          for (const callout of element.callouts) {
            callout.draw(ctx, scale, isDarkTheme, element);
          }
        }
      });
    }

    // Если группа выбрана, рисуем рамку вокруг всей группы
    if (isSelected && this.width > 0 && this.height > 0) {
      ctx.save();
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = Math.max(2, 3 / scale);
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.strokeRect(this._x, this._y, this.width, this.height);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  hitTest(worldX, worldY, ctx) {
    if (!this.elements) return false;

    // Проверяем попадание в любой элемент группы
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
