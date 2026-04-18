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
    // ИЗМЕНЕНИЕ: массив соединений вместо одного
    this.connections = []; // [{ connectedElementId, connectedPortId }]
    this.radius = 5;
  }

  isConnected() {
    return this.connections.length > 0;
  }

  getConnectionCount() {
    return this.connections.length;
  }

  addConnection(elementId, portId) {
    // Проверяем, нет ли уже такого соединения
    if (!this.connections.find(c => c.connectedElementId === elementId && c.connectedPortId === portId)) {
      this.connections.push({ connectedElementId: elementId, connectedPortId: portId });
    }
  }

  removeConnection(elementId, portId) {
    this.connections = this.connections.filter(
      c => !(c.connectedElementId === elementId && c.connectedPortId === portId)
    );
  }

  removeAllConnections() {
    this.connections = [];
  }

  getConnections() {
    return [...this.connections];
  }

  // Для обратной совместимости (если где-то используется старое поле)
  get connectedElementId() {
    return this.connections.length > 0 ? this.connections[0].connectedElementId : null;
  }

  set connectedElementId(value) {
    // Для обратной совместимости - устанавливаем первое соединение
    if (value === null) {
      this.connections = [];
    } else if (this.connections.length === 0) {
      this.connections.push({ connectedElementId: value, connectedPortId: null });
    } else {
      this.connections[0].connectedElementId = value;
    }
  }

  get connectedPortId() {
    return this.connections.length > 0 ? this.connections[0].connectedPortId : null;
  }

  set connectedPortId(value) {
    if (this.connections.length === 0) {
      this.connections.push({ connectedElementId: null, connectedPortId: value });
    } else {
      this.connections[0].connectedPortId = value;
    }
  }

  disconnect() {
    this.connections = [];
  }

  disconnectFrom(portId) {
    this.connections = this.connections.filter(c => c.connectedPortId !== portId);
  }

  connectTo(port) {
    this.addConnection(port.elementId, port.id);
  }

  getDirectionName() {
    return 'Порт';
  }

  updateWorldPosition(centerX, centerY, rotation, pointX, pointY) {
    const angleRad = rotation * Math.PI / 180;
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    this.worldX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX;
    this.worldY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY;
  }


  getRadius(scale, mmPerPx, isHighlighted = false, highlightScale = 1.5) {
    // Физический размер порта в миллиметрах (36 мм - это примерно 1.5 дюйма)
    const portSizeMm = 36;

    // Переводим миллиметры в пиксели при текущем масштабе мм/пиксель
    let radiusPx = (portSizeMm / mmPerPx) / 2;

    // Применяем масштаб отображения (zoom)
    let radius = radiusPx / scale;

    // Ограничиваем минимальный и максимальный размер на экране
    const minScreenRadius = 2;
    const maxScreenRadius = 4;
    radius = Math.min(maxScreenRadius, Math.max(minScreenRadius, radius));

    // Если порт подсвечен - увеличиваем размер
    if (isHighlighted) {
      radius *= highlightScale;
    }

    return radius;
  }

  getColor(isHighlighted = false) {
    if (isHighlighted) return '#ff00ff';
    const connectionCount = this.connections?.length || 0;
    if (connectionCount === 0) return '#888888';
    if (connectionCount === 1) return '#00cc00'; // Зеленый
    if (connectionCount === 2) return '#ffaa00'; // Оранжевый
    return '#ff0000'; // Красный для 3+ (нагрузка)
  }

  draw(ctx, scale, mmPerPx, isDarkTheme, isHighlighted = false) {
    if (this.worldX === undefined || this.worldY === undefined) return;

    const radius = this.getRadius(scale, mmPerPx, isHighlighted);
    const color = this.getColor(isHighlighted);

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.worldX, this.worldY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();

    // Если больше одного соединения - рисуем маленькую цифру
    if (this.connections.length > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(8, radius)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.connections.length.toString(), this.worldX, this.worldY);
    }

    ctx.restore();
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
      connections: this.connections.map(c => ({ ...c })), // Сохраняем все соединения
      radius: this.radius
    };
  }
}
