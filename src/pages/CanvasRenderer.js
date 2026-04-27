export class CanvasRenderer {
  constructor(canvas, layers, options) {
    this.canvas = canvas;
    this.layers = layers;
    this.options = options;
    this.scale = options.scale;
    this.panX = options.panX;
    this.panY = options.panY;
    this.selectedElements = [];
    this.highlightedElements = [];
    this.highlightedPort = null;
    this.selectionRect = null;
    this.tooltipPos = { x: 0, y: 0 };
    this.ghostElement = null;

    // Кэш видимой области
    this.visibleBounds = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };

    this.portSettings = {
      baseRadius: 3,
      minRadius: 1,
      maxRadius: 5,
      highlightScale: 1.5,
      borderWidth: 0,
    };

    this.transformGhostPoints = [];

        this.snapPoint = null;
    this.snapType = null;
  }

  setSnapPoint(point, type) {
    this.snapPoint = point;
    this.snapType = type;
  }

  setTransformGhostPoints(points) {
    this.transformGhostPoints = points || [];
  }


  drawTransformPreview(ctx) {
    if (!this.transformGhostPoints || this.transformGhostPoints.length < 2) return;

    ctx.save();

    const p1 = this.transformGhostPoints[0];
    const p2 = this.transformGhostPoints[1];

    // Рисуем основную линию (оранжевая, пунктирная)
    ctx.strokeStyle = '#ff6600';
    ctx.fillStyle = '#ff6600';
    ctx.lineWidth = 3 / this.scale.value;
    ctx.setLineDash([8 / this.scale.value, 6 / this.scale.value]);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Рисуем начальную точку (кружок)
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 6 / this.scale.value, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff6600';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / this.scale.value;
    ctx.stroke();

    // Рисуем конечную точку (кружок)
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 6 / this.scale.value, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff6600';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / this.scale.value;
    ctx.stroke();

    // Вычисляем длину
    const distancePx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const mmPerPx = this.options.mmPerPx?.value || 2;
    const snapLengthMm = this.options.snapLengthMm?.value || 50;

    const lengthMm = distancePx * mmPerPx;
    const snappedLengthMm = Math.round(lengthMm / snapLengthMm) * snapLengthMm;

    // Показываем длину рядом с серединой линии
    const fontSize = Math.max(10, 14 / this.scale.value);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = '#ff6600';
    ctx.setLineDash([]);

    const text = `${snappedLengthMm} мм`;
    const textWidth = ctx.measureText(text).width;
    const padding = 4 / this.scale.value;

    // Позиция текста - смещаем от середины линии
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Смещаем текст в зависимости от угла линии
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const offsetX = Math.cos(angle + Math.PI / 2) * 20 / this.scale.value;
    const offsetY = Math.sin(angle + Math.PI / 2) * 20 / this.scale.value;

    // Фон для текста
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      midX + offsetX - textWidth / 2 - padding,
      midY + offsetY - fontSize - padding,
      textWidth + padding * 2,
      fontSize + padding * 2
    );

    // Сам текст
    ctx.fillStyle = '#ff6600';
    ctx.fillText(text, midX + offsetX - textWidth / 2, midY + offsetY - padding);

    // Показываем маленькую подпись с шагом
    const hintText = `шаг ${snapLengthMm} мм`;
    const hintFontSize = Math.max(8, 10 / this.scale.value);
    ctx.font = `${hintFontSize}px Arial`;
    const hintWidth = ctx.measureText(hintText).width;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(
      midX + offsetX - hintWidth / 2 - padding,
      midY + offsetY,
      hintWidth + padding * 2,
      hintFontSize + padding * 2
    );

    ctx.fillStyle = '#ffaa66';
    ctx.fillText(hintText, midX + offsetX - hintWidth / 2, midY + offsetY + hintFontSize);

    ctx.setLineDash([]);
    ctx.restore();
  }

  setGhostElement(element) {
    this.ghostElement = element;
  }

  clearGhostElement() {
    this.ghostElement = null;
  }

  getVisibleElements() {
    if (!this.layers?.value) return [];
    const result = [];
    for (const layer of this.layers.value) {
      if (layer.visible) {
        result.push(...layer.elements);
      }
    }
    return result;
  }

  // Проверка, видим ли элемент (с учётом его размера)
  isElementVisible(element) {
    // Получаем bounding box элемента в мировых координатах
    const topLeft = element.getTopLeft();
    const width = element.getWidth();
    const height = element.getHeight();

    // Учитываем поворот: bounding box может стать больше, поэтому просто используем прямоугольник,
    // но для повёрнутых элементов лучше расширить проверку. Сделаем запас.
    const margin = 100; // дополнительный запас в пикселях (мировых)
    const minX = topLeft.x - margin;
    const minY = topLeft.y - margin;
    const maxX = topLeft.x + width + margin;
    const maxY = topLeft.y + height + margin;

    return !(maxX < this.visibleBounds.minX ||
      minX > this.visibleBounds.maxX ||
      maxY < this.visibleBounds.minY ||
      minY > this.visibleBounds.maxY);
  }

  isCalloutVisible(callout, element) {
    return !(callout.x < this.visibleBounds.minX - 100 ||
      callout.x > this.visibleBounds.maxX + 100 ||
      callout.y < this.visibleBounds.minY - 50 ||
      callout.y > this.visibleBounds.maxY + 50);
  }

  // ОБНОВЛЕНИЕ ВИДИМОЙ ОБЛАСТИ
  updateVisibleBounds() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(rect.width, rect.height);

    // Расширяем границы в зависимости от масштаба (чем больше зум, тем больше запас)
    const margin = 500 / this.scale.value; // запас 500 пикселей в мировых координатах
    this.visibleBounds = {
      minX: Math.min(topLeft.x, bottomRight.x) - margin,
      minY: Math.min(topLeft.y, bottomRight.y) - margin,
      maxX: Math.max(topLeft.x, bottomRight.x) + margin,
      maxY: Math.max(topLeft.y, bottomRight.y) + margin
    };
  }

  draw() {
    if (!this.canvas || !this.canvas.getContext) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Обновляем видимую область перед отрисовкой
    this.updateVisibleBounds();

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.panX.value, this.panY.value);
    ctx.scale(this.scale.value, this.scale.value);

    if (this.options.showGrid.value) {
      this.drawGrid(ctx);
    }

    this.drawAxes(ctx);

    // Рисуем только видимые элементы
    const visibleElements = this.getVisibleElements();
    let drawnCount = 0;

    for (const element of visibleElements) {
      if (this.isElementVisible(element)) {
        const isSelected = this.selectedElements.some(sel => sel && sel.id === element.id);
        const isHighlighted = this.highlightedElements.some(sel => sel && sel.id === element.id);
        try {
          element.draw(ctx, this.scale.value, isSelected, isHighlighted, this.options.isDarkTheme.value,
            this.options.showPorts.value, this.options.showColors.value,
            this.options.showElementAxes.value);
          drawnCount++;
        } catch (err) {
          console.warn('Error drawing element:', element.id, err);
        }
      }
    }

    // Рисуем порты только для видимых элементов
    if (this.options.showPorts.value) {
      this.drawPorts(ctx);
    }

    // Рисуем выноски только для видимых элементов
    if (this.options.showCallouts.value) {
      this.drawCallouts(ctx);
    }

    this.drawInfo(ctx);

    // Рисуем призрак
    if (this.ghostElement) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      try {
        this.ghostElement.draw(ctx, this.scale.value, false, false, this.options.isDarkTheme.value,
          this.options.showPorts.value, this.options.showColors.value,
          this.options.showElementAxes.value);
      } catch (err) {
        console.warn('Error drawing ghost element:', err);
      }
      ctx.restore();
    }

    if (this.traceGhostPoints && this.traceGhostPoints.length > 1) {
      this.drawTracePreview(ctx);
    }

    if (this.transformGhostPoints && this.transformGhostPoints.length > 1) {
      this.drawTransformPreview(ctx);
    }

    ctx.restore();

 if (this.snapPoint && this.snapType) {
      this.drawSnapIndicator(ctx, this.snapPoint, this.snapType, this.scale.value);
    }

    if (this.selectionRect) {
      this.drawSelectionRect(ctx);
    }
  }
