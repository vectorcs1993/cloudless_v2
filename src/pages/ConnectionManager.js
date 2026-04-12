export class ConnectionManager {
  constructor(elements, layerManager = null) {
    this.elements = elements;
    this.layerManager = layerManager;
    this.connections = new Map();
    this.isUpdating = false;
  }

  // МЕТОД ДОЛЖЕН БЫТЬ ОБЪЯВЛЕН
  getAllPorts() {
    const allPorts = [];
    const allElements = this.elements.value || [];
    for (const element of allElements) {
      if (element.ports && element.ports.length > 0) {
        allPorts.push(...element.ports);
      }
    }
    return allPorts;
  }

  getPortById(portId) {
    const allPorts = this.getAllPorts();
    return allPorts.find(port => port.id === portId);
  }

  getElementById(elementId) {
    const allElements = this.elements.value || [];
    return allElements.find(element => element.id === elementId);
  }

  canConnectPorts(port1, port2) {
    if (!port1 || !port2) return false;
    if (port1.id === port2.id) return false;
    if (port1.elementId === port2.elementId) return false;

    if (this.layerManager) {
      const element1 = this.getElementById(port1.elementId);
      const element2 = this.getElementById(port2.elementId);
      if (element1 && this.layerManager.isLayerLocked(element1)) return false;
      if (element2 && this.layerManager.isLayerLocked(element2)) return false;
    }
    return true;
  }

  connectPorts(port1, port2) {
    if (!this.canConnectPorts(port1, port2)) return false;

    if (port1.isConnected()) {
      this.disconnectPort(port1);
    }
    if (port2.isConnected()) {
      this.disconnectPort(port2);
    }

    port1.connectedElementId = port2.elementId;
    port1.connectedPortId = port2.id;
    port2.connectedElementId = port1.elementId;
    port2.connectedPortId = port1.id;

    this.connections.set(port1.id, {
      connectedPortId: port2.id,
      elementId: port2.elementId
    });
    this.connections.set(port2.id, {
      connectedPortId: port1.id,
      elementId: port1.elementId
    });

    return true;
  }

  disconnectPort(port) {
    if (!port || !port.isConnected()) return false;

    const connectedPort = this.getPortById(port.connectedPortId);
    if (connectedPort) {
      connectedPort.connectedElementId = null;
      connectedPort.connectedPortId = null;
      this.connections.delete(connectedPort.id);
    }

    port.connectedElementId = null;
    port.connectedPortId = null;
    this.connections.delete(port.id);

    return true;
  }

  disconnectPorts(port1, port2) {
    if (!port1 || !port2) return false;

    port1.connectedElementId = null;
    port1.connectedPortId = null;
    port2.connectedElementId = null;
    port2.connectedPortId = null;

    this.connections.delete(port1.id);
    this.connections.delete(port2.id);

    return true;
  }

  disconnectElement(element) {
    if (!element.ports) return false;
    for (const port of element.ports) {
      if (port.isConnected()) {
        this.disconnectPort(port);
      }
    }
    return true;
  }

  findClosestPort(port, maxDistance = 40) {
    const allPorts = this.getAllPorts();
    let closestPort = null;
    let minDistance = maxDistance;

    for (const targetPort of allPorts) {
      if (targetPort.id === port.id) continue;
      if (targetPort.elementId === port.elementId) continue;
      if (!this.canConnectPorts(port, targetPort)) continue;

      const distance = Math.hypot(port.worldX - targetPort.worldX, port.worldY - targetPort.worldY);
      if (distance < minDistance) {
        minDistance = distance;
        closestPort = targetPort;
      }
    }

    return closestPort;
  }

  updateAllPortsAndConnections(maxDistance = 40, layerManager = null) {
    if (this.isUpdating) {
      console.log('Пропущен рекурсивный вызов updateAllPortsAndConnections');
      return { broken: 0, connected: 0 };
    }

    this.isUpdating = true;
    let brokenCount = 0;
    let connectedCount = 0;

    try {
      const allPorts = this.getAllPorts();
      const portMap = new Map();
      for (const port of allPorts) {
        portMap.set(port.id, port);
      }

      for (const port of allPorts) {
        if (port.isConnected()) {
          const connectedPort = portMap.get(port.connectedPortId);

          if (!connectedPort) {
            this.disconnectPort(port);
            brokenCount++;
            continue;
          }

          const distance = Math.hypot(port.worldX - connectedPort.worldX, port.worldY - connectedPort.worldY);
          if (distance > maxDistance) {
            this.disconnectPort(port);
            brokenCount++;
            continue;
          }

          if (connectedPort.connectedPortId !== port.id) {
            this.disconnectPort(port);
            brokenCount++;
            continue;
          }
        }
      }

      for (const port of allPorts) {
        if (port.isConnected()) continue;

        const bestMatch = this.findClosestPort(port, maxDistance);
        if (bestMatch) {
          this.connectPorts(port, bestMatch);
          connectedCount++;
        }
      }
    } finally {
      this.isUpdating = false;
    }

    if (brokenCount > 0 || connectedCount > 0) {
      console.log(`Связи: разорвано ${brokenCount}, создано ${connectedCount}`);
    }

    return { broken: brokenCount, connected: connectedCount };
  }

  getAllConnections() {
    const connections = [];
    for (const [portId, connection] of this.connections) {
      connections.push({
        portId,
        connectedPortId: connection.connectedPortId,
        elementId: connection.elementId
      });
    }
    return connections;
  }

  clearAllConnections() {
    const allPorts = this.getAllPorts();
    for (const port of allPorts) {
      port.connectedElementId = null;
      port.connectedPortId = null;
    }
    this.connections.clear();
  }
}
