export class CanvasRenderer {
  constructor(canvas, elements, options) {
    this.canvas = canvas;
    this.elements = elements;
    this.options = options;
    this.scale = options.scale;
    this.panX = options.panX;
    this.panY = options.panY;
    this.selectedElements = [];
    this.highlightedPort = null;
    this.selectionRect = null;
    this.tooltipPort = null;
    this.tooltipPos = { x: 0, y: 0 };
    this.tempCanvas = document.createElement('canvas'); // Временный canvas для hit testing
  }

  setTooltipPort(port, screenX, screenY) {
    this.tooltipPort = port;
    if (port) {
      this.tooltipPos = { x: screenX, y: screenY };
    }
  }

  clearTooltip() {
    this.tooltipPort = null;
  }

  updateTooltipPosition(screenX, screenY) {
    if (this.tooltipPort) {
      this.tooltipPos = { x: screenX, y: screenY };
    }
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? elements : [elements];
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

  // Проверка пересечения path элемента с прямоугольником выделения
  isElementIntersectsRect(element, worldRect) {
    // Создаем временный контекст для path
    const tempCtx = this.tempCanvas.getContext('2d');
    if (!tempCtx) return false;

    // Очищаем временный canvas
    this.tempCanvas.width = 1;
    this.tempCanvas.height = 1;

    // Получаем path элемента
    try {
      // Некоторые элементы создают path через createPath
      if (element.createPath) {
        element.createPath(tempCtx);
      } else {
        // Для элементов без createPath используем bounding box
        return this.isElementInSelectionRect(element, worldRect);
      }
    } catch (e) {
      return this.isElementInSelectionRect(element, worldRect);
    }

    // Проверяем углы прямоугольника на попадание в path
    const corners = [
      { x: worldRect.minX, y: worldRect.minY },
      { x: worldRect.maxX, y: worldRect.minY },
      { x: worldRect.maxX, y: worldRect.maxY },
      { x: worldRect.minX, y: worldRect.maxY }
    ];

    for (const corner of corners) {
      if (tempCtx.isPointInPath(corner.x, corner.y)) {
        return true;
      }
    }

    // Проверяем центр прямоугольника
    const center = {
      x: (worldRect.minX + worldRect.maxX) / 2,
      y: (worldRect.minY + worldRect.maxY) / 2
    };
    if (tempCtx.isPointInPath(center.x, center.y)) {
      return true;
    }

    // Проверяем точки на границах прямоугольника (для тонких элементов)
    const steps = 5; // Количество проверяемых точек на каждой стороне
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const topPoint = { x: worldRect.minX + t * (worldRect.maxX - worldRect.minX), y: worldRect.minY };
      const bottomPoint = { x: worldRect.minX + t * (worldRect.maxX - worldRect.minX), y: worldRect.maxY };
      const leftPoint = { x: worldRect.minX, y: worldRect.minY + t * (worldRect.maxY - worldRect.minY) };
      const rightPoint = { x: worldRect.maxX, y: worldRect.minY + t * (worldRect.maxY - worldRect.minY) };

      if (tempCtx.isPointInPath(topPoint.x, topPoint.y) ||
        tempCtx.isPointInPath(bottomPoint.x, bottomPoint.y) ||
        tempCtx.isPointInPath(leftPoint.x, leftPoint.y) ||
        tempCtx.isPointInPath(rightPoint.x, rightPoint.y)) {
        return true;
      }
    }

    return false;
  }

