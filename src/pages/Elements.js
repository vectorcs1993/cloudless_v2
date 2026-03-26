
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

// Port.js
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
    this.callouts = []; // Массив выносок элемента
  }

  static getAvailableTypes() {
    return { 'duct': 'Прямой воздуховод', 'fan': 'Вентилятор', 'tee': 'Тройник' };
  }

  getRelativeCalloutEntryPoint() {
    return { x: this.getWidth() / 2 + this.getWidth() * 0.35, y: this.getHeight() / 2 - this.getHeight() * 0.2 };
  }
  // Метод для получения абсолютных координат точки привязки с учетом поворота
  getAbsoluteCalloutPoint() {
    const relativePoint = this.getRelativeCalloutEntryPoint();
    const width = this.getWidth();
    const height = this.getHeight();

    // Точка в локальных координатах элемента (относительно его верхнего левого угла)
    const localX = relativePoint.x;
    const localY = relativePoint.y;

    // Центр элемента
    const centerX = this.x + width / 2;
    const centerY = this.y + height / 2;

    // Смещение от центра
    const dx = localX - width / 2;
    const dy = localY - height / 2;

    // Применяем поворот
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    // Возвращаем абсолютные координаты
    return {
      x: centerX + rotatedX,
      y: centerY + rotatedY
    };
  }

  // Вспомогательный метод для получения размеров (должены быть переопределены)
  getWidth() { return 100; }
  getHeight() { return 100; }

  getTypeName() {
    const types = BaseElement.getAvailableTypes();
    return types[this.type] || this.type;
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
  // Метод для получения текста выноски - должен быть переопределен в дочерних классах
  getCalloutText() {
    return `${this.name}\n${this.getTypeName()}`;
  }

  getElementText() {
    return '';
  }

  // Обновить текст выноски
  updateCalloutText() {
    if (this.callouts.length > 0) {
      this.callouts[0].text = this.getCalloutText();
    }
  }

  // Добавить выноску
  // Добавляем параметры для относительной точки привязки
  // Упрощаем - теперь не нужно передавать относительные координаты
  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    this.callouts.push(callout);
    return callout;
  }

  // Удалить выноску
  removeCallout(calloutId) {
    const index = this.callouts.findIndex(c => c.id === calloutId);
    if (index !== -1) {
      this.callouts.splice(index, 1);
    }
  }

  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  draw(ctx, scale, isSelected, isDarkTheme) { throw new Error('Метод draw должен быть переопределен'); }
  hitTest(worldX, worldY) { throw new Error('Метод hitTest должен быть переопределен'); }
  getParameters() { return []; }

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

  toJSON() {
    return {
      id: this.id, type: this.type, x: this.x, y: this.y, name: this.name,
      color: this.color, rotation: this.rotation,
      ports: this.ports.map(p => p.toJSON()),
      callouts: this.callouts.map(c => c.toJSON())
    };
  }
  // Геттер для точки поворота (центр элемента)
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
}

// ========== КЛАСС ВОЗДУХОВОДА ==========
export class DuctDirect extends BaseElement {
  constructor(id, x, y, length = 200, width = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3');
    this.length = length;
    this.width = width;
  }

  // Специфичный текст выноски для воздуховода
  getCalloutText() {
    return `${this.name}\nДлина: ${this.length} мм\nШирина: ${this.width} мм\nПлощадь: ${(this.length * this.width / 1000000).toFixed(2)} м²`;
  }
  getParameters() {
    return [
      { name: 'length', label: 'Длина', type: 'number', step: 50, min: 100, value: this.length, unit: 'мм' },
      { name: 'width', label: 'Ширина', type: 'number', step: 50, min: 50, value: this.width, unit: 'мм' }
    ];
  }
  getWidth() {
    return this.length;
  }
  getHeight() {
    return this.width;
  }
  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.width / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this.length, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.length, this.width / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    if (isSelected) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(this.x, this.y, this.length, this.width);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.strokeRect(this.x, this.y, this.length, this.width);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.length, this.width);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(this.x, this.y, this.length, this.width);
    }
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const rotation = this.rotation || 0;
    if (rotation === 0 || rotation === 180) {
      return worldX >= this.x && worldX <= this.x + this.length &&
        worldY >= this.y && worldY <= this.y + this.width;
    }
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;
    let dx = worldX - centerX;
    let dy = worldY - centerY;
    const angle = -rotation * Math.PI / 180;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + centerX;
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + centerY;
    return localX >= this.x && localX <= this.x + this.length &&
      localY >= this.y && localY <= this.y + this.width;
  }

  toJSON() {
    return { ...super.toJSON(), length: this.length, width: this.width };
  }
}

// ========== КЛАСС ВЕНТИЛЯТОРА ==========
export class Fan extends BaseElement {
  constructor(id, x, y, diameter = 120) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800');
    this.diameter = diameter;
    this.flow = 1000;
  }

  // Специфичный текст выноски для вентилятора
  getCalloutText() {
    return `${this.name}\nДиаметр: ${this.diameter} мм\nПроизводительность: ${this.flow} м³/ч\nМощность: ${(this.flow * 0.3).toFixed(1)} Вт`;
  }
  getWidth() {
    return this.diameter;
  }
  getHeight() {
    return this.diameter;
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
    if (isSelected) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }

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

    ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
    ctx.font = `${Math.max(6, 10 / scale)}px Arial`;
    ctx.fillText(this.getElementText(), this.x + 5, this.y + 35 / scale);
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

