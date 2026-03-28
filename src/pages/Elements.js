
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
    this.size = size; // ширина/диаметр
  }

  getParameters() {
    return [
      { name: 'size', label: 'Ширина/Диаметр', type: 'number', step: 1, min: 20, value: this.size, unit: 'мм' }
    ];
  }

  // Создание портов для элементов с линейным потоком (вход слева, выход справа)
  createLinearPorts(width, height, offsetX = 0, offsetY = 0) {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    // Левый порт (вход)
    const inletPos = this.rotatePoint(this.x + offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', offsetX, height / 2 + offsetY, inletPos.x, inletPos.y
    ));

    // Правый порт (выход)
    const outletPos = this.rotatePoint(this.x + width - offsetX, centerY + offsetY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', width - offsetX, height / 2 + offsetY, outletPos.x, outletPos.y
    ));

    return ports;
  }

  // Стандартная отрисовка прямоугольного элемента
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

  // Стандартная проверка попадания для прямоугольного элемента
  hitTestRectangular(worldX, worldY, width, height) {
    const local = this.transformToLocalCoords(worldX, worldY);
    return local.x >= this.x && local.x <= this.x + width &&
      local.y >= this.y && local.y <= this.y + height;
  }

  toJSON() {
    return { ...super.toJSON(), size: this.size };
  }
}

// ========== ПРЯМОЙ ВОЗДУХОВОД ==========
export class DuctDirect extends DuctBase {
  constructor(id, x, y, length = 200, width = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3', width);
    this.length = length;
  }

  getWidth() { return this.length; }
  getHeight() { return this.size; }

  getCalloutText() {
    const area = (this.length * this.size / 1000000).toFixed(2);
    return `${this.name}\nДлина: ${this.length} мм\nШирина: ${this.size} мм\nПлощадь: ${area} м²`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'length', label: 'Длина', type: 'number', step: 1, min: 100, value: this.length, unit: 'мм' },
    ];
  }

  getPorts() {
    return this.createLinearPorts(this.length, this.size);
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    this.drawRectangular(ctx, this.length, this.size, isSelected, scale);
  }

  hitTest(worldX, worldY) {
    return this.hitTestRectangular(worldX, worldY, this.length, this.size);
  }

  toJSON() {
    return { ...super.toJSON(), length: this.length };
  }
}

// ========== ТРОЙНИК ==========
export class Tee extends DuctBase {
  constructor(id, x, y, width = 50) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0', width);
    this.length = 150;      // длина горизонтальной части
    this.branchHeight = 75; // высота отростка от центра
    this.centerY = 50;      // высота центра горизонтальной трубы
  }

  // Добавьте этот метод для получения длины
  getLength() {
    return this.length;
  }

  getWidth() { return this.getLength(); }
  getHeight() { return this.centerY + this.size / 2 + this.branchHeight; }

  // Добавьте метод для получения высоты центра
  getHeightCenter() {
    return this.centerY;
  }

  getCalloutText() {
    return `${this.name}\nШирина: ${this.size} мм\nТип: тройник\nСечение: ${(150 * this.size / 1000000).toFixed(2)} м²`;
  }

  getRelativeCalloutEntryPoint() {
    // Возвращаем точку в центре горизонтальной трубы
    return {
      x: this.getLength() / 2,  // центр по ширине
      y: this.getHeightCenter()  // ось горизонтальной трубы
    };
  }

  getRotationCenter() {
    return {
      x: this.x + this.getLength() / 2,
      y: this.y + this.getHeightCenter()
    };
  }

  getAbsoluteCalloutPoint() {
    // Получаем относительную точку привязки (относительно верхнего левого угла)
    const relativePoint = this.getRelativeCalloutEntryPoint();

    // Центр вращения тройника (центр горизонтальной трубы)
    const rotationCenterX = this.x + this.getLength() / 2;
    const rotationCenterY = this.y + this.getHeightCenter();

    // Координаты точки привязки в абсолютных координатах (без поворота)
    const absoluteX = this.x + relativePoint.x;
    const absoluteY = this.y + relativePoint.y;

    // Смещение от центра вращения
    const dx = absoluteX - rotationCenterX;
    const dy = absoluteY - rotationCenterY;

    // Применяем поворот
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    // Возвращаем конечные координаты
    return {
      x: rotationCenterX + rotatedX,
      y: rotationCenterY + rotatedY
    };
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getLength() / 2;
    const centerY = this.y + this.getHeightCenter();

    // Левый порт
    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.getHeightCenter(), inletPos.x, inletPos.y
    ));

    // Правый порт
    const outletPos = this.rotatePoint(this.x + this.getLength(), centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.getLength(), this.getHeightCenter(), outletPos.x, outletPos.y
    ));

    // Нижний порт (ответвление)
    const branchBottomY = centerY + this.branchHeight;
    const branchCenterX = this.x + this.getLength() / 2;
    const branchPos = this.rotatePoint(branchCenterX, branchBottomY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this.getLength() / 2, this.getHeightCenter() + this.branchHeight, branchPos.x, branchPos.y
    ));

    return ports;
  }

  isPointInTeeShape(localX, localY) {
    const halfSize = this.size / 2;
    const centerX = this.getLength() / 2;
    const centerY = this.getHeightCenter();

    // Горизонтальная труба
    const inHorizontal = localX >= 0 && localX <= this.getLength() &&
      localY >= centerY - halfSize && localY <= centerY + halfSize;

    // Вертикальный отросток
    const inBranch = localX >= centerX - halfSize && localX <= centerX + halfSize &&
      localY >= centerY && localY <= centerY + this.branchHeight;

    return inHorizontal || inBranch;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getLength() / 2;
    const centerY = this.y + this.getHeightCenter();
    const halfSize = this.size / 2;
    const branchBottomY = centerY + this.branchHeight;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();

    // Рисуем контур тройника
    const leftX = this.x;
    const rightX = this.x + this.getLength();
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
    const local = this.transformToLocalCoords(worldX, worldY);
    return this.isPointInTeeShape(local.x - this.x, local.y - this.y);
  }

  toJSON() {
    return { ...super.toJSON(), length: this.length, branchHeight: this.branchHeight, centerY: this.centerY };
  }
}