drawSnapIndicator(ctx, snapPoint, snapType, scale) {
    if (!snapPoint) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const screenPos = this.worldToScreen(snapPoint.x, snapPoint.y);
    const size = 20;
    const lineWidth = 2;

    if (snapType === 'port') {
      // Кружок для порта (зеленый)
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 12, 0, 2 * Math.PI);
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Внутренний кружок
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      // Анимация пульсации (опционально)
      const pulse = Date.now() % 1000 / 1000;
      const extraRadius = 4 * pulse;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 16 + extraRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.stroke();

    } else if (snapType === 'grid') {
      // Перекрестие для сетки (желтое)
      ctx.beginPath();
      // Горизонтальная линия
      ctx.moveTo(screenPos.x - size, screenPos.y);
      ctx.lineTo(screenPos.x - size/3, screenPos.y);
      ctx.moveTo(screenPos.x + size/3, screenPos.y);
      ctx.lineTo(screenPos.x + size, screenPos.y);

      // Вертикальная линия
      ctx.moveTo(screenPos.x, screenPos.y - size);
      ctx.lineTo(screenPos.x, screenPos.y - size/3);
      ctx.moveTo(screenPos.x, screenPos.y + size/3);
      ctx.lineTo(screenPos.x, screenPos.y + size);

      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Центральная точка
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffff00';
      ctx.fill();
    }

    ctx.restore();
  }

  drawSelectionRect(ctx) {
    if (!this.selectionRect) return;

    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const x = Math.min(this.selectionRect.startX, this.selectionRect.endX);
    const y = Math.min(this.selectionRect.startY, this.selectionRect.endY);
    const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
    const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);

    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
    ctx.restore();
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? elements : (elements ? [elements] : []);
  }

  setHighlightedElements(elements) {
    this.highlightedElements = Array.isArray(elements) ? elements : (elements ? [elements] : []);
  }

  clearHighlightedElements() {
    this.highlightedElements = [];
  }

  setHighlightedPort(port) {
    this.highlightedPort = port;
  }

  startSelectionRect(x, y) {
    this.selectionRect = { startX: x, startY: y, endX: x, endY: y };
  }

  updateSelectionRect(x, y) {
    if (this.selectionRect) {
      this.selectionRect.endX = x;
      this.selectionRect.endY = y;
    }
  }
  centerOnElement(element, canvasWidth, canvasHeight) {
    if (!element || !canvasWidth || !canvasHeight) return;
    this.options.panX.value = canvasWidth / 2 - element.x * this.options.scale.value;
    this.options.panY.value = canvasHeight / 2 - element.y * this.options.scale.value;
    this.draw();
  }
  drawTracePreview(ctx) {
    if (!this.traceGhostPoints || this.traceGhostPoints.length < 2) return;

    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = '#00ff00';
    ctx.lineWidth = 2 / this.scale.value;
    ctx.setLineDash([5 / this.scale.value, 5 / this.scale.value]);

    // Рисуем линии
    for (let i = 0; i < this.traceGhostPoints.length - 1; i++) {
      const p1 = this.traceGhostPoints[i];
      const p2 = this.traceGhostPoints[i + 1];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Рисуем конечную точку
    const lastPoint = this.traceGhostPoints[this.traceGhostPoints.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 5 / this.scale.value, 0, 2 * Math.PI);
    ctx.fill();

    // ПОКАЗЫВАЕМ ДЛИНУ РЯДОМ С КУРСОРОМ
    if (this.traceGhostPoints.length >= 2) {
      const p1 = this.traceGhostPoints[this.traceGhostPoints.length - 2];
      const p2 = this.traceGhostPoints[this.traceGhostPoints.length - 1];

      // Длина в пикселях
      const distancePx = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      // Переводим в миллиметры
      const mmPerPx = this.options.mmPerPx?.value || 2;
      const lengthMm = distancePx * mmPerPx;

      // Рисуем текст ПРЯМО НАД КУРСОРОМ (в конце линии)
      const fontSize = Math.max(10, 14 / this.scale.value);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = '#00ff00';
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      const text = `${Math.round(lengthMm)} мм`;
      const textWidth = ctx.measureText(text).width;
      const padding = 4 / this.scale.value;

      // Позиция рядом с курсором (смещаем вверх и в сторону)
      const offsetX = 15 / this.scale.value;
      const offsetY = -20 / this.scale.value;

      // Фон для текста
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(
        p2.x + offsetX - padding,
        p2.y + offsetY - fontSize - padding,
        textWidth + padding * 2,
        fontSize + padding * 2
      );

      ctx.fillStyle = '#00ff00';
      ctx.fillText(text, p2.x + offsetX, p2.y + offsetY);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }
  endSelectionRect() {
    this.selectionRect = null;
  }

  screenToWorld(screenX, screenY) {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    return {
      x: (canvasX - this.panX.value) / this.scale.value,
      y: (canvasY - this.panY.value) / this.scale.value
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.scale.value + this.panX.value,
      y: worldY * this.scale.value + this.panY.value
    };
  }

  drawGrid(ctx) {
    const gridStepWorld = this.options.gridStepM?.value || 50;
    const width = this.canvas.width / this.scale.value;
    const height = this.canvas.height / this.scale.value;
    const startX = -this.panX.value / this.scale.value;
    const startY = -this.panY.value / this.scale.value;

    ctx.save();
    ctx.strokeStyle = this.options.isDarkTheme.value ? '#444' : '#ddd';
    ctx.lineWidth = 0.5 / this.scale.value;

    const firstX = Math.floor(startX / gridStepWorld) * gridStepWorld;
    for (let x = firstX; x < startX + width; x += gridStepWorld) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + height);
      ctx.stroke();
    }

    const firstY = Math.floor(startY / gridStepWorld) * gridStepWorld;
    for (let y = firstY; y < startY + height; y += gridStepWorld) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAxes(ctx) {
    const startX = -this.panX.value / this.scale.value;
    const startY = -this.panY.value / this.scale.value;
    const endX = startX + this.canvas.width / this.scale.value;
    const endY = startY + this.canvas.height / this.scale.value;

    ctx.beginPath();
    ctx.strokeStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    ctx.lineWidth = Math.max(1, 1.5 / this.scale.value);
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(0, endY);
    ctx.stroke();

    const arrowSize = 8 / this.scale.value;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX - arrowSize, -arrowSize / 2);
    ctx.lineTo(endX - arrowSize, arrowSize / 2);
    ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, endY);
    ctx.lineTo(-arrowSize / 2, endY - arrowSize);
    ctx.lineTo(arrowSize / 2, endY - arrowSize);
    ctx.fill();

    ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    ctx.font = `${Math.max(10, 12 / this.scale.value)}px Arial`;
    ctx.fillText('X', endX - 15 / this.scale.value, -5 / this.scale.value);
    ctx.fillText('Y', 5 / this.scale.value, endY - 5 / this.scale.value);
  }

