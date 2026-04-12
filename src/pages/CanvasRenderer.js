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
    const width = element.getWidth();
    const height = element.getHeight();
    const centerX = element.x;
    const centerY = element.y;

    // Половина размера элемента
    const halfW = width / 2;
    const halfH = height / 2;

    // Проверка пересечения bounding box элемента с видимой областью
    return !(centerX + halfW < this.visibleBounds.minX ||
      centerX - halfW > this.visibleBounds.maxX ||
      centerY + halfH < this.visibleBounds.minY ||
      centerY - halfH > this.visibleBounds.maxY);
  }

  // Проверка, видна ли выноска
  isCalloutVisible(callout, element) {
    return !(callout.x < this.visibleBounds.minX - 100 ||
      callout.x > this.visibleBounds.maxX + 100 ||
      callout.y < this.visibleBounds.minY - 50 ||
      callout.y > this.visibleBounds.maxY + 50);
  }

  draw() {
    if (!this.canvas || !this.canvas.getContext) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

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

    this.drawInfo(ctx, drawnCount, visibleElements.length);

    // Рисуем призрак
    if (this.ghostElement) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      try {
        this.ghostElement.draw(ctx, this.scale.value, false, this.options.isDarkTheme.value,
          this.options.showPorts.value, this.options.showColors.value,
          this.options.showElementAxes.value);
      } catch (err) {
        console.warn('Error drawing ghost element:', err);
      }
      ctx.restore();
    }

    ctx.restore();

    if (this.selectionRect) {
      this.drawSelectionRect(ctx);
    }
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

  getPortRadius(port, isHighlighted = false) {
    const mmPerPx = this.options.mmPerPx?.value || 2;
    const portSizeMm = 15;
    let radiusPx = (portSizeMm / mmPerPx) / 2;
    let radius = radiusPx / this.scale.value;
    const minScreenRadius = 3;
    const maxScreenRadius = 12;
    radius = Math.min(maxScreenRadius, Math.max(minScreenRadius, radius));
    if (isHighlighted) {
      radius *= this.portSettings.highlightScale;
    }
    return radius;
  }

  getPortColor(isHighlighted = false) {
    if (isHighlighted) return '#ff00ff';
    return '#888888';
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? elements : [elements];
  }

  setHighlightedElements(elements) {
    this.highlightedElements = Array.isArray(elements) ? elements : [elements];
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
      if (this.isElementVisible(element) && element.ports?.length) {
        allPorts.push(...element.ports);
      }
    }

    for (const port of allPorts) {
      if (port.worldX === undefined || port.worldY === undefined) continue;

      // Проверяем, виден ли порт на экране
      if (port.worldX < this.visibleBounds.minX - 50 ||
        port.worldX > this.visibleBounds.maxX + 50 ||
        port.worldY < this.visibleBounds.minY - 50 ||
        port.worldY > this.visibleBounds.maxY + 50) {
        continue;
      }

      // Просто рисуем порт через его собственный метод
      port.draw(ctx, this.scale.value, this.options.isDarkTheme.value);
    }
  }

  drawCallouts(ctx) {
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
              callout.draw(ctx, this.scale.value, this.options.isDarkTheme.value, element);
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
    ctx.fillText('Панорама: x: ' + this.panX.value.toFixed(2) + ' y: ' + this.panY.value.toFixed(2), 10, 50);
    ctx.fillText(`Элементов: ${drawnCount} / ${totalCount} (видимых)`, 10, 70);

    if (this.options.showPorts.value) {
      let connectedCount = 0;
      let totalPorts = 0;

      const visibleElements = this.getVisibleElements();
      for (const element of visibleElements) {
        if (this.isElementVisible(element) && element.ports?.length) {
          totalPorts += element.ports.length;
          connectedCount += element.ports.filter(p => p.isConnected?.()).length;
        }
      }
      ctx.fillText(`Портов: ${connectedCount}/${totalPorts} подключено`, 10, 90);
    }

    if (this.layers?.value) {
      ctx.fillText(`Слоёв: ${this.layers.value.length}`, 10, 110);
    }

    ctx.restore();
  }

  updatePortSettings(settings) {
    this.portSettings = { ...this.portSettings, ...settings };
  }
}
