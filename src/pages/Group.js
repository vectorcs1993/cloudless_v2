import { BaseElement } from './Elements.js';
import { Callout } from './Callout.js';
import { globalScale } from './GlobalScale.js';

// ========== КЛАСС ГРУППЫ ==========
export class Group extends BaseElement {
  constructor(id, elements, savedWidth = 0, savedHeight = 0) {
    super(id, 'group', 0, 0, `Группа ${id}`);
    this.elements = elements || [];
    this._showCallout = true;

    // Если есть сохраненные размеры, используем их
    if (savedWidth > 0 && savedHeight > 0) {
      this.width = savedWidth;
      this.height = savedHeight;
    } else {
      this.updateBounds();
    }

    // Добавляем выноску для группы, только если её нет
    if ((!this.callouts || this.callouts.length === 0) && this.width > 0 && this.height > 0 && this.showCallout) {
      const topLeft = this.getTopLeft();
      this.addCallout(this.x, topLeft.y - 50);
    }
  }

  // Геттеры и сеттеры для позиции X
  get x() { return this._x; }
  set x(value) {
    if (this._x === value) return;
    const deltaX = value - this._x;
    this._x = value;
    // Перемещаем все элементы
    if (this.elements) {
      this.moveElementsRecursive(deltaX, 0);
    }
    this.updateBounds();
  }

  // Геттеры и сеттеры для позиции Y
  get y() { return this._y; }
  set y(value) {
    if (this._y === value) return;
    const deltaY = value - this._y;
    this._y = value;
    // Перемещаем все элементы
    if (this.elements) {
      this.moveElementsRecursive(0, deltaY);
    }
    this.updateBounds();
  }

  // Геттеры и сеттеры для поворота
  get rotation() { return this._rotation; }
  set rotation(value) {
    if (this._rotation === value) return;
    const delta = value - this._rotation;
    this._rotation = value;

    // Поворачиваем все элементы вокруг центра группы
    if (this.elements && this.elements.length > 0) {
      const centerX = this.x;
      const centerY = this.y;
      const angleRad = delta * Math.PI / 180;

      // Сохраняем позиции выносок
      const savedCallouts = [];
      const saveCalloutsRecursive = (element) => {
        if (element.callouts && element.callouts.length > 0) {
          savedCallouts.push({
            callout: element.callouts[0],
            x: element.callouts[0].x,
            y: element.callouts[0].y
          });
        }
        if (element.type === 'group' && element.elements) {
          element.elements.forEach(saveCalloutsRecursive);
        }
      };
      this.elements.forEach(saveCalloutsRecursive);

      // Поворачиваем элементы
      const rotateRecursive = (element) => {
        const dx = element.x - centerX;
        const dy = element.y - centerY;
        element.x = centerX + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
        element.y = centerY + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));
        element.rotation = (element.rotation + delta) % 360;

        if (element.updatePorts) element.updatePorts();

        if (element.type === 'group' && element.elements) {
          element.elements.forEach(rotateRecursive);
          if (element.updateBounds) element.updateBounds();
        }
      };
      this.elements.forEach(rotateRecursive);

