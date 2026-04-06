export class ConnectionManager {
  constructor(elements, layerManager = null) {
    this.elements = elements; // теперь это computed allElements
    this.layerManager = layerManager;
    this.connections = new Map(); // portId -> { connectedPortId, elementId }
  }

  // Получение всех портов со всех элементов (включая группы)
  getAllPorts() {
    const allPorts = [];
    const allElements = this.elements.value || [];

    const collectPorts = (elements) => {
      for (const element of elements) {
        if (element.ports && element.ports.length > 0) {
          allPorts.push(...element.ports);
        }
        if (element.type === 'group' && element.elements) {
          collectPorts(element.elements);
        }
      }
    };

    collectPorts(allElements);
    return allPorts;
  }

  // Получение порта по ID
  getPortById(portId) {
    const allPorts = this.getAllPorts();
    return allPorts.find(port => port.id === portId);
  }

  // Получение элемента по ID
  getElementById(elementId) {
    const allElements = this.elements.value || [];
    const findElement = (elements) => {
      for (const element of elements) {
        if (element.id === elementId) return element;
        if (element.type === 'group' && element.elements) {
          const found = findElement(element.elements);
          if (found) return found;
        }
      }
      return null;
    };
    return findElement(allElements);
  }

  // Проверка, можно ли соединять порты (учитывая блокировку слоёв)
  canConnectPorts(port1, port2) {
    if (!port1 || !port2) return false;

    // Нельзя соединять порт с самим собой
    if (port1.id === port2.id) return false;

    // Нельзя соединять порты одного элемента
    if (port1.elementId === port2.elementId) return false;

    // Проверяем блокировку слоёв
    if (this.layerManager) {
      const element1 = this.getElementById(port1.elementId);
      const element2 = this.getElementById(port2.elementId);

      if (element1 && this.layerManager.isLayerLocked(element1)) return false;
      if (element2 && this.layerManager.isLayerLocked(element2)) return false;
    }

    // Правила соединения: inlet с outlet, или outlet с inlet
    const isValidPair = (port1.direction === 'inlet' && port2.direction === 'outlet') ||
                       (port1.direction === 'outlet' && port2.direction === 'inlet');

    // Также можно соединять branch с любым (кроме branch+branch)
    const isValidBranch = (port1.direction === 'branch' && port2.direction !== 'branch') ||
                          (port2.direction === 'branch' && port1.direction !== 'branch');

    return isValidPair || isValidBranch;
  }

  // Соединение двух портов
  connectPorts(port1, port2) {
    if (!this.canConnectPorts(port1, port2)) return false;

    // Разрываем существующие соединения
    if (port1.isConnected()) {
      this.disconnectPorts(port1, this.getPortById(port1.connectedPortId));
    }
    if (port2.isConnected()) {
      this.disconnectPorts(port2, this.getPortById(port2.connectedPortId));
    }

    // Устанавливаем новые соединения
    port1.connectedElementId = port2.elementId;
    port1.connectedPortId = port2.id;
    port2.connectedElementId = port1.elementId;
    port2.connectedPortId = port1.id;

    // Сохраняем в Map для быстрого доступа
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

  // Разрыв соединения между портами
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

  // Отключение всех портов элемента
  disconnectElement(element) {
    if (!element.ports) return false;

    for (const port of element.ports) {
      if (port.isConnected()) {
        const connectedPort = this.getPortById(port.connectedPortId);
        if (connectedPort) {
          this.disconnectPorts(port, connectedPort);
        }
      }
    }
    return true;
  }

  // Поиск ближайшего порта для привязки (для одиночного элемента)
  findClosestPort(port, maxDistance = 40) {
    const allPorts = this.getAllPorts();
    let closestPort = null;
    let minDistance = maxDistance;

    for (const targetPort of allPorts) {
      // Пропускаем свой порт и порты того же элемента
      if (targetPort.id === port.id || targetPort.elementId === port.elementId) continue;

      // Проверяем блокировку слоёв
      if (this.layerManager) {
        const targetElement = this.getElementById(targetPort.elementId);
        if (targetElement && this.layerManager.isLayerLocked(targetElement)) continue;
      }

      // Проверяем возможность соединения
      if (!this.canConnectPorts(port, targetPort)) continue;

      const distance = Math.hypot(port.worldX - targetPort.worldX, port.worldY - targetPort.worldY);
      if (distance < minDistance) {
        minDistance = distance;
        closestPort = targetPort;
      }
    }

    return closestPort;
  }

  // Поиск ближайшего порта для группы перемещаемых элементов
  findClosestPortsForMovingWithMultiple(movingElements, deltaX, deltaY, maxDistance = 40, layerManager = null) {
    let bestMatch = null;
    let bestDistance = maxDistance;

    // Получаем все порты перемещаемых элементов после перемещения
    const movingPortsAfterMove = [];
    for (const element of movingElements) {
      const portsAfterMove = element.getPortsAfterMove(deltaX, deltaY);
      movingPortsAfterMove.push(...portsAfterMove);
    }

    // Получаем все статичные порты (не из перемещаемых элементов)
    const allPorts = this.getAllPorts();
    const staticPorts = allPorts.filter(port => {
      const portElement = this.getElementById(port.elementId);
      return !movingElements.includes(portElement);
    });

    // Ищем лучшую пару для привязки
    for (const movingPort of movingPortsAfterMove) {
      for (const staticPort of staticPorts) {
        // Проверяем возможность соединения
        const tempMovingPort = { ...movingPort, elementId: movingPort.elementId };
        if (!this.canConnectPorts(tempMovingPort, staticPort)) continue;

        // Проверяем блокировку слоя статичного порта
        if (layerManager) {
          const staticElement = this.getElementById(staticPort.elementId);
          if (staticElement && layerManager.isLayerLocked(staticElement)) continue;
        }

        const distance = Math.hypot(movingPort.worldX - staticPort.worldX, movingPort.worldY - staticPort.worldY);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = {
            movingPort,
            targetPort: staticPort,
            offsetX: staticPort.worldX - movingPort.worldX,
            offsetY: staticPort.worldY - movingPort.worldY,
            distance
          };
        }
      }
    }

    return bestMatch;
  }

  // Автоматическое обновление всех связей (восстановление после загрузки)
  updateAllPortsAndConnections(maxIterations = 10, layerManager = null) {
    let restoredCount = 0;
    let changed = true;
    let iteration = 0;

    // Получаем все порты
    const allPorts = this.getAllPorts();

    // Создаем Map для быстрого поиска портов по ID
    const portMap = new Map();
    for (const port of allPorts) {
      portMap.set(port.id, port);
    }

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      for (const port of allPorts) {
        // Если порт уже подключен, проверяем валидность соединения
        if (port.isConnected()) {
          const connectedPort = portMap.get(port.connectedPortId);

          // Если соединение невалидно или порты на заблокированных слоях
          if (!connectedPort || !this.canConnectPorts(port, connectedPort) ||
              (layerManager && this.isPortOnLockedLayer(port, layerManager)) ||
              (layerManager && connectedPort && this.isPortOnLockedLayer(connectedPort, layerManager))) {
            // Разрываем соединение
            if (connectedPort) {
              this.disconnectPorts(port, connectedPort);
            } else {
              port.connectedElementId = null;
              port.connectedPortId = null;
              this.connections.delete(port.id);
            }
            changed = true;
            restoredCount++;
          }
          continue;
        }

        // Пытаемся найти подходящий порт для соединения
        const bestMatch = this.findClosestPort(port, 50);
        if (bestMatch) {
          this.connectPorts(port, bestMatch);
          restoredCount++;
          changed = true;
        }
      }
    }

    return restoredCount;
  }

  // Проверка, находится ли порт на заблокированном слое
  isPortOnLockedLayer(port, layerManager) {
    if (!layerManager) return false;
    const element = this.getElementById(port.elementId);
    return element ? layerManager.isLayerLocked(element) : false;
  }

  // Получение всех соединений для отладки
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

  // Очистка всех соединений
  clearAllConnections() {
    const allPorts = this.getAllPorts();
    for (const port of allPorts) {
      port.connectedElementId = null;
      port.connectedPortId = null;
    }
    this.connections.clear();
  }
}
