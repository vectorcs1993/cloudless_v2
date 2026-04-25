// Fitting.js - добавляем метод для получения информации о связях

import { BaseElement } from './Elements.js';
import { Port } from './Port.js';

export class Fitting extends BaseElement {
  constructor(id, x, y, fittingType = 'elbow') {
    super(id, 'fitting', x, y, `Фитинг ${id}`);
    this.type = 'fitting';
    this.fittingType = fittingType;
    this.angle = 90;
    this.branchAngle = 90;
    this._radius = 15;
    this.color = '#ff9800';
  }

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

    if (this.fittingType === 'elbow') {
      text += `\nУгол: ${this.angle}°`;
    } else if (this.fittingType === 'tee') {
      text += `\nУгол ответвления: ${this.branchAngle}°`;
    }

    // Добавляем количество подключений
    const connectionCount = this.getConnectionCount();
    if (connectionCount > 0) {
      text += `\nПодключений: ${connectionCount}`;
    }

    return text;
  }

  // Получение количества подключений
  getConnectionCount() {
    if (!this.ports || !this.ports[0]) return 0;
    return this.ports[0].connections?.length || 0;
  }

  // Получение списка подключенных элементов для отображения во вкладке "Связи"
  getConnectedElements() {
    if (!this.ports || !this.ports[0]) return [];

    const connections = this.ports[0].connections || [];
    return connections.map(conn => ({
      elementId: conn.connectedElementId,
      portId: conn.connectedPortId,
      element: null // Заполняется внешним кодом
    }));
  }

  getParameters() {
    const params = [...super.getParameters()];

    params.push({
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
    });

    if (this.fittingType === 'elbow') {
      params.push({
        name: 'angle',
        label: 'Угол отвода',
        type: 'select',
        options: [
          { value: 30, label: '30°' },
          { value: 45, label: '45°' },
          { value: 60, label: '60°' },
          { value: 90, label: '90°' }
        ],
        value: this.angle,
        unit: '°'
      });
    }

    if (this.fittingType === 'tee') {
      params.push({
        name: 'branchAngle',
        label: 'Угол ответвления',
        type: 'select',
        options: [
          { value: 45, label: '45°' },
          { value: 60, label: '60°' },
          { value: 90, label: '90°' }
        ],
        value: this.branchAngle,
        unit: '°'
      });
    }

    return params;
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    ctx.save();

    // Рисуем круг фитинга
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

    // Символ внутри
    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${Math.max(10, 14 / scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const symbols = {
      elbow: '↺',
      tee: '┬',
      cross: '┼',
      transition: '▷'
    };
    ctx.fillText(symbols[this.fittingType] || 'F', this.x, this.y);

    // Рисуем порт (маленький кружок в центре) если включено отображение портов
    if (showPorts) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5 / scale, 0, 2 * Math.PI);

      // Цвет порта зависит от количества подключений
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

  // Порт - один, по центру
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

    // Сохраняем существующие связи если есть
    if (existingPort && existingPort.connections) {
      port.connections = [...existingPort.connections];
    }

    ports.push(port);
    return ports;
  }

  updatePorts() {
    const oldPorts = this.ports || [];
    const newPorts = this.getPorts();

    // Восстанавливаем связи из старых портов
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

  toJSON() {
    return {
      ...super.toJSON(),
      fittingType: this.fittingType,
      angle: this.angle,
      branchAngle: this.branchAngle,
      _radius: this._radius
    };
  }
}