  // Проверка пересечения повернутого прямоугольника с областью выделения (запасной метод)
  isElementInSelectionRect(element, worldRect) {
    // Получаем углы элемента в мировых координатах
    const width = element.getWidth();
    const height = element.getHeight();
    const centerX = element.x + width / 2;
    const centerY = element.y + height / 2;
    const rotation = element.rotation || 0;

    // Углы элемента в локальных координатах (относительно центра)
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 }
    ];

    // Поворачиваем углы и преобразуем в мировые координаты
    const angleRad = rotation * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const worldCorners = corners.map(corner => ({
      x: centerX + corner.x * cos - corner.y * sin,
      y: centerY + corner.x * sin + corner.y * cos
    }));

    // Проверяем, пересекается ли хотя бы один угол с прямоугольником выделения
    let anyCornerInside = false;
    let allCornersInside = true;

    for (const corner of worldCorners) {
      const isInside = corner.x >= worldRect.minX && corner.x <= worldRect.maxX &&
        corner.y >= worldRect.minY && corner.y <= worldRect.maxY;
      if (isInside) anyCornerInside = true;
      else allCornersInside = false;
    }

    if (allCornersInside || anyCornerInside) return true;

    // Проверка пересечения ребер элемента с прямоугольником
    for (let i = 0; i < worldCorners.length; i++) {
      const p1 = worldCorners[i];
      const p2 = worldCorners[(i + 1) % worldCorners.length];
      if (this.lineIntersectsRect(p1, p2, worldRect)) {
        return true;
      }
    }

    return false;
  }

  lineIntersectsRect(p1, p2, rect) {
    const rectEdges = [
      { p1: { x: rect.minX, y: rect.minY }, p2: { x: rect.maxX, y: rect.minY } },
      { p1: { x: rect.maxX, y: rect.minY }, p2: { x: rect.maxX, y: rect.maxY } },
      { p1: { x: rect.maxX, y: rect.maxY }, p2: { x: rect.minX, y: rect.maxY } },
      { p1: { x: rect.minX, y: rect.maxY }, p2: { x: rect.minX, y: rect.minY } }
    ];

    for (const edge of rectEdges) {
      if (this.segmentsIntersect(p1, p2, edge.p1, edge.p2)) {
        return true;
      }
    }

    return false;
  }

  segmentsIntersect(a, b, c, d) {
    const orientation = (p, q, r) => {
      const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
      if (val === 0) return 0;
      return val > 0 ? 1 : 2;
    };

    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && this.onSegment(a, c, b)) return true;
    if (o2 === 0 && this.onSegment(a, d, b)) return true;
    if (o3 === 0 && this.onSegment(c, a, d)) return true;
    if (o4 === 0 && this.onSegment(c, b, d)) return true;

    return false;
  }

  onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }

  endSelectionRect() {
    if (this.selectionRect) {
      const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
      const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);

      const minSelectionSize = 5;
      if (width < minSelectionSize && height < minSelectionSize) {
        this.selectionRect = null;
        return;
      }

      const rect = {
        minX: Math.min(this.selectionRect.startX, this.selectionRect.endX),
        minY: Math.min(this.selectionRect.startY, this.selectionRect.endY),
        maxX: Math.max(this.selectionRect.startX, this.selectionRect.endX),
        maxY: Math.max(this.selectionRect.startY, this.selectionRect.endY)
      };

      const worldRect = {
        minX: (rect.minX - this.panX.value) / this.scale.value,
        minY: (rect.minY - this.panY.value) / this.scale.value,
        maxX: (rect.maxX - this.panX.value) / this.scale.value,
        maxY: (rect.maxY - this.panY.value) / this.scale.value
      };

      const selected = this.elements.value.filter(element => {
        // Для групп используем bounding box
        if (element.type === 'group') {
          const elementBounds = {
            minX: element.x,
            minY: element.y,
            maxX: element.x + element.getWidth(),
            maxY: element.y + element.getHeight()
          };
          return !(elementBounds.maxX < worldRect.minX ||
            elementBounds.minX > worldRect.maxX ||
            elementBounds.maxY < worldRect.minY ||
            elementBounds.minY > worldRect.maxY);
        }

        // Сначала быстрая проверка через bounding box (оптимизация)
        const elementBounds = {
          minX: element.x,
          minY: element.y,
          maxX: element.x + element.getWidth(),
          maxY: element.y + element.getHeight()
        };

        const bboxIntersects = !(elementBounds.maxX < worldRect.minX ||
          elementBounds.minX > worldRect.maxX ||
          elementBounds.maxY < worldRect.minY ||
          elementBounds.minY > worldRect.maxY);

        if (!bboxIntersects) return false;

        // Точная проверка через path элемента
        return this.isElementIntersectsRect(element, worldRect);
      });

      this.selectedElements = selected;
      this.selectionRect = null;
    }
  }

  screenToWorld(screenX, screenY) {
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

  draw() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.panX.value, this.panY.value);
    ctx.scale(this.scale.value, this.scale.value);

    if (this.options.showGrid.value) {
      this.drawGrid(ctx);
    }

    this.elements.value.forEach(element => {
      const isSelected = this.selectedElements.some(sel => sel.id === element.id);
      element.draw(ctx, this.scale.value, isSelected, this.options.isDarkTheme.value,
        this.options.showPorts.value, this.options.showColors.value,
        this.options.showElementAxes.value);
    });

    this.drawAxes(ctx);

    if (this.options.showPorts.value) {
      this.drawPorts(ctx);
    }

    if (this.options.showCallouts.value) {
      this.drawCallouts(ctx);
    }

    this.drawInfo(ctx);
    ctx.restore();

    if (this.tooltipPort) {
      this.drawTooltip(ctx);
    }

    if (this.selectionRect) {
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

    const collectPorts = (elements) => {
      for (const element of elements) {
        if (element.ports && element.ports.length > 0) {
          allPorts.push(...element.ports);
        }
        if (element.type === 'group' && element.elements) {
          collectPorts(element.elements);
        }
      }
    };

    collectPorts(this.elements.value);

    for (const port of allPorts) {
      if (port.worldX === undefined || port.worldY === undefined) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(port.worldX, port.worldY, port.radius || 5, 0, 2 * Math.PI);

      if (this.highlightedPort && this.highlightedPort.id === port.id) {
        ctx.fillStyle = '#ff00ff';
      } else if (port.isConnected()) {
        ctx.fillStyle = '#00ff00';
      } else {
        switch (port.direction) {
          case 'inlet':
            ctx.fillStyle = '#00aaff';
            break;
          case 'outlet':
            ctx.fillStyle = '#ffaa00';
            break;
          case 'branch':
            ctx.fillStyle = '#aa00ff';
            break;
          default:
            ctx.fillStyle = '#888888';
        }
      }

      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 / this.scale.value;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTooltip(ctx) {
    if (!this.tooltipPort) return;

    const port = this.tooltipPort;
    const element = this.elements.value.find(el => el.id === port.elementId);
    if (!element) return;

    const lines = [
      `Порт: ${port.getDirectionName()} (${port.side})`,
      `Статус: ${port.isConnected() ? '✓ Подключен' : '○ Не подключен'}`,
    ];

    if (port.isConnected()) {
      const connectedElement = this.elements.value.find(el => el.id === port.connectedElementId);
      if (connectedElement) {
        lines.push(`Связан с: ${connectedElement.name}`);
      }
    }

    const padding = 8;
    const fontSize = 12;
    const lineHeight = 16;
    const backgroundColor = this.options.isDarkTheme.value ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const textColor = this.options.isDarkTheme.value ? '#fff' : '#333';
    const borderColor = this.options.isDarkTheme.value ? '#666' : '#ccc';

    ctx.save();
    ctx.font = `${fontSize}px Arial`;

    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    let tooltipX = this.tooltipPos.x + 15;
    let tooltipY = this.tooltipPos.y + 15;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    if (tooltipX + boxWidth > canvasWidth) {
      tooltipX = this.tooltipPos.x - boxWidth - 15;
    }
    if (tooltipY + boxHeight > canvasHeight) {
      tooltipY = this.tooltipPos.y - boxHeight - 15;
    }

    tooltipX = Math.max(5, Math.min(tooltipX, canvasWidth - boxWidth - 5));
    tooltipY = Math.max(5, Math.min(tooltipY, canvasHeight - boxHeight - 5));

    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(tooltipX, tooltipY, boxWidth, boxHeight);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(tooltipX, tooltipY, boxWidth, boxHeight);

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
    });

    ctx.restore();
  }

  drawCallouts(ctx) {
    for (const element of this.elements.value) {
      if (element.callouts) {
        for (const callout of element.callouts) {
          callout.draw(ctx, this.scale.value, this.options.isDarkTheme.value, element);
        }
      }
    }
  }

  drawInfo(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const isDark = this.options.isDarkTheme.value;
    ctx.fillStyle = isDark ? '#fff' : '#000';
    ctx.font = '14px Arial';
    ctx.fillText('Масштаб: ' + this.scale.value.toFixed(2) + 'x', 10, 30);
    ctx.fillText('Панорама: x: ' + this.panX.value.toFixed(2) + ' y: ' + this.panY.value.toFixed(2), 10, 50);
    ctx.fillText('Элементов: ' + this.elements.value.length, 10, 70);
    ctx.restore();
  }
}
