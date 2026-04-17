import { Callout } from './Callout.js';
import { globalScale } from './GlobalScale.js';


// Базовый класс - убираем лишнее
export class BaseElement {
  constructor(id, type, x, y, name) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.name = name;
    this.color = '#C9C9C9';
    this.rotation = 0;
    this.ports = [];
    this.callouts = [];
    this.showCallout = true;
    this._lineWidth = 6; // Толщина линии по умолчанию, px
  }

  get lineWidth() {
    return this._lineWidth;
  }

  set lineWidth(value) {
    this._lineWidth = Math.max(1, Math.min(18, Number(value) || 1));
  }

  getMmPerPx() {
    return globalScale.getMmPerPx();
  }

  mmToPx(mm) {
    return globalScale.mmToPx(mm);
  }

  pxToMm(px) {
    return globalScale.pxToMm(px);
  }

  getTopLeft() {
    return {
      x: this.x - this.getWidth() / 2,
      y: this.y - this.getHeight() / 2
    };
  }

  static getAvailableTypes() {
    return {
      'duct': 'Прямой воздуховод',
      'transition': 'Переход',
      'tee': 'Тройник',
      'elbow': 'Отвод',
      'cross': 'Крестовина',
    };
  }
  getTypeName() {
    const types = BaseElement.getAvailableTypes();
    return types[this.type] || this.type;
  }
  getWidth() { throw new Error('Метод getWidth должен быть переопределен'); }
  getHeight() { throw new Error('Метод getHeight должен быть переопределен'); }
  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  createPath(ctx) { throw new Error('Метод createPath должен быть переопределен'); }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors, showElementAxes) {
    ctx.save();

    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation || 0) * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    this.createPath(ctx);

    if (isSelected) ctx.strokeStyle = '#e5ff00';
    else if (isHighlighted) ctx.strokeStyle = '#00c8ff';
    else ctx.strokeStyle = this.color;

    ctx.lineWidth = this._lineWidth;
    ctx.stroke();

    ctx.restore();

    if (showElementAxes) this.drawCenterLines(ctx, scale, isDarkTheme);
  }

  hitTest(worldX, worldY, ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation || 0) * Math.PI / 180);
    ctx.translate(-this.x, -this.y);

    this.createPath(ctx);
    ctx.lineWidth = this._lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const hit = ctx.isPointInStroke(worldX, worldY);
    ctx.restore();
    return hit;
  }

  getCalloutText() {
    return `${this.name}`;
  }

  getParameters() {
    return [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
    ];
  }

  getRelativeCalloutEntryPoint() {
    return { x: this.getWidth() / 2, y: this.getHeight() / 2 };
  }

  getAbsoluteCalloutPoint() {
    const relativePoint = this.getRelativeCalloutEntryPoint();
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const dx = relativePoint.x - width / 2;
    const dy = relativePoint.y - height / 2;
    const angleRad = (this.rotation || 0) * Math.PI / 180;
    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
    return {
      x: centerX + rotatedX,
      y: centerY + rotatedY
    };
  }

  rotatePoint(x, y, centerX, centerY, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX,
      y: dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY
    };
  }

  updatePorts() {
    const oldPorts = this.ports;
    const newPorts = this.getPorts();
    newPorts.forEach(newPort => {
      const oldPort = oldPorts.find(p => p.direction === newPort.direction);
      if (oldPort) {
        newPort.id = oldPort.id;
        newPort.connectedElementId = oldPort.connectedElementId;
        newPort.connectedPortId = oldPort.connectedPortId;
      }
    });
    this.ports = newPorts;
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    this.callouts.push(callout);
    return callout;
  }

  updateCalloutText() {
    if (this.showCallout && this.callouts.length > 0) {
      this.callouts[0].text = this.getCalloutText();
    }
  }
  drawCenterLines(ctx, scale, isDarkTheme) {
    const width = this.getWidth();
    const height = this.getHeight();
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;
    const topLeft = this.getTopLeft();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, centerY);
    ctx.lineTo(topLeft.x + width, centerY);
    if (height > 0 && this.type !== 'duct' && this.type !== 'transition') {
      ctx.moveTo(centerX, topLeft.y);
      ctx.lineTo(centerX, topLeft.y + height);
    }
    ctx.strokeStyle = isDarkTheme ? '#ff3366' : '#cc2244';
    ctx.lineWidth = Math.max(0.5, 1 / scale);
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      name: this.name,
      color: this.color,
      rotation: this.rotation,
      lineWidth: this._lineWidth,
      ports: this.ports.map(p => p.toJSON()),
      callouts: this.callouts.map(c => c.toJSON()),
      showCallout: this.showCallout,
    };
  }
}

