import { Group } from './Group.js';
import { DuctDirect } from './DuctDirect.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { Fan } from './Fan.js';
import { Transition } from './Transition.js';  // Добавьте импорт
import { Port } from './Port.js';
import { Callout } from './Callout.js';

// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x_px, y_px, params = {}) {
    const sectionType = params.sectionType || 'round';
    const sectionType2 = params.sectionType2 || 'round';
    const a = params.a || 50;
    const b = params.b || 50;
    const c = params.c || 50;
    const a2 = params.a2 || 50;
    const c2 = params.c2 || 50;
    const showCallout = params.showCallout;
    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x_px, y_px, sectionType, a, b, c);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        if (params.color) duct.color = params.color;
        duct.showCallout = showCallout;
        return duct;
      case 'transition':
        const transition = new Transition(id, x_px, y_px, sectionType, sectionType2, a, a2, b, c, c2);
        if (params.rotation !== undefined) transition.rotation = params.rotation;
        if (params.name) transition.name = params.name;
        if (params.color) transition.color = params.color;
        transition.showCallout = showCallout;
        return transition;
      case 'tee':
        const tee = new Tee(id, x_px, y_px, sectionType, a);
        if (params.l1 !== undefined) tee.l1 = params.l1;
        if (params.l2 !== undefined) tee.l2 = params.l2;
        if (params.l3 !== undefined) tee.l3 = params.l3;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        if (params.color) tee.color = params.color;
        tee.showCallout = showCallout;
        return tee;
      case 'cross':
        const cross = new Cross(id, x_px, y_px, sectionType, a);
        if (params.l1 !== undefined) cross.l1 = params.l1;
        if (params.l2 !== undefined) cross.l2 = params.l2;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        if (params.color) cross.color = params.color;
        cross.showCallout = showCallout;
        return cross;
      case 'elbow':
        const elbow = new Elbow(id, x_px, y_px, sectionType, a);
        if (params.r !== undefined) elbow.r = params.r;
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        if (params.color) elbow.color = params.color;
        elbow.showCallout = showCallout;
        return elbow;
      case 'fan':
        const fan = new Fan(id, x_px, y_px, sectionType, a, b);
        if (params.flow !== undefined) fan.flow = params.flow;
        if (params.pressure !== undefined) fan.pressure = params.pressure;
        if (params.rotation !== undefined) fan.rotation = params.rotation;
        if (params.name) fan.name = params.name;
        if (params.color) fan.color = params.color;
        fan.showCallout = showCallout;
        return fan;
      case 'group':
        // Сначала создаем группу без элементов
        const group = new Group(id, []);
        group.name = params.name || group.name;
        group.color = params.color || group.color;
        group.rotation = params.rotation || 0;
        group.x = params.x || 0;
        group.y = params.y || 0;
        group.width = params.width || 0;
        group.height = params.height || 0;

        // Восстанавливаем выноски группы
        if (params.callouts) {
          group.callouts = params.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
        }
        // Восстанавливаем элементы группы (рекурсивно)
        if (params.elements && params.elements.length > 0) {
          group.elements = params.elements.map(elJson => this.createFromJSON(elJson));
        }

        group.showCallout = showCallout;
        return group;
      default:
        throw new Error(`Unknown element type: ${type}`);
    }
  }

  static createFromJSON(jsonData) {
    let element = this.createElement(
      jsonData.type,
      jsonData.id,
      jsonData.x,
      jsonData.y,
      {
        sectionType: jsonData.sectionType,
        sectionType2: jsonData.sectionType2,
        a: jsonData.a,
        a2: jsonData.a2,
        b: jsonData.b,
        c: jsonData.c,
        c2: jsonData.c2,
        l1: jsonData.l1,
        l2: jsonData.l2,
        l3: jsonData.l3,
        showCallout: jsonData.showCallout !== undefined ? jsonData.showCallout : true,
        r: jsonData.r,
        length_mm: jsonData.length_mm,
        flow: jsonData.flow,
        pressure: jsonData.pressure,
        rotation: jsonData.rotation,
        elements: jsonData.elements,
        name: jsonData.name,
        color: jsonData.color,
        callouts: jsonData.callouts,
        width: jsonData.width,
        height: jsonData.height
      }
    );

    // Восстанавливаем порты (для не-групп)
    if (element.type !== 'group' && jsonData.ports) {
      element.ports = jsonData.ports.map(p => new Port(
        p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
      ));

      element.ports.forEach(port => {
        const foundPort = jsonData.ports.find(op => op.id === port.id);
        if (foundPort) {
          port.connectedElementId = foundPort.connectedElementId || null;
          port.connectedPortId = foundPort.connectedPortId || null;
        }
      });
    }

    // Восстанавливаем выноски (для не-групп, у групп уже восстановлены)
    if (element.type !== 'group' && jsonData.callouts && jsonData.callouts.length > 0) {
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
    } else if (element.type !== 'group') {
      element.callouts = [];
    }

    if (element.type === 'group' && jsonData.showCallout !== undefined) {
      element.showCallout = jsonData.showCallout;
    }

    // Обновляем порты и выноски после загрузки
    if (typeof element.updatePorts === 'function') {
      element.updatePorts();
    }

    if (typeof element.updateCalloutText === 'function') {
      element.updateCalloutText();
    }

    return element;
  }

  // Добавьте новый метод для обновления всех групп после загрузки
  static updateAllGroupsBounds(elements) {
    if (!elements || !Array.isArray(elements)) return;

    const updateGroupRecursive = (element) => {
      if (!element) return;

      if (element.type === 'group') {
        // Рекурсивно обновляем все вложенные группы
        if (element.elements && Array.isArray(element.elements)) {
          element.elements.forEach(updateGroupRecursive);
        } else {
          // Если elements нет или это не массив, инициализируем пустым массивом
          element.elements = [];
        }

        // Затем обновляем границы текущей группы
        if (typeof element.updateBounds === 'function') {
          element.updateBounds();
        }

        // Обновляем выноску
        if (typeof element.updateCalloutText === 'function') {
          element.updateCalloutText();
        }

        // Создаем выноску если её нет
        if ((!element.callouts || element.callouts.length === 0) && element.width > 0 && element.height > 0) {
          if (typeof element.getTopLeft === 'function') {
            const topLeft = element.getTopLeft();
            if (typeof element.addCallout === 'function') {
              element.addCallout(element.x, topLeft.y - 50);
            }
          }
        }
      }
    };

    elements.forEach(updateGroupRecursive);
  }
}
