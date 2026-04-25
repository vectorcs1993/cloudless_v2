// Fitting.js
import { BaseElement } from './Elements.js';
import { Port } from './Port.js';

export class Fitting extends BaseElement {
  constructor(id, x, y, fittingType = 'elbow') {
    super(id, 'fitting', x, y, `Фитинг ${id}`);
    this.type = 'fitting';
    this.fittingType = fittingType;
    this.angle = 90;        // угол для отвода
    this.branchAngle = 90;  // угол ответвления для тройника
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

    return text;
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

  // ОСНОВНОЙ МЕТОД ОТРИСОВКИ - просто круг
  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    ctx.save();

    // Рисуем круг
    ctx.beginPath();
    ctx.arc(this.x, this.y, this._radius, 0, 2 * Math.PI);

    // Заливка
    if (isSelected) {
      ctx.fillStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.fillStyle = '#00c8ff';
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fill();

    // Контур
    ctx.strokeStyle = isDarkTheme ? '#fff' : '#333';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    // Маленькая буква внутри для идентификации
    ctx.fillStyle = isDarkTheme ? '#fff' : '#000';
    ctx.font = `${Math.max(10, 14 / scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const typeSymbol = {
      elbow: '↺',
      tee: '┬',
      cross: '┼',
      transition: '▷'
    };
    ctx.fillText(typeSymbol[this.fittingType] || 'F', this.x, this.y);

    ctx.restore();

    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  // ПОРТ - ОДИН, ПО ЦЕНТРУ
  getPorts() {
    const ports = [];

    // Один порт в центре фитинга
    ports.push(new Port(
      this.ports?.find(p => p.direction === 'center')?.id || `port_${this.id}_center`,
      this.id,
      'center',
      'center',
      0,
      0,
      this.x,
      this.y
    ));

    return ports;
  }

  getPortsCount() {
    return 1;
  }

  createPath(ctx) {
    // Не используется, так как draw переопределен
  }

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
      _radius: this._radius
    };
  }
}
