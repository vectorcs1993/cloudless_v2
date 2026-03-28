
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
    ctx.fillStyle = isDarkTheme ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(this.x, this.y, boxWidth, boxHeight);
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
      'elbow': 'Отвод'
    };
  }

  // Абстрактные методы (должны быть переопределены)
  getWidth() { throw new Error('Метод getWidth должен быть переопределен'); }
  getHeight() { throw new Error('Метод getHeight должен быть переопределен'); }
  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  draw(ctx, scale, isSelected, isDarkTheme) { throw new Error('Метод draw должен быть переопределен'); }
  hitTest(worldX, worldY) { throw new Error('Метод hitTest должен быть переопределен'); }

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

    if (isSelected) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(this.x, this.y, width, height);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.strokeRect(this.x, this.y, width, height);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, width, height);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(this.x, this.y, width, height);
    }
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

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x, y, length = 200, width = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3', width);
    this._length = length;
  }

  get length() {
    return this._length;
  }

  set length(newLength) {
    if (this._length === newLength) return;

    const centerX = this.x + this._length / 2;
    this._length = newLength;
    this.x = centerX - this._length / 2;
    this.updatePorts();
  }

  getWidth() { return this._length; }
  getHeight() { return this.size; }

  getCalloutText() {
    const area = (this._length * this.size / 1000000).toFixed(2);
    return `${this.name}\nДлина: ${this._length} мм\nШирина: ${this.size} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'length', label: 'Длина', type: 'number', step: 1, min: 100, value: this._length, unit: 'мм' },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this._length, this.size);
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.drawRectangular(ctx, this._length, this.size, isSelected, scale);
  }

  hitTest(worldX, worldY) {
    return this.hitTestRectangular(worldX, worldY, this._length, this.size);
  }

  toJSON() {
    return { ...super.toJSON(), length: this._length };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x, y, size = 50) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0', size);
    this._length = 150;
    this._branchHeight = 75;
    this._centerY = 50;
  }

  get length() {
    return this._length;
  }

  set length(newLength) {
    if (this._length === newLength) return;

    const centerX = this.x + this._length / 2;
    this._length = newLength;
    this.x = centerX - this._length / 2;
    this.updatePorts();
  }

  get branchHeight() {
    return this._branchHeight;
  }

  set branchHeight(newHeight) {
    if (this._branchHeight === newHeight) return;

    const bottomY = this.y + this._centerY + this._branchHeight;
    this._branchHeight = newHeight;
    this.y = bottomY - this._centerY - this._branchHeight;
    this.updatePorts();
  }

  get centerY() {
    return this._centerY;
  }

  set centerY(newCenterY) {
    if (this._centerY === newCenterY) return;

    const centerYPos = this.y + this._centerY;
    this._centerY = newCenterY;
    this.y = centerYPos - this._centerY;
    this.updatePorts();
  }

  getWidth() { return this._length; }
  getHeight() { return this._centerY + this.size / 2 + this._branchHeight; }

  getHeightCenter() {
    return this._centerY;
  }

  getCalloutText() {
    return `${this.name}\nШирина: ${this.size} мм\nТип: тройник\nСечение: ${(150 * this.size / 1000000).toFixed(2)} м²`;
  }

  getRelativeCalloutEntryPoint() {
    return {
      x: this._length / 2,
      y: this._centerY
    };
  }

  getRotationCenter() {
    return {
      x: this.x + this._length / 2,
      y: this.y + this._centerY
    };
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

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._centerY, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this._length, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._length, this._centerY, outletPos.x, outletPos.y
    ));

    const branchBottomY = centerY + this._branchHeight;
    const branchCenterX = this.x + this._length / 2;
    const branchPos = this.rotatePoint(branchCenterX, branchBottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this._length / 2, this._centerY + this._branchHeight, branchPos.x, branchPos.y
    ));

    return ports;
  }

  // Метод для преобразования мировых координат в локальные относительно верхнего левого угла элемента
  worldToLocal(x, y) {
    // Получаем центр вращения
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;
    const rotation = this.rotation || 0;

    // Смещение относительно центра вращения
    let dx = x - centerX;
    let dy = y - centerY;

    // Поворачиваем обратно
    if (rotation !== 0) {
      const angle = -rotation * Math.PI / 180;
      const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
      dx = rotatedX;
      dy = rotatedY;
    }

    // Получаем локальные координаты относительно верхнего левого угла
    const localX = centerX + dx - this.x;
    const localY = centerY + dy - this.y;

    return { x: localX, y: localY };
  }

  // Проверка попадания в форму тройника (в локальных координатах)
  isPointInTeeShape(localX, localY) {
    const halfSize = this.size / 2;
    const centerX = this._length / 2;
    const centerY = this._centerY;
    const branchBottomY = centerY + this._branchHeight;

    // Проверка попадания в горизонтальную трубу
    const inHorizontal = localX >= 0 && localX <= this._length &&
      localY >= centerY - halfSize && localY <= centerY + halfSize;

    // Проверка попадания в вертикальный отросток
    const inBranch = localX >= centerX - halfSize && localX <= centerX + halfSize &&
      localY >= centerY && localY <= branchBottomY;

    return inHorizontal || inBranch;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._length / 2;
    const centerY = this.y + this._centerY;
    const halfSize = this.size / 2;
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
    ctx.lineTo(leftX, topY);
    ctx.closePath();

    ctx.fillStyle = isSelected ? '#ffeb3b' : this.color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff0000' : '#666';
    ctx.lineWidth = isSelected ? Math.max(1, 2 / scale) : (1 / scale);
    ctx.stroke();

    ctx.restore();
  }

  hitTest(worldX, worldY) {
    // Преобразуем мировые координаты в локальные относительно верхнего левого угла
    const local = this.worldToLocal(worldX, worldY);

    // Проверяем попадание в форму тройника
    return this.isPointInTeeShape(local.x, local.y);
  }

  toJSON() {
    return { ...super.toJSON(), length: this._length, branchHeight: this._branchHeight, centerY: this._centerY };
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

  isPointInElbow(localX, localY) {
    const outerRadius = this._radius + this.size;
    const innerRadius = this._radius;
    const bendCenterX = 0;
    const bendCenterY = this.getHeight();

    const dx = localX - bendCenterX;
    const dy = localY - bendCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const isInArc = angle >= 3 * Math.PI / 2 - 0.01 && angle <= 2 * Math.PI + 0.01;
    const isBetweenRadii = distance >= innerRadius - 0.01 && distance <= outerRadius + 0.01;

    const centerRadius = this._radius + this.size / 2;

    const inInlet = localX >= -2 && localX <= 0 &&
      localY >= centerRadius - this.size / 2 &&
      localY <= centerRadius + this.size / 2;

    const inOutlet = localX >= centerRadius - this.size / 2 &&
      localX <= centerRadius + this.size / 2 &&
      localY >= this.getHeight() &&
      localY <= this.getHeight() + 2;

    return (isInArc && isBetweenRadii) || inInlet || inOutlet;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
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
    ctx.lineTo(bendCenterX + innerRadius * Math.cos(2 * Math.PI),
      bendCenterY + innerRadius * Math.sin(2 * Math.PI));
    ctx.arc(bendCenterX, bendCenterY, innerRadius, 2 * Math.PI, 3 * Math.PI / 2, true);
    ctx.closePath();

    ctx.fillStyle = isSelected ? '#ffeb3b' : this.color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff0000' : '#666';
    ctx.lineWidth = isSelected ? Math.max(1, 2 / scale) : 1 / scale;
    ctx.stroke();

    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const local = this.transformToLocalCoords(worldX, worldY);
    return this.isPointInElbow(local.x - this.x, local.y - this.y);
  }

  toJSON() {
    return { ...super.toJSON(), radius: this._radius };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends BaseElement {
  constructor(id, x, y, diameter = 120) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800');
    this._diameter = diameter;
    this.flow = 1000;
  }

  get diameter() {
    return this._diameter;
  }

  set diameter(newDiameter) {
    if (this._diameter === newDiameter) return;

    const centerX = this.x + this._diameter / 2;
    const centerY = this.y + this._diameter / 2;
    this._diameter = newDiameter;
    this.x = centerX - this._diameter / 2;
    this.y = centerY - this._diameter / 2;
    this.updatePorts();
  }

  getWidth() { return this._diameter; }
  getHeight() { return this._diameter; }

  getCalloutText() {
    return `${this.name}\nДиаметр: ${this._diameter} мм\nПроизводительность: ${this.flow} м³/ч\nМощность: ${(this.flow * 0.3).toFixed(1)} Вт`;
  }

  getParameters() {
    return [
      { name: 'diameter', label: 'Диаметр', type: 'number', step: 50, min: 100, value: this._diameter, unit: 'мм' },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this._diameter / 2;
    const centerY = this.y + this._diameter / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this._diameter / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this._diameter, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this._diameter, this._diameter / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this._diameter / 2;
    const centerY = this.y + this._diameter / 2;
    const radius = this._diameter / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected ? '#ffeb3b' : this.color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff0000' : '#666';
    ctx.lineWidth = isSelected ? Math.max(1, 2 / scale) : 1 / scale;
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const angle = (i * 120) * Math.PI / 180;
      const x1 = centerX + Math.cos(angle) * radius * 0.3;
      const y1 = centerY + Math.sin(angle) * radius * 0.3;
      const x2 = centerX + Math.cos(angle + 0.5) * radius;
      const y2 = centerY + Math.sin(angle + 0.5) * radius;
      const x3 = centerX + Math.cos(angle - 0.5) * radius;
      const y3 = centerY + Math.sin(angle - 0.5) * radius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const centerX = this.x + this._diameter / 2;
    const centerY = this.y + this._diameter / 2;
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this._diameter / 2;
  }

  toJSON() {
    return { ...super.toJSON(), diameter: this._diameter, flow: this.flow };
  }
}

// ========== ИСПРАВЛЕННАЯ ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    let element;
    switch (type) {
      case 'duct':
        element = new DuctDirect(id, x, y, params.length || 200, params.size || params.width || 100);
        break;
      case 'fan':
        element = new Fan(id, x, y, params.diameter || 120);
        break;
      case 'tee':
        element = new Tee(id, x, y, params.size || params.width || 50);
        break;
      case 'elbow':
        element = new Elbow(id, x, y, params.size || params.width || 50);
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
    // Сначала создаем элемент с базовыми параметрами
    let element;

    if (jsonData.type === 'duct') {
      element = new DuctDirect(jsonData.id, jsonData.x, jsonData.y, jsonData.length, jsonData.size);
    } else if (jsonData.type === 'fan') {
      element = new Fan(jsonData.id, jsonData.x, jsonData.y, jsonData.diameter);
    } else if (jsonData.type === 'tee') {
      element = new Tee(jsonData.id, jsonData.x, jsonData.y, jsonData.size);
      // Восстанавливаем специфичные для тройника поля
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
  // Метод для перемещения всех элементов группыe
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

  hitTest(worldX, worldY) {
    if (!this.elements) return false;

    // Проверяем попадание в любой элемент группы
    for (const element of this.elements) {
      if (element && element.hitTest && element.hitTest(worldX, worldY)) {
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