drawPorts(ctx) {
    const allPorts = [];
    const visibleElements = this.getVisibleElements();

    for (const element of visibleElements) {
      // Убираем проверку element.type !== 'fitting'
      if (this.isElementVisible(element) && element.ports?.length) {
        allPorts.push(...element.ports);
      }
    }

    for (const port of allPorts) {
      if (port.worldX === undefined || port.worldY === undefined) continue;

      const isHighlighted = this.highlightedPort === port;
      port.draw(ctx, this.scale.value, this.options.mmPerPx?.value || 2,
        this.options.isDarkTheme.value, isHighlighted);
    }
}

  drawCallouts(ctx) {
    // Если активен режим рисования - не рисуем выноски (или рисуем полупрозрачными)
    const isTraceActive = this.options.traceActive?.value;

    const visibleElements = this.getVisibleElements();
    for (const element of visibleElements) {
      if (!this.isElementVisible(element)) continue;

      if (element.callouts?.length && element.showCallout) {
        if (element.updateCalloutText) {
          element.updateCalloutText();
        }

        for (const callout of element.callouts) {
          if (this.isCalloutVisible(callout, element)) {
            try {
              if (isTraceActive) {
                ctx.save();
                ctx.globalAlpha = 0.3; // Полупрозрачные при рисовании
              }
              callout.draw(ctx, this.scale.value, this.options.isDarkTheme.value, element);
              if (isTraceActive) ctx.restore();
            } catch (err) {
              console.warn('Error drawing callout:', err);
            }
          }
        }
      }
    }
  }

  drawInfo(ctx, drawnCount, totalCount) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const isDark = this.options.isDarkTheme.value;
    ctx.fillStyle = isDark ? '#fff' : '#000';
    ctx.font = '14px Arial';
    ctx.fillText('Масштаб: ' + this.scale.value.toFixed(2) + 'x', 10, 30);

    ctx.restore();
  }

  updatePortSettings(settings) {
    this.portSettings = { ...this.portSettings, ...settings };
  }

  setTraceGhostPoints(points) {
    this.traceGhostPoints = points;
  }
}
