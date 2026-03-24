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
    // Убираем relativeAnchorX/Y, теперь они будут получаться из элемента
  }

  // Обновить точку привязки на основе элемента
  updateAnchorPoint(element) {
    // Получаем абсолютные координаты точки привязки из элемента
    const absolutePoint = element.getAbsoluteCalloutPoint();
    this.anchorPoint = { x: absolutePoint.x, y: absolutePoint.y };
  }

  updatePosition(newX, newY) {
    this.x = newX;
    this.y = newY;
  }

  hitTest(worldX, worldY, scale, element) {
    const padding = 8 / scale;
    const fontSize = 14 / scale;
    const lineHeight = 20 / scale;
    const lines = this.text.split('\n');
    const maxWidth = Math.max(...lines.map(l => l.length * fontSize * 0.6));
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    const handleRadius = 8 / scale;

    // Получаем относительную точку из элемента для определения позиции ручки
    const relativePoint = element.getCalloutEntryPoint();

    let handleX = this.x;
    let handleY = this.y + boxHeight / 2;

    // Определяем позицию ручки на основе относительной точки
    if (relativePoint.x <= 0.33) {
      handleX = this.x; // левая сторона
    } else if (relativePoint.x >= 0.67) {
      handleX = this.x + boxWidth; // правая сторона
    } else {
      handleX = this.x + boxWidth / 2; // центр
    }

    if (relativePoint.y <= 0.33) {
      handleY = this.y; // верх
    } else if (relativePoint.y >= 0.67) {
      handleY = this.y + boxHeight; // низ
    } else {
      handleY = this.y + boxHeight / 2; // центр
    }

    const inDragHandle = Math.hypot(worldX - handleX, worldY - handleY) < handleRadius;
    const inTextArea = worldX >= this.x && worldX <= this.x + boxWidth &&
      worldY >= this.y && worldY <= this.y + boxHeight;

    return { hit: inTextArea || inDragHandle, isHandle: inDragHandle };
  }

  draw(ctx, scale, isDarkTheme, element) {
    // Обновляем точку привязки из элемента
    this.updateAnchorPoint(element);

    const padding = 8 / scale;
    const fontSize = 14 / scale;
    const lineHeight = 20 / scale;

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
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    // Рисуем фон и рамку
    ctx.fillStyle = isDarkTheme ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(this.x, this.y, boxWidth, boxHeight);
    ctx.strokeStyle = isDarkTheme ? '#888' : '#333';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(this.x, this.y, boxWidth, boxHeight);

    // Рисуем текст
    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${fontSize}px Arial`;
    lines.forEach((line, i) => {
      ctx.fillText(line, this.x + padding, this.y + padding + (i + 0.8) * lineHeight);
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
      // relativeAnchorX/Y больше не нужны, так как определяются из элемента
    };
  }
}
