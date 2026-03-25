// ========== КЛАСС МЕНЕДЖЕРА СОЕДИНЕНИЙ ==========
export class ConnectionManager {
  constructor(elements) {
    this.elements = elements;
  }

  connectPorts(port1, port2) {
    if (!port1 || !port2) return false;
    port1.connectTo(port2);
    port2.connectTo(port1);
    return true;
  }

  disconnectPorts(port1, port2) {
    if (port1) port1.disconnect();
    if (port2) port2.disconnect();
  }

  disconnectElement(element) {
    if (!element.ports) return;
    element.ports.forEach(port => {
      if (port.isConnected()) {
        const connectedElement = this.elements.value.find(el => el.id === port.connectedElementId);
        if (connectedElement?.ports) {
          const connectedPort = connectedElement.ports.find(p => p.id === port.connectedPortId);
          if (connectedPort) connectedPort.disconnect();
        }
        port.disconnect();
      }
    });
  }

  findClosestPorts(movingElement, maxDistance = 40) {
    if (typeof movingElement.getPorts !== 'function') return null;

    // Обновляем мировые координаты портов всех элементов перед поиском
    this.elements.value.forEach(element => {
      if (element.updatePortsWorldCoordinates) {
        element.updatePortsWorldCoordinates();
      }
    });

    const movingPorts = movingElement.getPorts();
    const allPorts = this.getAllPorts().filter(p => p.elementId !== movingElement.id);

    let bestMatch = null;
    let minDistance = maxDistance;

    movingPorts.forEach(movingPort => {
      allPorts.forEach(targetPort => {
        const distance = Math.hypot(movingPort.worldX - targetPort.worldX, movingPort.worldY - targetPort.worldY);
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = { movingPort, targetPort, distance };
        }
      });
    });

    return bestMatch;
  }

  getAllPorts() {
    const ports = [];
    this.elements.value.forEach(element => {
      if (element.ports) ports.push(...element.ports);
    });
    return ports;
  }
}
