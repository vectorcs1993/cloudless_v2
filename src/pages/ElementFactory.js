import { DuctDirect } from './DuctDirect.js';
import { Fitting } from './Fitting.js';
import { Port } from './Port.js';
import { Callout } from './Callout.js';

// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x, y, params = {}) {

    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x, y, params.materialType, params.sectionType, params.a, params.b, params.c);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        if (params.color) duct.color = params.color;
        if (params.lineWidth !== undefined) duct.lineWidth = params.lineWidth;
        duct.showCallout = params.showCallout !== undefined ? params.showCallout : true;
        return duct;

      case 'fitting':
        const fitting = new Fitting(id, x, y, params.fittingType);
        if (params.rotation !== undefined) fitting.rotation = params.rotation;
        if (params.name) fitting.name = params.name;
        if (params.color) fitting.color = params.color;
        if (params.lineWidth !== undefined) fitting.lineWidth = params.lineWidth;
        fitting.showCallout = params.showCallout !== undefined ? params.showCallout : true;
        return fitting;
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
        materialType: jsonData.materialType,
        a: jsonData.a,
        b: jsonData.b,
        c: jsonData.c,
        fittingType: jsonData.fittingType,
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

  static createGhostElement(type, x, y) {
    const creators = {
      duct: () => new DuctDirect(-1, x, y),
      fitting: () => new Fitting(-1, x, y, 'elbow'),
    };
    const creator = creators[type];
    return creator ? creator() : null;
  }
}
