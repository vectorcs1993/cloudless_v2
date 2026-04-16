import { ElementFactory } from './ElementFactory.js';

export class ClipboardManager {
  constructor(layerManager, connectionManager) {
    this.layerManager = layerManager;
    this.connectionManager = connectionManager;
    this.clipboard = []; // хранит JSON элементов
  }

  // В методе copy
  copy(elements) {
    if (!elements.length) return false;
    this.clipboard = elements.map(el => {
      const json = el.toJSON();
      json.callouts = [];
      return json;
    });
    return true;
  }


  paste(offsetX = 50, offsetY = 50) {
    if (!this.clipboard.length) return [];

    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return [];

    const newElements = [];
    const oldIdToNewId = new Map();

    for (const json of this.clipboard) {
      const newJson = JSON.parse(JSON.stringify(json));
      const oldId = newJson.id;
      const newId = this.layerManager.getNextElementId();
      oldIdToNewId.set(oldId, newId);
      newJson.id = newId;

      if (newJson.ports) {
        newJson.ports.forEach(port => {
          port.id = this.layerManager.getNextPortId();
          port.elementId = newId;
          port.connectedElementId = null;
          port.connectedPortId = null;
        });
      }

      newJson.x = (newJson.x || 0) + offsetX;
      newJson.y = (newJson.y || 0) + offsetY;
      newJson.callouts = [];

      const el = ElementFactory.createFromJSON(newJson);
      if (el) {
        el.name = `${el.name.replace(/\s*\(копия.*\)\s*$/, '')} (копия)`;
        if (el.showCallout !== false) {
          const topLeft = el.getTopLeft();
          el.addCallout(el.x, topLeft.y - 50);
          el.updateCalloutText();
        }
        newElements.push(el);
      }
    }

    // Восстанавливаем связи между скопированными элементами
    for (let i = 0; i < newElements.length; i++) {
      const newEl = newElements[i];
      const oldJson = this.clipboard[i];
      if (newEl.ports && oldJson.ports) {
        for (let pIdx = 0; pIdx < newEl.ports.length; pIdx++) {
          const newPort = newEl.ports[pIdx];
          const oldPort = oldJson.ports[pIdx];
          if (oldPort.connections && oldPort.connections.length > 0) {
            for (const conn of oldPort.connections) {
              const newTargetId = oldIdToNewId.get(conn.connectedElementId);
              if (newTargetId) {
                const targetElement = newElements.find(el => el.id === newTargetId);
                if (targetElement && targetElement.ports) {
                  const targetPort = targetElement.ports.find(p => p.id === conn.connectedPortId);
                  if (targetPort) {
                    this.connectionManager.connectPorts(newPort, targetPort);
                  }
                }
              }
            }
          }
        }
      }
    }

    for (const el of newElements) {
      if (el.updatePorts) el.updatePorts();
    }

    activeLayer.elements.push(...newElements);
    return newElements;
  }

  clear() {
    this.clipboard = [];
  }

  isEmpty() {
    return this.clipboard.length === 0;
  }
}
