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

  updateAllPortsAndConnections(radius = 5) {
    console.log('=== АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ СВЯЗЕЙ ПО БЛИЗОСТИ ПОРТОВ ===');

    // 1. Удаляем ВСЕ связи у всех элементов
    const removeAllConnections = (element) => {
      if (element.ports) {
        element.ports.forEach(port => {
          port.disconnect();
        });
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(removeAllConnections);
      }
    };
    this.elements.value.forEach(removeAllConnections);
    console.log('Все связи удалены');

    // 2. Обновляем геометрию всех портов (без изменения позиций)
    const updatePortsOnly = (element) => {
      const savedX = element.x;
      const savedY = element.y;
      const savedRotation = element.rotation;

      if (element.updatePorts) {
        element.updatePorts();
      }

      element.x = savedX;
      element.y = savedY;
      element.rotation = savedRotation;

      if (element.type === 'group' && element.elements) {
        element.elements.forEach(updatePortsOnly);
      }
    };
    this.elements.value.forEach(updatePortsOnly);
    console.log('Геометрия портов обновлена');

    // 3. Автоматически восстанавливаем связи по близости портов
    const allPorts = this.getAllPorts();
    let connectionsRestored = 0;
    const processedPorts = new Set();

    for (let i = 0; i < allPorts.length; i++) {
      const port1 = allPorts[i];

      if (port1.isConnected() || processedPorts.has(port1.id)) continue;

      let closestPort = null;
      let minDistance = radius + 1;

      for (let j = 0; j < allPorts.length; j++) {
        const port2 = allPorts[j];

        if (port1.id === port2.id) continue;
        if (port1.elementId === port2.elementId) continue;
        if (port2.isConnected()) continue;

        const dx = port1.worldX - port2.worldX;
        const dy = port1.worldY - port2.worldY;
        const distance = Math.hypot(dx, dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestPort = port2;
        }
      }

      if (closestPort && minDistance <= radius) {
        this.connectPorts(port1, closestPort);
        processedPorts.add(port1.id);
        processedPorts.add(closestPort.id);
        connectionsRestored++;
        console.log(`Соединены порты ${port1.id} (${port1.direction}) и ${closestPort.id} (${closestPort.direction}), расстояние: ${minDistance.toFixed(2)}px`);
      }
    }

    console.log(`Восстановлено связей: ${connectionsRestored}`);
    console.log('=== ОБНОВЛЕНИЕ ЗАВЕРШЕНО ===');

    return connectionsRestored;
  }
  // В ConnectionManager добавьте метод, который принимает список перемещаемых элементов
  findClosestPortsForMovingWithMultiple(movingElements, deltaX, deltaY, maxDistance = 40) {
    // Собираем ID всех перемещаемых элементов (включая содержимое групп)
    const allMovingIds = new Set();
    movingElements.forEach(element => {
      this.collectElementIds(element, allMovingIds);
    });

    // Получаем все порты, исключая порты перемещаемых элементов
    const allPorts = this.getAllPorts();
    const staticPorts = allPorts.filter(port => !allMovingIds.has(port.elementId));

    let bestMatch = null;
    let bestDistance = maxDistance;

    // Для каждого перемещаемого элемента собираем его порты со смещением
    for (const movingElement of movingElements) {
      const movingPortsData = [];
      this.collectMovingPortsWithPositions(movingElement, deltaX, deltaY, movingPortsData);

      for (const movingData of movingPortsData) {
        for (const targetPort of staticPorts) {
          const distance = Math.hypot(movingData.worldX - targetPort.worldX, movingData.worldY - targetPort.worldY);

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = {
              movingPort: movingData.port,
              targetPort: targetPort,
              distance: distance,
              offsetX: targetPort.worldX - movingData.worldX,
              offsetY: targetPort.worldY - movingData.worldY,
              element: movingElement
            };
          }
        }
      }
    }

    return bestMatch;
  }
}
