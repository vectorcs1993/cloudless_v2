import { BaseElement } from './Elements.js';
import { DuctBase } from './Elements.js';
import { Port } from './Port.js';

export class Fitting extends DuctBase {
  constructor(id, x, y, fittingType = 'elbow') {
    super(id, 'fitting', x, y, `Фитинг ${id}`, 'galvanized', 'round', 125, 100, 125);
    this.fittingType = fittingType;
    this._radius = 9; // Базовый радиус в пикселях (при масштабе 1)
    this._lineWidth = 2;
  }
  static getAvailableFittingTypes() {
    return {
      'elbow': 'Отвод',
      'tee': 'Тройник',
      'cross': 'Крестовина',
      'transition': 'Переход'
    };
  }
  getTypeName() {
    return `${BaseElement.getAvailableTypes()[this.type]} (${Fitting.getAvailableFittingTypes()[this.fittingType]})`;
  }
  // Метод для получения радиуса с учетом масштаба
  getRadius(scale) {
    // Минимальный и максимальный видимый размер на экране
    const minScreenRadius = 6;
    const maxScreenRadius = 18;

    // Радиус в пикселях на экране (с учетом масштаба)
    let screenRadius = this._radius / scale;

    // Ограничиваем размер
    screenRadius = Math.min(maxScreenRadius, Math.max(minScreenRadius, screenRadius));

    return screenRadius;
  }

  get a() { return null; }
  set a(value) { }

  get b() { return null; }
  set b(value) { }

  get c() { return null; }
  set c(value) { }

  getSection() {
    return null;
  }

  getWidth() {
    return this.getRadius(1) * 2;
  }

  getHeight() {
    return this.getRadius(1) * 2;
  }

  getTopLeft() {
    const radius = this.getRadius(1);
    return {
      x: this.x - radius,
      y: this.y - radius
    };
  }

  getCalloutText() {

    let text = `${Fitting.getAvailableFittingTypes()[this.fittingType] || this.fittingType}\n${this.name}`;

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
    this.createPath(ctx);
    if (isSelected) ctx.strokeStyle = '#e5ff00';
    else if (isHighlighted) ctx.strokeStyle = '#00c8ff';
    else ctx.strokeStyle = this.color;
    ctx.lineWidth = this._lineWidth;
    ctx.stroke();
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
    // Для hit test используем всегда базовый радиус (без учета масштаба)
    // Потому что hit test выполняется в мировых координатах
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    // Увеличиваем зону клика для удобства (базовый радиус + запас)
    const hitRadius = this._radius;
    return Math.sqrt(dx * dx + dy * dy) < hitRadius;
  }

  drawCenterLines(ctx, scale, isDarkTheme) {
    ctx.save();
    const radius = this.getRadius(scale);
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius / 2, 0, 2 * Math.PI);
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
