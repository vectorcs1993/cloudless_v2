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

    // Рисуем фон (заливка)
    ctx.fillStyle = isDarkTheme ? '#2d2d2d' : '#f9f9f9';
    ctx.fillRect(this.x, this.y, boxWidth, boxHeight);

    // Рисуем рамку
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
