import { BaseElement } from './Elements.js';
import { Callout } from './Callout.js';
import { globalScale } from './GlobalScale.js';

// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements, savedWidth = 0, savedHeight = 0) {
    super(id, 'group', 0, 0, `Группа ${id}`);
    // Всегда инициализируем elements как массив
    this.elements = Array.isArray(elements) ? elements : [];
    this._showCallout = true;

    // Инициализируем координаты
    this._x = 0;
    this._y = 0;
    this._rotation = 0;
    this.width = savedWidth || 0;
    this.height = savedHeight || 0;

    // Обновляем границы только если есть элементы
    if (this.elements.length > 0) {
      this.updateBounds();
    }

    // Добавляем выноску
    if (this.width > 0 && this.height > 0 && this.showCallout) {
      const topLeft = this.getTopLeft();
      this.addCallout(this.x, topLeft.y - 50);
    }
  }

  get x() { return this._x; }
  set x(value) {
    if (this._x === value) return;
    const deltaX = value - this._x;
    this._x = value;
    // Добавляем проверку
    if (this.elements && Array.isArray(this.elements)) {
      this.moveElementsRecursive(deltaX, 0);
    }
    this.updateBounds();
  }

  get y() { return this._y; }
  set y(value) {
    if (this._y === value) return;
    const deltaY = value - this._y;
    this._y = value;
    // Добавляем проверку
    if (this.elements && Array.isArray(this.elements)) {
      this.moveElementsRecursive(0, deltaY);
    }
    this.updateBounds();
  }

  get rotation() { return this._rotation; }
  set rotation(value) {
    if (this._rotation === value) return;
    const delta = value - this._rotation;
    this._rotation = value;

    if (this.elements && this.elements.length > 0) {
      const centerX = this.x;
      const centerY = this.y;
      const angleRad = delta * Math.PI / 180;

      this.elements.forEach(element => {
        const dx = element.x - centerX;
        const dy = element.y - centerY;
        element.x = centerX + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
        element.y = centerY + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));
        element.rotation = (element.rotation + delta) % 360;
        if (element.updatePorts) element.updatePorts();
      });
    }

    this.updateBounds();
    this.updateCalloutText();
  }

  get showCallout() { return this._showCallout; }
  set showCallout(value) {
    if (this._showCallout === value) return;
    this._showCallout = value;
    if (!value) {
      this.callouts = [];
    } else if (this.callouts.length === 0 && this.width > 0 && this.height > 0) {
      const topLeft = this.getTopLeft();
      this.addCallout(this.x, topLeft.y - 50);
    }
    this.updateCalloutText();
  }

  updateBounds() {
    if (!this.elements || !Array.isArray(this.elements) || this.elements.length === 0) {
      this.width = 0;
      this.height = 0;
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    this.elements.forEach(element => {
      if (!element) return;

      const width = element.getWidth();
      const height = element.getHeight();
      const rotation = (element.rotation || 0) * Math.PI / 180;

      const corners = [
        { x: -width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 }
      ];

      corners.forEach(corner => {
        const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation);
        const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation);
        const worldX = element.x + rotatedX;
        const worldY = element.y + rotatedY;

        minX = Math.min(minX, worldX);
        minY = Math.min(minY, worldY);
        maxX = Math.max(maxX, worldX);
        maxY = Math.max(maxY, worldY);
      });
    });

    if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
      this._x = (minX + maxX) / 2;
      this._y = (minY + maxY) / 2;
      this.width = maxX - minX;
      this.height = maxY - minY;
    }
  }

  getTopLeft() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2
    };
  }

  getElements() {
    return [...(this.elements || [])];
  }

  getWidth() {
    return this.width || 0;
  }

  getHeight() {
    return this.height || 0;
  }

  getCalloutText() {
    const count = this.elements && Array.isArray(this.elements) ? this.elements.length : 0;
    return `${this.name}\nЭлементов: ${count}`;
  }

  getPorts() {
    return [];
  }

  moveElementsRecursive(deltaX, deltaY) {
    // Добавляем проверку на существование elements
    if (!this.elements || !Array.isArray(this.elements)) return;

    this.elements.forEach(element => {
      if (!element) return;

      element.x += deltaX;
      element.y += deltaY;

      if (element.callouts) {
        element.callouts.forEach(callout => {
          callout.x += deltaX;
          callout.y += deltaY;
        });
      }

      if (element.updatePorts) element.updatePorts();
      if (element.updateCalloutText) element.updateCalloutText();
    });
  }

  move(deltaX, deltaY) {
    if (!this.elements || this.elements.length === 0) return;

    this._x += deltaX;
    this._y += deltaY;

    if (this.callouts) {
      this.callouts.forEach(callout => {
        callout.x += deltaX;
        callout.y += deltaY;
      });
    }

    this.moveElementsRecursive(deltaX, deltaY);
    this.updateBounds();
  }

  draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors) {
    // Рисуем все элементы группы
    if (this.elements && Array.isArray(this.elements)) {
      this.elements.forEach(element => {
        if (element && element.draw) {
          element.draw(ctx, scale, isSelected, isHighlighted, isDarkTheme, showPorts, showColors);
        }
      });
    }

    // Рисуем выноски
    if (this.callouts && this.showCallout) {
      this.callouts.forEach(callout => {
        callout.draw(ctx, scale, isDarkTheme, this);
      });
    }

    // Рисуем рамку группы
    if (this.width > 0 && this.height > 0) {
      ctx.save();
      ctx.lineWidth = this.lineWidth;
      if (isSelected) {
        ctx.strokeStyle = '#ff6600';
      } else if (isHighlighted) {
        ctx.strokeStyle = '#00c8ff';
      } else {
        ctx.strokeStyle = '#888888';
      }
      ctx.setLineDash([5 / scale, 5 / scale]);
      const topLeft = this.getTopLeft();
      ctx.strokeRect(topLeft.x, topLeft.y, this.width, this.height);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  hitTest(worldX, worldY, ctx) {
    if (!this.elements) return false;

    for (const element of this.elements) {
      if (element && element.hitTest && element.hitTest(worldX, worldY, ctx)) {
        return true;
      }
    }
    return false;
  }

  updatePorts() {
    this.elements?.forEach(element => {
      if (element && element.updatePorts) element.updatePorts();
    });
  }

  updateCalloutText() {
    if (this.showCallout && this.callouts && this.callouts.length > 0) {
      this.callouts[0].text = this.getCalloutText();
    }
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    if (!this.callouts) this.callouts = [];
    this.callouts.push(callout);
    return callout;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      elements: this.elements ? this.elements.map(el => el.toJSON()) : [],
      width: this.width,
      height: this.height,
    };
  }
}