// ========== КЛАСС ТРОЙНИКА ==========
export class Tee extends BaseElement {
  constructor(id, x, y, width = 50) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0');
    this.width = width; // пользовательская ширина (высота прямоугольника)
  }

  // Специфичный текст выноски для тройника
  getCalloutText() {
    return `${this.name}\nШирина: ${this.width} мм\nТип: тройник\nСечение: ${(150 * this.width / 1000000).toFixed(2)} м²`;
  }

  // Фиксированная длина тройника (горизонтальный размер)
  getLength() {
    return 150;
  }
  getRelativeCalloutEntryPoint() {
    return { x: this.getWidth() / 2 + this.getWidth() * 0.35, y: this.getHeight() / 2 - this.getHeight() * 0.2 };
  }
  // Фиксированная высота тройника (вертикальный размер)
  getHeight() {
    return 100;
  }

  // Для совместимости с базовым классом
  getWidth() {
    return this.getLength();
  }

  getParameters() {
    return [
      { name: 'width', label: 'Ширина воздуховода', type: 'number', step: 10, min: 20, value: this.width, unit: 'мм' },
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getLength() / 2;
    const centerY = this.y + this.getHeight() / 2;

    // Левый порт (вход) - на левом конце горизонтальной трубы
    const inletPos = this.rotatePoint(
      this.x,
      centerY,
      centerX, centerY,
      rotation
    );
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id,
      'inlet',
      'left',
      0,
      this.getHeight() / 2,
      inletPos.x,
      inletPos.y
    ));

    // Правый порт (выход) - на правом конце горизонтальной трубы
    const outletPos = this.rotatePoint(
      this.x + this.getLength(),
      centerY,
      centerX, centerY,
      rotation
    );
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id,
      'outlet',
      'right',
      this.getLength(),
      this.getHeight() / 2,
      outletPos.x,
      outletPos.y
    ));

    // Нижний порт (ответвление) - в самом низу отростка
    // Отросток начинается на Y = centerY + this.width / 2 и имеет высоту 50px
    const branchStartY = centerY + this.width / 2;
    const branchBottomY = branchStartY + 50; // низ отростка
    const branchCenterX = this.x + this.getLength() / 2;

    const branchPos = this.rotatePoint(
      branchCenterX,
      branchBottomY,
      centerX, centerY,
      rotation
    );
    ports.push(new Port(
      this.ports.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id,
      'branch',
      'bottom',
      this.getLength() / 2,
      branchBottomY - this.y, // относительная Y координата
      branchPos.x,
      branchPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected, isDarkTheme) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getLength() / 2;
    const centerY = this.y + this.getHeight() / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // Рисуем горизонтальный прямоугольник (длина 150, высота = this.width)
    ctx.beginPath();
    ctx.rect(this.x, centerY - this.width / 2, this.getLength(), this.width);

    // Рисуем отросток (вертикальный прямоугольник высотой 50px, шириной = this.width)
    ctx.rect(centerX - this.width / 2, centerY + this.width / 2, this.width, 50);

    // Заливка цветом
    if (isSelected) {
      ctx.fillStyle = '#ffeb3b'; // Желтый фон при выделении
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fill();

    // Обводка
    ctx.strokeStyle = isSelected ? '#ff0000' : '#666';
    ctx.lineWidth = isSelected ? Math.max(1, 2 / scale) : (1 / scale);
    ctx.stroke();

    // Текст элемента
    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${Math.max(8, 12 / scale)}px Arial`;
    ctx.fillText(this.getElementText(), this.x + 5, this.y + 20 / scale);
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.getLength() / 2;
    const centerY = this.y + this.getHeight() / 2;

    // Преобразуем координаты в локальную систему координат элемента (без поворота)
    let localX = worldX;
    let localY = worldY;

    if (rotation !== 0) {
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      const angle = -rotation * Math.PI / 180;
      localX = dx * Math.cos(angle) - dy * Math.sin(angle) + centerX;
      localY = dx * Math.sin(angle) + dy * Math.cos(angle) + centerY;
    }

    // Проверяем попадание в горизонтальную трубу
    const inHorizontal = localX >= this.x &&
      localX <= this.x + this.getLength() &&
      localY >= centerY - this.width / 2 &&
      localY <= centerY + this.width / 2;

    // Проверяем попадание в вертикальный отросток (начинается после горизонтальной трубы)
    const inBranch = localX >= centerX - this.width / 2 &&
      localX <= centerX + this.width / 2 &&
      localY >= centerY + this.width / 2 &&
      localY <= centerY + this.width / 2 + 50;

    return inHorizontal || inBranch;
  }

  toJSON() {
    return { ...super.toJSON(), width: this.width, length: this.getLength(), height: this.getHeight() };
  }
}

// ========== КЛАСС ФАБРИКИ ЭЛЕМЕНТОВ ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    switch (type) {
      case 'duct': return new DuctDirect(id, x, y, params.length || 200, params.width || 100);
      case 'fan': return new Fan(id, x, y, params.diameter || 120);
      case 'tee': return new Tee(id, x, y, params.width || 150, params.height || 150);
      default: throw new Error(`Unknown element type: ${type}`);
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
      const callout = new Callout(c.id, c.elementId, c.text, c.x, c.y,
        c.relativeAnchorX || 0.5, c.relativeAnchorY || 0.5);
      return callout;
    }) || [];
    return element;
  }
}


// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements) {
    super(id, 'group', 0, 0, `Группа ${id}`, '#9e9e9e');
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
