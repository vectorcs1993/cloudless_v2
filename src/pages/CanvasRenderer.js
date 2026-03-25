// ========== КЛАСС РЕНДЕРЕРА ==========
export class CanvasRenderer {
  constructor(canvas, elements, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.elements = elements;
    this.options = options;
    this.selectedElement = null;
    this.highlightedPort = null;
    this.draggingCallout = null;
  }

  getSelectedElement() {
    return this.selectedElement;
  }

  setSelectedElement(element) {
    this.selectedElement = element;
  }

  setHighlightedPort(port) {
    this.highlightedPort = port;
  }

  draw() {
    if (!this.ctx) return;
    this.updateCanvasSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.options.panX.value, this.options.panY.value);
    this.ctx.scale(this.options.scale.value, this.options.scale.value); // <- здесь применяется масштаб

    this.drawGrid();
    this.drawAxes();
    this.drawElements(); // <- элементы рисуются с учетом scale
    this.drawPorts(); // <- порты рисуются с учетом scale
    this.drawCallouts();  // <- выноски рисуются с учетом scale

    this.ctx.restore();
    this.drawInfo();
  }

  updateCanvasSize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  drawGrid() {
    if (!this.options.showGrid.value) return;
    const step = this.options.gridStepM.value * this.options.pixelsPerMeter.value;
    if (step <= 5) return;
    const startX = Math.floor(-this.options.panX.value / this.options.scale.value / step) * step;
    const startY = Math.floor(-this.options.panY.value / this.options.scale.value / step) * step;
    const endX = startX + this.canvas.width / this.options.scale.value + step;
    const endY = startY + this.canvas.height / this.options.scale.value + step;

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.isDarkTheme.value ? '#444' : '#ddd';
    this.ctx.lineWidth = 0.5 / this.options.scale.value;
    for (let x = startX; x < endX; x += step) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += step) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
  }

  drawAxes() {
    const startX = -this.options.panX.value / this.options.scale.value;
    const startY = -this.options.panY.value / this.options.scale.value;
    const endX = startX + this.canvas.width / this.options.scale.value;
    const endY = startY + this.canvas.height / this.options.scale.value;

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.lineWidth = Math.max(1, 1.5 / this.options.scale.value);
    this.ctx.moveTo(startX, 0);
    this.ctx.lineTo(endX, 0);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(0, startY);
    this.ctx.lineTo(0, endY);
    this.ctx.stroke();

    const arrowSize = 8 / this.options.scale.value;
    this.ctx.beginPath();
    this.ctx.moveTo(endX, 0);
    this.ctx.lineTo(endX - arrowSize, -arrowSize / 2);
    this.ctx.lineTo(endX - arrowSize, arrowSize / 2);
    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(0, endY);
    this.ctx.lineTo(-arrowSize / 2, endY - arrowSize);
    this.ctx.lineTo(arrowSize / 2, endY - arrowSize);
    this.ctx.fill();

    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.font = `${Math.max(10, 12 / this.options.scale.value)}px Arial`;
    this.ctx.fillText('X', endX - 15 / this.options.scale.value, -5 / this.options.scale.value);
    this.ctx.fillText('Y', 5 / this.options.scale.value, endY - 5 / this.options.scale.value);
  }

  drawElements() {
    this.elements.value.forEach(element => {
      element.draw(
        this.ctx,
        this.options.scale.value,
        this.selectedElement?.id === element.id,
        this.options.isDarkTheme.value
      );
    });
  }

  drawPorts() {
    if (!this.options.showPorts.value) return;
    const allPorts = [];
    this.elements.value.forEach(el => { if (el.ports) allPorts.push(...el.ports); });

    allPorts.forEach(port => {
      const isHighlighted = this.highlightedPort?.id === port.id;
      const isConnected = port.isConnected();

      this.ctx.save();
      if (isHighlighted) {
        this.ctx.fillStyle = '#ff6600';
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = '#ff6600';
      } else if (isConnected) {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#ffaa00';
      } else {
        this.ctx.fillStyle = '#00ff00';
        this.ctx.shadowBlur = 0;
      }

      // Используем фиксированный радиус порта - canvas масштабирует его автоматически
      const portSize = port.radius;
      this.ctx.beginPath();
      this.ctx.arc(port.worldX, port.worldY, portSize, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  drawCallouts() {
    if (!this.options.showCallouts.value) return;

    this.elements.value.forEach(element => {
      element.callouts.forEach(callout => {
        if (callout && callout.text) {
          // Передаем элемент в метод draw
          callout.draw(
            this.ctx,
            this.options.scale.value,
            this.options.isDarkTheme.value,
            element // Передаем элемент целиком
          );
        }
      });
    });
  }

  drawInfo() {
    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#fff' : '#000';
    this.ctx.font = '14px Arial';
    this.ctx.fillText('Масштаб: ' + this.options.scale.value.toFixed(2) + 'x', 50, 50);
    if (this.options.mouseWorldPos?.value) {
      this.ctx.fillText('X, Y: ' + this.options.mouseWorldPos.value.x.toFixed(2) + ', ' +
        this.options.mouseWorldPos.value.y.toFixed(2), 50, 70);
    }
    if (this.highlightedPort) {
      this.ctx.fillStyle = '#00ff00';
      this.ctx.fillText('Порт: ' + this.highlightedPort.side + ' (' +
        this.highlightedPort.getDirectionName() + ')', 50, 110);
    }
    if (this.draggingCallout) {
      this.ctx.fillStyle = '#ff6600';
      this.ctx.fillText('Перемещение выноски...', 50, 130);
    }
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.options.panX.value) / this.options.scale.value,
      y: (screenY - rect.top - this.options.panY.value) / this.options.scale.value
    };
  }
}
