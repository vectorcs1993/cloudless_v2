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

  endSelectionRect() {
    this.selectionRect = null;
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
