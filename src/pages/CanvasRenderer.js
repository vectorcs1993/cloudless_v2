// CanvasRenderer.js
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

  endSelectionRect() {
    if (this.selectionRect) {
      const rect = {
        minX: Math.min(this.selectionRect.startX, this.selectionRect.endX),
        minY: Math.min(this.selectionRect.startY, this.selectionRect.endY),
        maxX: Math.max(this.selectionRect.startX, this.selectionRect.endX),
        maxY: Math.max(this.selectionRect.startY, this.selectionRect.endY)
      };

      // Преобразуем экранные координаты прямоугольника в мировые
      const worldRect = {
        minX: (rect.minX - this.panX.value) / this.scale.value,
        minY: (rect.minY - this.panY.value) / this.scale.value,
        maxX: (rect.maxX - this.panX.value) / this.scale.value,
        maxY: (rect.maxY - this.panY.value) / this.scale.value
      };

      // Находим все элементы в прямоугольнике
      const selected = this.elements.value.filter(element => {
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
    // Получаем контекст canvas
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();

    // Устанавливаем размеры canvas
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Очищаем canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Сохраняем состояние контекста
    ctx.save();

    // Применяем масштаб и панорамирование для всего контента
    ctx.translate(this.panX.value, this.panY.value);
    ctx.scale(this.scale.value, this.scale.value);

    // Рисуем сетку
    if (this.options.showGrid.value) {
      this.drawGrid(ctx);
    }

    // Рисуем все элементы
    this.elements.value.forEach(element => {
      const isSelected = this.selectedElements.some(sel => sel.id === element.id);
      element.draw(ctx, this.scale.value, isSelected, this.options.isDarkTheme.value);
    });


    this.drawAxes(ctx);

    // Рисуем порты (в мировых координатах, без дополнительных трансформаций)
    if (this.options.showPorts.value) {
      this.drawPorts(ctx);
    }

    // Рисуем выноски (в мировых координатах, без дополнительных трансформаций)
    if (this.options.showCallouts.value) {
      this.drawCallouts(ctx);
    }

    this.drawInfo(ctx);

    // Восстанавливаем состояние контекста (убираем трансформации)
    ctx.restore();

    // Рисуем прямоугольник выделения (в экранных координатах)
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
    // Используем pixelsPerMeter для определения шага сетки в пикселях
    const gridStepPx = 50; // Фиксированный шаг сетки в пикселях (50px)
    // Или можно сделать шаг зависимым от масштаба:
    // const gridStepPx = 50 / this.scale.value; // для постоянного размера в мировых координатах

    const width = this.canvas.width / this.scale.value;
    const height = this.canvas.height / this.scale.value;
    const startX = -this.panX.value / this.scale.value;
    const startY = -this.panY.value / this.scale.value;

    ctx.save();
    ctx.strokeStyle = this.options.isDarkTheme.value ? '#444' : '#ddd';
    ctx.lineWidth = 0.5 / this.scale.value;

    // Вертикальные линии
    const firstX = Math.floor(startX / gridStepPx) * gridStepPx;
    for (let x = firstX; x < startX + width; x += gridStepPx) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + height);
      ctx.stroke();
    }

    // Горизонтальные линии
    const firstY = Math.floor(startY / gridStepPx) * gridStepPx;
    for (let y = firstY; y < startY + height; y += gridStepPx) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + width, y);
      ctx.stroke();
    }

    ctx.restore();
  }


  drawAxes(ctx) {
    const startX = -this.options.panX.value / this.options.scale.value;
    const startY = -this.options.panY.value / this.options.scale.value;
    const endX = startX + this.canvas.width / this.options.scale.value;
    const endY = startY + this.canvas.height / this.options.scale.value;

    ctx.beginPath();
    ctx.strokeStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    ctx.lineWidth = Math.max(1, 1.5 / this.options.scale.value);
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(0, endY);
    ctx.stroke();

    const arrowSize = 8 / this.options.scale.value;
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
    ctx.font = `${Math.max(10, 12 / this.options.scale.value)}px Arial`;
    ctx.fillText('X', endX - 15 / this.options.scale.value, -5 / this.options.scale.value);
    ctx.fillText('Y', 5 / this.options.scale.value, endY - 5 / this.options.scale.value);
  }

  drawPorts(ctx) {
    // Получаем все порты из всех элементов, включая группы
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

    // Рисуем все собранные порты
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

  drawCallouts(ctx) {
    // Рисуем выноски в мировых координатах (трансформации уже применены)
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
    ctx.fillText('Панорама: ' + 'x: ' + this.panX.value.toFixed(2) + ' y: ' + this.panY.value.toFixed(2), 10, 50);
    ctx.restore();
  }
}
