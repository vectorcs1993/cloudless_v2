import { Callout } from './Callout.js';
import { globalScale } from './GlobalScale.js';

export const dragItems = Object.freeze([
  {
    type: 'duct',
    label: 'Воздуховод',
    color: '#4a90e2',
    width: 64,
    height: 40,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#4a90e2" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`
  },
  {
    type: 'elbow',
    label: 'Отвод',
    color: '#e74c3c',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M12 32 L32 32 L32 52" fill="none" stroke="#e74c3c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="52" r="3" fill="#e74c3c"/>
    </svg>`
  },
  {
    type: 'transition',
    label: 'Переход',
    color: '#e67e22',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <polygon points="12,24 52,20 52,44 12,40" fill="#e67e22" stroke="#2c3e50" stroke-width="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
      <text x="32" y="54" font-size="8" text-anchor="middle" fill="#fff">${'⌀'}125→200</text>
    </svg>`
  },
  {
    type: 'tee',
    label: 'Тройник',
    color: '#27ae60',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
    </svg>`
  },
  {
    type: 'cross',
    label: 'Крестовина',
    color: '#9b59b6',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="28" width="40" height="8" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
    </svg>`
  },
]);

// ========== БАЗОВЫЙ КЛАСС ЭЛЕМЕНТА ==========
export class BaseElement {
  constructor(id, type, x, y, name) {
    this.id = id;
    this.type = type;
    this.x = x;          // в пикселях - координаты ЦЕНТРА!
    this.y = y;          // в пикселях - координаты ЦЕНТРА!
    this.name = name;
    this.color = '#C9C9C9';
    this.rotation = 0;
    this.ports = [];
    this.callouts = [];
    this.showCallout = true; // показывать выноску, по умолчанию - да
    this._lineWidth = 10; // Толщина линии, px
    this._hitTolerance = Math.max(1, Math.round(this._lineWidth / 2));
  }
  get showCallout() {
    return this._showCallout;
  }

  set showCallout(value) {
    if (this._showCallout === value) return;
    this._showCallout = value;
    if (!value) {
      // Если выноску скрываем, очищаем её визуально, но не удаляем
      this.updateCalloutText();
    } else if (this.callouts.length === 0) {
      // Если показываем и нет выноски, создаём её
      this.addCallout(this.x, this.y - 150);
    }
    this.updateCalloutText();
  }

  get lineWidth() {
    return this._lineWidth;
  }

  set lineWidth(value) {
    const newValue = Math.max(1, Math.min(18, Number(value) || 1));
    if (this._lineWidth === newValue) return;
    this._lineWidth = newValue;
    this._hitTolerance = Math.max(1, Math.round(this._lineWidth / 2));
  }

  // Получение текущего масштаба мм/px
  getMmPerPx() {
    return globalScale.getMmPerPx();
  }

  // Конвертация мм в px
  mmToPx(mm) {
    return globalScale.mmToPx(mm);
  }

  // Конвертация px в мм
  pxToMm(px) {
    return globalScale.pxToMm(px);
  }

  // Получение левого верхнего угла (для отрисовки)
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

  // Абстрактные методы (должны быть переопределены)
  getWidth() { throw new Error('Метод getWidth должен быть переопределен'); }
  getHeight() { throw new Error('Метод getHeight должен быть переопределен'); }
  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme) { throw new Error('Метод draw должен быть переопределен'); }
  hitTest(worldX, worldY, ctx) {
    this.createPath(ctx);
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx.isPointInStroke(worldX, worldY);
  }
  setStrokeStyle(ctx, scale, isSelected, isHighlighted, isDarkTheme) {
    ctx.lineWidth = this.lineWidth;
    if (isSelected) {
      ctx.strokeStyle = '#e5ff00';
    } else if (isHighlighted) {
      ctx.strokeStyle = '#00c8ff';
    } else {
      ctx.strokeStyle = '#666';
    }
    ctx.stroke();
  }

  setFillStyle(ctx, isSelected, isDarkTheme) {
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  getTypeName() {
    return BaseElement.getAvailableTypes()[this.type] || this.type;
  }

  getCalloutText() {
    return `${this.name}`;
  }

  getElementText() {
    return '';
  }

  getParameters() {
    return [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      { name: 'color', label: 'Цвет', type: 'color', value: this.color },
      { name: 'lineWidth', label: 'Толщина линии', type: 'number', step: 2, min: 2, max: 18, value: this.lineWidth, unit: 'px' },
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

  getRotationCenter() {
    return {
      x: this.x,
      y: this.y
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

  transformToLocalCoords(worldX, worldY) {
    const centerX = this.x;
    const centerY = this.y;
    const rotation = this.rotation || 0;

    // Сначала смещаем относительно центра
    const dx = worldX - centerX;
    const dy = worldY - centerY;

    if (rotation === 0) {
      return { x: dx, y: dy };
    }

    // Затем поворачиваем обратно
    const angle = -rotation * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos
    };
  }

  drawForHitTest(ctx) {
    this.createPath(ctx);
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  updatePortsWorldCoordinates() {
    if (!this.ports || this.ports.length === 0) return;

    const currentPorts = this.getPorts();
    this.ports.forEach((port, index) => {
      const updatedPort = currentPorts[index];
      if (updatedPort) {
        port.worldX = updatedPort.worldX;
        port.worldY = updatedPort.worldY;
        port.localX = updatedPort.localX;
        port.localY = updatedPort.localY;
      }
    });
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

  getPortsAfterMove(deltaX, deltaY) {
    if (!this.ports) return [];
    return this.ports.map(port => ({
      ...port,
      worldX: port.worldX + deltaX,
      worldY: port.worldY + deltaY,
    }));
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    this.callouts.push(callout);
    return callout;
  }

  removeCallout(calloutId) {
    const index = this.callouts.findIndex(c => c.id === calloutId);
    if (index !== -1) {
      this.callouts.splice(index, 1);
    }
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
    ctx.moveTo(centerX, topLeft.y);
    ctx.lineTo(centerX, topLeft.y + height);
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
      lineWidth: this.lineWidth,
      ports: this.ports.map(p => p.toJSON()),
      callouts: this.callouts.map(c => c.toJSON()),
      showCallout: this.showCallout,
    };
  }
}

// ========== БАЗОВЫЙ КЛАСС ВОЗДУХОВОДА ==========
export class DuctBase extends BaseElement {
  constructor(id, type, x, y, name, sectionType = 'round', size) {
    super(id, type, x, y, name);
    this._a = size;
    this._sectionType = sectionType;
  }

  get a() { return this._a; }

  set a(value) {
    if (this._a === value) return;
    this._a = value;
    // Центр остается на месте, размеры изменяются
    this.updatePorts();
  }

  get sectionType() { return this._sectionType; }

  set sectionType(newType) {
    if (this._sectionType === newType) return;
    this._sectionType = newType;
    this.updateCalloutText();
  }

  getCalloutText() {
    return `${super.getCalloutText()}\nA: ${this._a} мм`;
  }

  getParameters() {
    return [
      ...super.getParameters(),
      {
        name: 'sectionType', label: 'Тип сечения', type: 'select', options: [
          { value: 'rectangular', label: 'Прямоугольное' },
          { value: 'round', label: 'Круглое' }
        ], value: this.sectionType
      },
      {
        name: 'a',
        label: 'A',
        type: 'number',
        step: 10,
        min: 20,
        value: this._a,
        unit: 'мм'
      },
    ];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      a: this._a,
      sectionType: this._sectionType,
    };
  }
}