// ========== ОТВОД ==========
export class Elbow extends DuctBase {
  constructor(id, x, y, size = 50) {
    super(id, 'elbow', x, y, `Отвод ${id}`, '#4caf50', size);
    this.radius = 50; // радиус изгиба до внутренней стороны
  }

  getWidth() { return this.radius + this.size; }
  getHeight() { return this.radius + this.size; }

  getCalloutText() {
    return `${this.name}\nДиаметр: ${this.size} мм\nРадиус изгиба: ${this.radius} мм\nУгол: 90°`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      { name: 'radius', label: 'Радиус изгиба', type: 'number', step: 5, min: 30, value: this.radius, unit: 'мм' }
    ];
  }

  getRelativeCalloutEntryPoint() {
    const centerRadius = this.radius + this.size / 2;
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
    const centerRadius = this.radius + this.size / 2;

    // Входной порт (слева)
    const inletX = this.x;
    const inletY = this.y + this.getHeight() - centerRadius;
    const inletPos = this.rotatePoint(inletX, inletY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, this.getHeight() - centerRadius, inletPos.x, inletPos.y
    ));

    // Выходной порт (снизу)
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
    const outerRadius = this.radius + this.size;
    const innerRadius = this.radius;
    const bendCenterX = 0;
    const bendCenterY = this.getHeight();

    const dx = localX - bendCenterX;
    const dy = localY - bendCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    const isInArc = angle >= 3 * Math.PI / 2 - 0.01 && angle <= 2 * Math.PI + 0.01;
    const isBetweenRadii = distance >= innerRadius - 0.01 && distance <= outerRadius + 0.01;

    const centerRadius = this.radius + this.size / 2;

    // Патрубки
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
    const outerRadius = this.radius + this.size;
    const innerRadius = this.radius;

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
    return { ...super.toJSON(), radius: this.radius };
  }
}

// ========== ВЕНТИЛЯТОР ==========
export class Fan extends BaseElement {
  constructor(id, x, y, diameter = 120) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800');
    this.diameter = diameter;
    this.flow = 1000;
  }

  getWidth() { return this.diameter; }
  getHeight() { return this.diameter; }

  getCalloutText() {
    return `${this.name}\nДиаметр: ${this.diameter} мм\nПроизводительность: ${this.flow} м³/ч\nМощность: ${(this.flow * 0.3).toFixed(1)} Вт`;
  }

  getParameters() {
    return [
      { name: 'diameter', label: 'Диаметр', type: 'number', step: 50, min: 100, value: this.diameter, unit: 'мм' },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.diameter / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this.diameter, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.diameter, this.diameter / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;
    const radius = this.diameter / 2;

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

    // Лопасти вентилятора
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
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.diameter / 2;
  }

  toJSON() {
    return { ...super.toJSON(), diameter: this.diameter, flow: this.flow };
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

// ========== КЛАСС ФАБРИКИ ЭЛЕМЕНТОВ ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    switch (type) {
      case 'duct':
        return new DuctDirect(id, x, y, params.length || 200, params.width || 100);
      case 'fan':
        return new Fan(id, x, y, params.diameter || 120);
      case 'tee':
        return new Tee(id, x, y, params.width || 150, params.height || 150);
      case 'elbow':
        return new Elbow(id, x, y, params.width || 50);
      case 'group': {
        // Для группы нужно восстановить элементы
        const elements = (params.elements || []).map(elJson => {
          return this.createFromJSON(elJson);
        });
        // Игнорируем старый ID из JSON, генерируем новый для каждой группы
        const newGroupId = Date.now() + Math.random();
        const group = new Group(newGroupId, elements);
        group.name = params.name;
        group.color = params.color;
        group.rotation = params.rotation || 0;
        group._x = params._x || 0;
        group._y = params._y || 0;
        group.width = params.width || 0;
        group.height = params.height || 0;
        group.callouts = params.callouts?.map(c => {
          const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y);
          return callout;
        }) || [];
        return group;
      }
      default:
        throw new Error(`Unknown element type: ${type}`);
    }
  }

  static createFromJSON(jsonData) {
    const element = this.createElement(jsonData.type, jsonData.id, jsonData.x, jsonData.y, jsonData);
    element.name = jsonData.name;
    element.color = jsonData.color;
    element.rotation = jsonData.rotation || 0;
    element.ports = jsonData.ports?.map(p => new Port(
      p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
    )) || [];
    element.ports.forEach(port => {
      port.connectedElementId = jsonData.ports?.find(op => op.id === port.id)?.connectedElementId || null;
      port.connectedPortId = jsonData.ports?.find(op => op.id === port.id)?.connectedPortId || null;
    });
    element.callouts = jsonData.callouts?.map(c => {
      const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y);
      return callout;
    }) || [];
    return element;
  }
}
