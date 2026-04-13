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
    const portSizeMm = 36;
    let radiusPx = (portSizeMm / mmPerPx) / 2;
    let radius = radiusPx / scale;
    const minScreenRadius = 3;
    const maxScreenRadius = 36;
    radius = Math.min(maxScreenRadius, Math.max(minScreenRadius, radius));
    if (isHighlighted) {
      radius *= highlightScale;
    }
    return radius;
  }

  getColor(isHighlighted = false) {
    if (isHighlighted) return '#ff00ff';
    return '#888888';
  }

  // ОБНОВЛЕННЫЙ МЕТОД ОТРИСОВКИ
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
      connectedElementId: this.connectedElementId,
      connectedPortId: this.connectedPortId,
      radius: this.radius
    };
  }
}
