// ConnectionManager.js
export class ConnectionManager {
  constructor(elements) {
    this.elements = elements; // ref к elements.value
  }

  // Рекурсивный сбор всех портов, включая вложенные группы
  getAllPorts() {
    const ports = [];
    const collect = (element) => {
      if (element.ports) ports.push(...element.ports);
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(collect);
      }
    };
    this.elements.value.forEach(collect);
    return ports;
  }

  // Получить порты элемента (для группы – все порты вложенных элементов)
  getElementPorts(element) {
    if (!element) return [];
    if (element.type === 'group' && element.elements) {
      const ports = [];
      const collect = (el) => {
        if (el.ports) ports.push(...el.ports);
        if (el.type === 'group' && el.elements) el.elements.forEach(collect);
      };
      collect(element);
      return ports;
    }
    return element.ports || [];
  }

  // Получить порт по его ID
  getPortById(portId) {
    const allPorts = this.getAllPorts();
    return allPorts.find(p => p.id === portId);
  }

  // Соединить два порта
  connectPorts(port1, port2) {
    if (!port1 || !port2) return false;
    port1.connectTo(port2);
    port2.connectTo(port1);
    return true;
  }

  // Разорвать соединение между портами
  disconnectPorts(port1, port2) {
    if (port1) port1.disconnect();
    if (port2) port2.disconnect();
  }

  // Разорвать все соединения элемента
  disconnectElement(element) {
    const ports = this.getElementPorts(element);
    ports.forEach(port => {
      if (port.isConnected()) {
        const targetPort = this.getPortById(port.connectedPortId);
        if (targetPort) targetPort.disconnect();
        port.disconnect();
      }
    });
  }

  // Поиск ближайшей пары портов для перемещаемого элемента после смещения deltaX, deltaY
  findClosestPortsForMoving(movingElement, deltaX, deltaY, maxDistance = 40) {
    const allPorts = this.getAllPorts();

    // Собираем ID всех элементов, входящих в перемещаемый объект (включая группу и её содержимое)
    const movingElementIds = new Set();
    const collectIds = (el) => {
      movingElementIds.add(el.id);
      if (el.type === 'group' && el.elements) el.elements.forEach(collectIds);
    };
    collectIds(movingElement);

    // Фильтруем порты, не принадлежащие перемещаемому объекту
    const staticPorts = allPorts.filter(port => !movingElementIds.has(port.elementId));

    // Получаем порты перемещаемого элемента (реальные объекты Port)
    let movingPortsData = [];

    if (movingElement.type === 'group' && movingElement.elements) {
      // Для группы собираем порты всех вложенных элементов
      movingElement.elements.forEach(element => {
        if (element.ports && element.ports.length > 0) {
          element.ports.forEach(port => {
            movingPortsData.push({
              port: port,
              worldX: port.worldX + deltaX,
              worldY: port.worldY + deltaY
            });
          });
        }
      });
    } else {
      // Для обычного элемента используем его порты
      if (movingElement.ports && movingElement.ports.length > 0) {
        movingElement.ports.forEach(port => {
          movingPortsData.push({
            port: port,
            worldX: port.worldX + deltaX,
            worldY: port.worldY + deltaY
          });
        });
      }
    }

    if (movingPortsData.length === 0) return null;

    let bestMatch = null;
    let minDistance = maxDistance;

    for (const movingData of movingPortsData) {
      for (const targetPort of staticPorts) {
        const dx = movingData.worldX - targetPort.worldX;
        const dy = movingData.worldY - targetPort.worldY;
        const distance = Math.hypot(dx, dy);
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = {
            movingPort: movingData.port,
            targetPort: targetPort,
            distance: distance,
            offsetX: targetPort.worldX - movingData.worldX,
            offsetY: targetPort.worldY - movingData.worldY,
          };
        }
      }
    }

    return bestMatch;
  }
}
