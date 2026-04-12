import { DuctDirect } from './DuctDirect.js';
import { Port } from './Port.js';

export class Transition extends DuctDirect {
  constructor(id, x_px, y_px, sectionType = 'round', sectionType2 = 'round', a = 125, a2 = 200, b = 500, c = 125, c2 = 150) {
    super(id, x_px, y_px, sectionType, a, b, c);
    this.type = 'transition';
    this.name = `Переход ${id}`;
    this._sectionType2 = sectionType2;
    this._a2 = a2;
    this._c2 = c2;
  }

  get a2() { return this._a2; }
  set a2(value) {
    this._a2 = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get c2() { return this._c2; }
  set c2(value) {
    this._c2 = Math.max(20, Math.min(1000, value));
    this.updateCalloutText();
  }

  get sectionType2() { return this._sectionType2; }
  set sectionType2(value) {
    this._sectionType2 = value;
    this.updateCalloutText();
  }

  getEquivalentDiameter() {
    const d1 = this._sectionType === 'round' ? this._a : (2 * this._a * this._c) / (this._a + this._c);
    const d2 = this._sectionType2 === 'round' ? this._a2 : (2 * this._a2 * this._c2) / (this._a2 + this._c2);
    return (d1 + d2) / 2;
  }

  getCalloutText() {
    const getSizeStr = (type, size, size2) => {
      if (type === 'round') return `⌀${size}`;
      return `${size}x${size2}`;
    };
    const inletStr = getSizeStr(this._sectionType, this._a, this._c);
    const outletStr = getSizeStr(this._sectionType2, this._a2, this._c2);
    const avgArea = (Math.PI * Math.pow(this.getEquivalentDiameter() / 2, 2)) / 1000000;
    return `${this.name}\n${inletStr} → ${outletStr} мм\nL: ${this._b} мм\nSср: ${avgArea.toFixed(2)} м²`;
  }

  getParameters() {
    const params = [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      { name: 'color', label: 'Цвет', type: 'color', value: this.color },
      { name: 'lineWidth', label: 'Толщина линии', type: 'number', step: 2, min: 2, max: 18, value: this.lineWidth, unit: 'px' },
      {
        name: 'sectionType', label: 'Тип сечения входа', type: 'select', options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ], value: this._sectionType
      },
      {
        name: 'a',
        label: this._sectionType === 'round' ? 'Диаметр входа' : 'Ширина входа',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._a,
        unit: 'мм'
      },
      {
        name: 'sectionType2',
        label: 'Тип сечения выхода',
        type: 'select',
        options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ],
        value: this._sectionType2
      },
      {
        name: 'a2',
        label: this._sectionType2 === 'round' ? 'Диаметр выхода' : 'Ширина выхода',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._a2,
        unit: 'мм'
      },
      {
        name: 'b',
        label: 'Длина перехода',
        type: 'number',
        step: 10,
        min: 50,
        max: 3000,
        value: this._b,
        unit: 'мм'
      }
    ];

    if (this._sectionType === 'rectangular') {
      params.push({
        name: 'c',
        label: 'Высота входа',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._c,
        unit: 'мм'
      });
    }

    if (this._sectionType2 === 'rectangular') {
      params.push({
        name: 'c2',
        label: 'Высота выхода',
        type: 'number',
        step: 10,
        min: 20,
        max: 1000,
        value: this._c2,
        unit: 'мм'
      });
    }

    return params;
  }

  // Переопределяем getPorts для перехода (вход и выход)
  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();
    const width = this.getWidth();
    const centerY = this.y;

    const inletPos = this.rotatePoint(topLeft.x, centerY, this.x, this.y, rotation);
    const outletPos = this.rotatePoint(topLeft.x + width, centerY, this.x, this.y, rotation);

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'inlet')?.id || `port_${this.id}_inlet`,
      this.id, 'inlet', 'left', 0, 0, inletPos.x, inletPos.y
    ));

    ports.push(new Port(
      this.ports?.find(p => p.direction === 'outlet')?.id || `port_${this.id}_outlet`,
      this.id, 'outlet', 'right', width, 0, outletPos.x, outletPos.y
    ));

    return ports;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      a2: this._a2,
      c2: this._c2,
      sectionType2: this._sectionType2
    };
  }
}
