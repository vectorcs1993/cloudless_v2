// Fitting.js - фитинг наследуется от DuctBase
import { DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class Fitting extends DuctBase {
  constructor(id, x, y, fittingType = 'elbow') {
    super(id, 'fitting', x, y, `Фитинг ${id}`, 'galvanized', 'round', 125, 100, 125);
    this.fittingType = fittingType;
    this._radius = 9;
    this._lineWidth = 2;
  }

  get a() { return null; }
  set a(value) { }

  get b() { return null; }
  set b(value) { }

  get c() { return null; }
  set c(value) { }

  getWidth() { return this._radius * 2; }
  getHeight() { return this._radius * 2; }

  getTopLeft() {
    return {
      x: this.x - this._radius,
      y: this.y - this._radius
    };
  }

  getCalloutText() {
    const types = {
      elbow: 'Отвод',
      tee: 'Тройник',
      cross: 'Крестовина',
      transition: 'Переход'
    };
    let text = `${types[this.fittingType] || this.fittingType}\n${this.name}`;

    const connectionCount = this.getConnectionCount();
    if (connectionCount > 0) {
      text += `\nПодключений: ${connectionCount}`;
    }

    return text;
  }

  getConnectionCount() {
    if (!this.ports || !this.ports[0]) return 0;
    return this.ports[0].connections?.length || 0;
  }

  getConnectedElements() {
    if (!this.ports || !this.ports[0]) return [];
    const connections = this.ports[0].connections || [];
    return connections.map(conn => ({
      elementId: conn.connectedElementId,
      portId: conn.connectedPortId,
      element: null
    }));
  }

  getParameters() {
    const params = [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      {
        name: 'fittingType',
        label: 'Тип фитинга',
        type: 'select',
        options: [
          { value: 'elbow', label: 'Отвод' },
          { value: 'tee', label: 'Тройник' },
          { value: 'cross', label: 'Крестовина' },
          { value: 'transition', label: 'Переход' }
        ],
        value: this.fittingType
      },
      {
        name: 'materialType', label: 'Материал', type: 'select', options: DuctBase.getMaterialsTypes(), value: this.materialType,
      },
    ];

    return params;
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this._radius, 0, 2 * Math.PI);

    if (isSelected) {
      ctx.fillStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.fillStyle = '#00c8ff';
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fill();

    ctx.strokeStyle = isDarkTheme ? '#fff' : '#333';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${Math.max(10, 14 / scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (showPorts) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5 / scale, 0, 2 * Math.PI);

      const connectionCount = this.getConnectionCount();
      if (connectionCount === 0) {
        ctx.fillStyle = '#888888';
      } else if (connectionCount === 1) {
        ctx.fillStyle = '#00cc00';
      } else if (connectionCount === 2) {
        ctx.fillStyle = '#ffaa00';
      } else {
        ctx.fillStyle = '#ff0000';
      }
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }

    ctx.restore();

    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  getPorts() {
    const ports = [];
    const existingPort = this.ports?.find(p => p.direction === 'center');

    const port = new Port(
      existingPort?.id || `port_${this.id}_center`,
      this.id,
      'center',
      'center',
      0,
      0,
      this.x,
      this.y
    );

    if (existingPort && existingPort.connections) {
      port.connections = [...existingPort.connections];
    }

    ports.push(port);
    return ports;
  }

  updatePorts() {
    const oldPorts = this.ports || [];
    const newPorts = this.getPorts();

    newPorts.forEach(newPort => {
      const oldPort = oldPorts.find(p => p.direction === newPort.direction);
      if (oldPort && oldPort.connections) {
        newPort.connections = [...oldPort.connections];
      }
    });

    this.ports = newPorts;
  }

  createPath(ctx) { }

  hitTest(worldX, worldY, ctx) {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this._radius;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this._radius / 2, 0, 2 * Math.PI);
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  allowEditRotate() {
    return false;
  }
  allowEditLineWidth() {
    return false;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      fittingType: this.fittingType,
    };
  }
}