      // Восстанавливаем позиции выносок
      savedCallouts.forEach(saved => {
        saved.callout.x = saved.x;
        saved.callout.y = saved.y;
      });
    }

    this.updateBounds();
    this.updateCalloutText();
  }

  // Геттер/сеттер для showCallout
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
    if (!this.elements || this.elements.length === 0) {
      this._x = 0;
      this._y = 0;
      this.width = 0;
      this.height = 0;
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const processElement = (element) => {
      if (!element) return;

      if (element.type === 'group') {
        if (element.width > 0 && element.height > 0) {
          const halfW = element.width / 2;
          const halfH = element.height / 2;
          const corners = [
            { x: element.x - halfW, y: element.y - halfH },
            { x: element.x + halfW, y: element.y - halfH },
            { x: element.x + halfW, y: element.y + halfH },
            { x: element.x - halfW, y: element.y + halfH }
          ];

          for (const corner of corners) {
            minX = Math.min(minX, corner.x);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            maxY = Math.max(maxY, corner.y);
          }
        }

        if (element.elements) {
          element.elements.forEach(processElement);
        }
      } else {
        const centerX = element.x;
        const centerY = element.y;
        const width = element.getWidth();
        const height = element.getHeight();
        const rotation = (element.rotation || 0) * Math.PI / 180;

        const corners = [
          { x: -width / 2, y: -height / 2 },
          { x: width / 2, y: -height / 2 },
          { x: width / 2, y: height / 2 },
          { x: -width / 2, y: height / 2 }
        ];

        for (const corner of corners) {
          const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation);
          const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation);
          const worldX = centerX + rotatedX;
          const worldY = centerY + rotatedY;

          minX = Math.min(minX, worldX);
          minY = Math.min(minY, worldY);
          maxX = Math.max(maxX, worldX);
          maxY = Math.max(maxY, worldY);
        }
      }
    };

    this.elements.forEach(processElement);

    if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
      this._x = (minX + maxX) / 2;
      this._y = (minY + maxY) / 2;
      this.width = maxX - minX;
      this.height = maxY - minY;

      if (this.callouts && this.showCallout && this.callouts.length > 0) {
        this.updateCalloutText();
      }
    } else {
      this.width = 0;
      this.height = 0;
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

  getPortsAfterMove(deltaX, deltaY) {
    const allPorts = [];

    const collect = (element) => {
      if (element.ports) {
        element.ports.forEach(port => {
          allPorts.push({
            ...port,
            worldX: port.worldX + deltaX,
            worldY: port.worldY + deltaY,
          });
        });
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(collect);
      }
    };

    collect(this);
    return allPorts;
  }

  getWidth() {
    return this.width || 0;
  }

  getHeight() {
    return this.height || 0;
  }

  getCalloutText() {
    const elementsCount = this.getAllElementsCount();
    return `${this.name}\nЭлементов: ${elementsCount}`;
  }

  getAllElementsCount() {
    let count = 0;
    const countElements = (element) => {
      if (element.type === 'group') {
        if (element.elements) {
          element.elements.forEach(countElements);
        }
      } else {
        count++;
      }
    };

    if (this.elements) {
      this.elements.forEach(countElements);
    }
    return count;
  }

  getParameters() {
    return [
      { name: 'name', label: 'Имя', type: 'text', value: this.name },
      { name: 'x', label: 'Позиция по X', type: 'number', step: 1, value: this.x, unit: 'px' },
      { name: 'y', label: 'Позиция по Y', type: 'number', step: 1, value: this.y, unit: 'px' },
      { name: 'rotation', label: 'Поворот', type: 'number', step: 1, min: 0, value: this.rotation, unit: '°' },
      { name: 'showCallout', label: 'Показывать выноску', type: 'boolean', value: this.showCallout },
    ];
  }

  getPorts() {
    return [];
  }

  getAllPorts() {
    const allPorts = [];

    const collectPorts = (element) => {
      if (element.ports && element.ports.length > 0) {
        allPorts.push(...element.ports);
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(collectPorts);
      }
    };

    collectPorts(this);
    return allPorts;
  }

  moveElementsRecursive(deltaX, deltaY) {
    const moveRecursive = (element) => {
      if (!element) return;

      element.x += deltaX;
      element.y += deltaY;

      if (element.callouts && element.callouts.length > 0) {
        element.callouts.forEach(callout => {
          callout.x += deltaX;
          callout.y += deltaY;
        });
      }

      if (element.updatePorts) element.updatePorts();
      if (element.updateCalloutText) element.updateCalloutText();

      if (element.type === 'group' && element.elements) {
        element.elements.forEach(moveRecursive);
        if (element.updateBounds) element.updateBounds();
      }
    };

    this.elements.forEach(moveRecursive);
  }

  move(deltaX, deltaY) {
    if (!this.elements || this.elements.length === 0) return;

    if (isNaN(deltaX) || isNaN(deltaY) || !isFinite(deltaX) || !isFinite(deltaY)) {
      console.warn('Invalid delta in group move:', deltaX, deltaY);
      return;
    }

    this._x += deltaX;
    this._y += deltaY;

    // Перемещаем выноску группы
    if (this.callouts && this.callouts.length > 0) {
      this.callouts.forEach(callout => {
        callout.x += deltaX;
        callout.y += deltaY;
      });
    }

    this.moveElementsRecursive(deltaX, deltaY);
    this.updateBounds();
  }

  createPath(ctx) { }

  draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors) {
    // Рисуем все элементы группы
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.draw) {
          element.draw(ctx, scale, isSelected, isDarkTheme, showPorts, showColors);
        }
      });
    }

    // Рисуем выноски всех элементов
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.callouts && element.callouts.length > 0 && element.showCallout) {
          for (const callout of element.callouts) {
            callout.draw(ctx, scale, isDarkTheme, element);
          }
        }
      });
    }

    // Рисуем выноску самой группы
    if (this.callouts && this.showCallout && this.callouts.length > 0) {
      for (const callout of this.callouts) {
        callout.draw(ctx, scale, isDarkTheme, this);
      }
    }

    // Рисуем рамку группы (без поворота)
    if (this.width > 0 && this.height > 0) {
      ctx.save();
      ctx.lineWidth = Math.max(2, 3 / scale);
      ctx.strokeStyle = isSelected ? '#ff6600' : '#444444';
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

  updateAllPortsRecursive() {
    const updateRecursive = (element) => {
      if (element.updatePorts) element.updatePorts();
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(updateRecursive);
      }
    };
    this.elements.forEach(updateRecursive);
  }

  updatePorts() {
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.updatePorts) element.updatePorts();
      });
    }
  }

  updateCalloutText() {
    if (this.showCallout && this.callouts && this.callouts.length > 0) {
      this.callouts[0].text = this.getCalloutText();
    }
    if (this.elements) {
      this.elements.forEach(element => {
        if (element && element.updateCalloutText) element.updateCalloutText();
      });
    }
  }

  addCallout(x, y) {
    const calloutId = Date.now() + Math.random();
    const callout = new Callout(calloutId, this.id, this.getCalloutText(), x, y);
    if (!this.callouts) this.callouts = [];
    this.callouts.push(callout);
    return callout;
  }
  clone(newId = null, newElementIdCounter = null, newPortIdCounter = null) {
    // Клонируем все элементы
    const clonedElements = this.elements.map(el => {
      if (el.clone) {
        return el.clone(newElementIdCounter?.(), newPortIdCounter?.());
      }
      // Fallback через JSON
      const json = el.toJSON();
      json.id = newElementIdCounter ? newElementIdCounter() : Date.now();
      if (json.ports) {
        json.ports = json.ports.map(p => ({
          ...p,
          id: newPortIdCounter ? newPortIdCounter() : Date.now(),
          connectedElementId: null,
          connectedPortId: null
        }));
      }
      return ElementFactory.createFromJSON(json);
    });

    const newGroup = new Group(newId || this.id, clonedElements, this.width, this.height);
    newGroup.name = `${this.name} (копия)`;
    newGroup.color = this.color;
    newGroup.rotation = this.rotation;
    newGroup._x = this.x;
    newGroup._y = this.y;
    newGroup._showCallout = this.showCallout;

    // Клонируем выноски
    if (this.callouts && this.callouts.length > 0) {
      newGroup.callouts = this.callouts.map(c => new Callout(
        Date.now() + Math.random(),
        newGroup.id,
        c.text,
        c.x,
        c.y
      ));
    }

    newGroup.updateBounds();
    newGroup.updateCalloutText();

    return newGroup;
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