// ========== БАЗОВЫЙ КЛАСС ВОЗДУХОВОДА ==========
export class DuctBase extends BaseElement {

  _defaultMaterialType = 'galvanized';
  _defaultSectionType = 'round';

  constructor(id, type, x, y, name, materialType = this._defaultMaterialType, sectionType = this._defaultSectionType, a, b, c) {
    super(id, type, x, y, name);
    this._a = a;
    this._b = b;
    this._c = c;
    this._sectionType = sectionType;
    this._materialType = materialType;
  }
  static getMaterialsTypes() {
    return [
      { label: 'Оцинкованная сталь', value: 'galvanized' },
      { label: 'Нержавеющая сталь', value: 'stainless' },
      { label: 'Пластик', value: 'plastic' },
      { label: 'Алюминий', value: 'aluminum' },
      { label: 'Другой', value: 'custom' }
    ];
  }
  static getSectionTypes() {
    return [
      { label: 'Прямоугольное', value: 'rectangular' },
      { label: 'Круглое', value: 'round' }
    ];
  }
  get a() { return this._a; }
  set a(value) {
    if (this._a === value) return;
    this._a = value;
    this.updatePorts();
  }
  get b() { return this._b; }
  set b(value) {
    if (this._b === value) return;
    this._b = value;
    this.updatePorts();
    this.updateCalloutText();
  }
  get c() {
    if (this._sectionType === 'rectangular') return this._c;
    return null;
  }
  set c(value) {
    if (this._c === value) return;
    this._c = value;
    this.updateCalloutText();
  }
  get sectionType() { return this._sectionType; }
  set sectionType(newType) {
    if (this._sectionType === newType) return;
    this._sectionType = newType;
    this.updateCalloutText();
  }
  get materialType() { return this._materialType; }
  set materialType(newType) {
    if (this._materialType === newType) return;
    this._materialType = newType;
  }

  getCalloutText() {
    return `${super.getCalloutText()}\nA: ${this._a} мм`;
  }

  getMaterial() {
    return DuctBase.getMaterialsTypes().find((mt) => mt.value === this._materialType);
  }

  getSection() {
    return DuctBase.getSectionTypes().find((mt) => mt.value === this._sectionType);
  }

  getParameters() {
    const params = [...super.getParameters(),
    {
      name: 'materialType', label: 'Материал', type: 'select', options: DuctBase.getMaterialsTypes(), value: this.materialType,
    },
    {
      name: 'sectionType', label: 'Тип сечения', type: 'select', options: DuctBase.getSectionTypes(), value: this.sectionType,
    },
    {
      name: 'a', label: this._sectionType === 'rectangular' ? 'Ширина' : 'Диаметр', type: 'number', step: 10, min: 20, value: this._a, unit: 'мм',
    },
    {
      name: 'b', label: 'Длина', type: 'number', step: 10, min: 30, value: this._b, unit: 'мм',
    }
    ];
    if (this._sectionType === 'rectangular') {
      params.push({ name: 'c', label: 'Высота', type: 'number', step: 10, min: 20, value: this._c, unit: 'мм' });
    }
    return params;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      a: this._a,
      b: this._b,
      c: this._c,
      sectionType: this._sectionType,
      materialType: this._materialType,
    };
  }
}

