import { Tee, Group } from './Elements.js';
import { DuctDirect } from './DuctDirect.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Fan } from './Fan.js';
import { Port } from './Port.js';
import { Callout } from './Callout.js';

// ========== ФАБРИКА ==========
export class ElementFactory {
  static createElement(type, id, x_px, y_px, params = {}) {
    const sectionType = params.sectionType || 'round';
    const a = params.a || 50;
    const b = params.b || 50;

    switch (type) {
      case 'duct':
        const duct = new DuctDirect(id, x_px, y_px, sectionType, a, b);
        if (params.rotation !== undefined) duct.rotation = params.rotation;
        if (params.name) duct.name = params.name;
        if (params.color) duct.color = params.color;
        return duct;
      case 'tee':
        const tee = new Tee(id, x_px, y_px, sectionType, a);
        if (params.length_mm !== undefined) tee._lengthHorizontal_mm = params.length_mm;
        if (params.branchHeight_mm !== undefined) tee._branchHeight_mm = params.branchHeight_mm;
        if (params.rotation !== undefined) tee.rotation = params.rotation;
        if (params.name) tee.name = params.name;
        if (params.color) tee.color = params.color;
        return tee;
      case 'cross':
        const cross = new Cross(id, x_px, y_px, sectionType, a);
        if (params.lengthHorizontal_mm !== undefined) cross._lengthHorizontal_mm = params.lengthHorizontal_mm;
        if (params.lengthVertical_mm !== undefined) cross._lengthVertical_mm = params.lengthVertical_mm;
        if (params.rotation !== undefined) cross.rotation = params.rotation;
        if (params.name) cross.name = params.name;
        if (params.color) cross.color = params.color;
        return cross;
      case 'elbow':
        const elbow = new Elbow(id, x_px, y_px, sectionType, a);
        if (params.radius_mm !== undefined) elbow._radius_mm = params.radius_mm;
        if (params.rotation !== undefined) elbow.rotation = params.rotation;
        if (params.name) elbow.name = params.name;
        if (params.color) elbow.color = params.color;
        return elbow;
      case 'fan':
        const fan = new Fan(id, x_px, y_px, sectionType, a);
        if (params.length_mm !== undefined) fan._b = params.length_mm;
        if (params.flow !== undefined) fan.flow = params.flow;
        if (params.pressure !== undefined) fan.pressure = params.pressure;
        if (params.rotation !== undefined) fan.rotation = params.rotation;
        if (params.name) fan.name = params.name;
        if (params.color) fan.color = params.color;
        return fan;
      case 'group':
        const elements = (params.elements || []).map(elJson => this.createFromJSON(elJson));
        const group = new Group(params.id || Date.now() + Math.random(), elements);
        group.name = params.name || group.name;
        group.color = params.color || group.color;
        group.rotation = params.rotation || 0;
        group.x = params.x || 0;
        group.y = params.y || 0;
        group.callouts = (params.callouts || []).map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
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
        a: jsonData.a !== undefined ? jsonData.a : jsonData.size,
        b: jsonData.b !== undefined ? jsonData.b : jsonData.length,
        branchHeight_mm: jsonData.branchHeight_mm,
        lengthHorizontal_mm: jsonData.lengthHorizontal_mm,
        lengthVertical_mm: jsonData.lengthVertical_mm,
        radius_mm: jsonData.radius_mm !== undefined ? jsonData.radius_mm : jsonData.radius,
        horizontalLength_mm: jsonData.horizontalLength_mm,
        verticalLength_mm: jsonData.verticalLength_mm,
        flow: jsonData.flow,
        pressure: jsonData.pressure,
        rotation: jsonData.rotation,
        elements: jsonData.elements,
        name: jsonData.name,
        color: jsonData.color,
        callouts: jsonData.callouts
      }
    );

    if (jsonData.ports) {
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

    if (jsonData.callouts && jsonData.callouts.length > 0 && element.type !== 'group') {
      element.callouts = [];
      element.callouts = jsonData.callouts.map(c => new Callout(c.id, c.elementId, c.text, c.x, c.y));
    } else if (element.type !== 'group') {
      element.callouts = [];
    }

    return element;
  }
}
