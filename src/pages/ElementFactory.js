import { DuctDirect } from './DuctDirect.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { Fan } from './Fan.js';
import { Transition } from './Transition.js';
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
        if (params.lineWidth !== undefined) duct.lineWidth = params.lineWidth;
        duct.showCallout = showCallout;
        return duct;

      case 'transition':
        const transition = new Transition(
          id, x_px, y_px,
          params.sectionType || 'round',
          params.sectionType2 || 'round',
          params.a || 125,
          params.a2 || 200,
          params.b || 500,
          params.c || 125,
          params.c2 || 150
        );
        if (params.rotation !== undefined) transition.rotation = params.rotation;
        if (params.name) transition.name = params.name;
        if (params.color) transition.color = params.color;
        if (params.lineWidth !== undefined) transition.lineWidth = params.lineWidth;
        transition.showCallout = params.showCallout !== undefined ? params.showCallout : true;
        return transition;

      case 'tee':
        const tee = new Tee(id, x_px, y_px, sectionType, a);
        if (params.l1 !== undefined) tee.l1 = params.l1;
        if (params.l2 !== undefined) tee.l2 = params.l2;
        if (params.l3 !== undefined) tee.l3 = params.l3;
        if (params.anglel2 !== undefined) tee.angle = params.anglel2;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        if (params.color) tee.color = params.color;
        if (params.lineWidth !== undefined) tee.lineWidth = params.lineWidth;
        tee.showCallout = showCallout;
        return tee;

      case 'cross':
        const cross = new Cross(id, x_px, y_px, sectionType, a);
        if (params.l1 !== undefined) cross.l1 = params.l1;
        if (params.l2 !== undefined) cross.l2 = params.l2;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        if (params.color) cross.color = params.color;
        if (params.lineWidth !== undefined) cross.lineWidth = params.lineWidth;
        cross.showCallout = showCallout;
        return cross;

      case 'elbow':
        const elbow = new Elbow(id, x_px, y_px, sectionType, a);
        if (params.r !== undefined) elbow.r = params.r;
        if (params.direction !== undefined) elbow.direction = params.direction; // ДОБАВЛЕНО: поддержка направления
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        if (params.color) elbow.color = params.color;
        if (params.lineWidth !== undefined) elbow.lineWidth = params.lineWidth;
        elbow.showCallout = showCallout;
        return elbow;

      case 'fan':
        const fan = new Fan(id, x_px, y_px, sectionType, a, b);
        if (params.flow !== undefined) fan.flow = params.flow;
        if (params.pressure !== undefined) fan.pressure = params.pressure;
        if (params.rotation !== undefined) fan.rotation = params.rotation;
        if (params.name) fan.name = params.name;
        if (params.color) fan.color = params.color;
        if (params.lineWidth !== undefined) fan.lineWidth = params.lineWidth;
        fan.showCallout = showCallout;
        return fan;

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
        anglel2: jsonData.anglel2,
        showCallout: jsonData.showCallout !== undefined ? jsonData.showCallout : true,
        r: jsonData.r,
        direction: jsonData.direction,
        length_mm: jsonData.length_mm,
        flow: jsonData.flow,
        pressure: jsonData.pressure,
        rotation: jsonData.rotation,
        name: jsonData.name,
        color: jsonData.color,
        lineWidth: jsonData.lineWidth,
      }
    );

    // Восстанавливаем порты
    if (jsonData.ports) {
      element.ports = jsonData.ports.map(p => new Port(
        p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
      ));

      // Восстанавливаем связи портов
      element.ports.forEach(port => {
        const foundPort = jsonData.ports.find(op => op.id === port.id);
        if (foundPort) {
          port.connectedElementId = foundPort.connectedElementId || null;
          port.connectedPortId = foundPort.connectedPortId || null;
        }
      });

      // Обновляем мировые координаты портов
      if (typeof element.updatePorts === 'function') {
        element.updatePorts();
      }
    }

    // Восстанавливаем выноски
    if (jsonData.callouts && jsonData.callouts.length > 0) {
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
    } else {
      element.callouts = [];
    }

    // Обновляем выноски после загрузки
    if (typeof element.updateCalloutText === 'function') {
      element.updateCalloutText();
    }

    return element;
  }
}
