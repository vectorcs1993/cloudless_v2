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
    const ports = [];
    const collect = (el) => {
      if (el.ports) ports.push(...el.ports);
      if (el.type === 'group' && el.elements) {
        el.elements.forEach(collect);
      }
    };
    collect(element);
    return ports;
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

  // Рекурсивный сбор всех ID элементов внутри группы (включая вложенные группы)
  collectElementIds(element, idsSet) {
    idsSet.add(element.id);
    if (element.type === 'group' && element.elements) {
      element.elements.forEach(child => {
        this.collectElementIds(child, idsSet);
      });
    }
  }

  // Рекурсивный сбор всех портов элемента (включая вложенные группы)
  collectPorts(element, portsArray) {
    if (element.ports) {
      portsArray.push(...element.ports);
    }
    if (element.type === 'group' && element.elements) {
      element.elements.forEach(child => {
        this.collectPorts(child, portsArray);
      });
    }
  }

  // Рекурсивный сбор портов с их новыми позициями после смещения
  collectMovingPortsWithPositions(element, deltaX, deltaY, portsArray) {
    if (element.ports) {
      element.ports.forEach(port => {
        portsArray.push({
          port: port,
          worldX: port.worldX + deltaX,
          worldY: port.worldY + deltaY,
          element: element
        });
      });
    }
    if (element.type === 'group' && element.elements) {
      element.elements.forEach(child => {
        this.collectMovingPortsWithPositions(child, deltaX, deltaY, portsArray);
      });
    }
  }

  // Поиск ближайшей пары портов для перемещаемого элемента после смещения deltaX, deltaY
  findClosestPortsForMoving(movingElement, deltaX, deltaY, maxDistance = 40) {
    const allPorts = this.getAllPorts();

    // Собираем ID всех элементов, входящих в перемещаемый объект (включая группу и всё её содержимое)
    const movingElementIds = new Set();
    this.collectElementIds(movingElement, movingElementIds);

    // Фильтруем порты, не принадлежащие перемещаемому объекту
    const staticPorts = allPorts.filter(port => !movingElementIds.has(port.elementId));

    // Получаем порты перемещаемого элемента с учётом вложенности и сдвига
    const movingPortsData = [];
    this.collectMovingPortsWithPositions(movingElement, deltaX, deltaY, movingPortsData);

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
