// ConnectionManager.js

export class ConnectionManager {
  constructor(elements, layerManager = null) {
    this.elements = elements;
    this.layerManager = layerManager;
    this.connections = new Map(); // Оставляем для быстрого доступа, но теперь порты хранят массив
    this.isUpdating = false;
  }

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

    // Убираем проверку на уже существующее соединение?
    // НЕТ, нужно проверять, но не блокировать если порт1 имеет другие соединения
    // Просто проверяем конкретную пару
    const alreadyConnected = port1.connections.some(
      c => c.connectedElementId === port2.elementId && c.connectedPortId === port2.id
    );
    if (alreadyConnected) return false; // Эта конкретная пара уже соединена

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

    // Добавляем двусторонние связи
    port1.addConnection(port2.elementId, port2.id);
    port2.addConnection(port1.elementId, port1.id);

    // Обновляем Map для быстрого доступа
    this.updateConnectionMap();

    return true;
  }

  updateConnectionMap() {
    this.connections.clear();
    const allPorts = this.getAllPorts();
    for (const port of allPorts) {
      for (const conn of port.connections) {
        this.connections.set(port.id + '_' + conn.connectedPortId, {
          connectedPortId: conn.connectedPortId,
          elementId: conn.connectedElementId
        });
      }
    }
  }

  disconnectPort(port, targetPortId = null) {
    if (!port) return false;

    if (targetPortId) {
      // Отключаем только от конкретного порта
      const targetPort = this.getPortById(targetPortId);
      if (targetPort) {
        port.removeConnection(targetPort.elementId, targetPortId);
        targetPort.removeConnection(port.elementId, port.id);
      }
    } else {
      // Отключаем от всех
      for (const conn of port.connections) {
        const connectedPort = this.getPortById(conn.connectedPortId);
        if (connectedPort) {
          connectedPort.removeConnection(port.elementId, port.id);
        }
      }
      port.removeAllConnections();
    }

    this.updateConnectionMap();
    return true;
  }

  disconnectPorts(port1, port2) {
    if (!port1 || !port2) return false;

    port1.removeConnection(port2.elementId, port2.id);
    port2.removeConnection(port1.elementId, port1.id);

    this.updateConnectionMap();
    return true;
  }

  disconnectElement(element) {
    if (!element.ports) return false;
    for (const port of element.ports) {
      this.disconnectPort(port);
    }
    return true;
  }

  findClosestPort(port, maxDistance = 10) {
    const allPorts = this.getAllPorts();
    let closestPort = null;
    let minDistance = maxDistance;

    for (const targetPort of allPorts) {
      if (targetPort.id === port.id) continue;
      if (targetPort.elementId === port.elementId) continue;

      // НЕ ПРОВЕРЯЕМ targetPort.connections.length > 0 - пропускаем эту проверку!
      // Просто проверяем можно ли соединить
      if (!this.canConnectPorts(port, targetPort)) continue;

      const distance = Math.hypot(port.worldX - targetPort.worldX, port.worldY - targetPort.worldY);
      if (distance < minDistance) {
        minDistance = distance;
        closestPort = targetPort;
      }
    }

    return closestPort;
  }

  updateAllPortsAndConnections(maxDistance = 10, layerManager = null) {
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

      // 1. Проверяем существующие связи
      for (const port of allPorts) {
        const connectionsToRemove = [];
        for (const conn of port.connections) {
          const connectedPort = portMap.get(conn.connectedPortId);

          if (!connectedPort) {
            connectionsToRemove.push(conn);
            brokenCount++;
            continue;
          }

          // Проверяем взаимность связи
          const isMutual = connectedPort.connections.some(
            c => c.connectedPortId === port.id
          );

          if (!isMutual) {
            connectionsToRemove.push(conn);
            brokenCount++;
            continue;
          }

          // Проверяем расстояние
          const distance = Math.hypot(port.worldX - connectedPort.worldX, port.worldY - connectedPort.worldY);
          if (distance > maxDistance) {
            connectionsToRemove.push(conn);
            brokenCount++;
          }
        }

        for (const conn of connectionsToRemove) {
          port.removeConnection(conn.connectedElementId, conn.connectedPortId);
        }
      }

      // 2. Создаем новые связи - ВАЖНО: порт коллектора может иметь МНОГО соединений
      // Сортируем порты: сначала те, у которых мало соединений (приоритет)
      const sortedPorts = [...allPorts].sort((a, b) => {
        // Приоритет у портов с меньшим количеством соединений
        return (a.connections?.length || 0) - (b.connections?.length || 0);
      });

      for (const port of sortedPorts) {
        // Находим ближайший порт, даже если у порта уже есть соединения
        const bestMatch = this.findClosestPort(port, maxDistance);
        if (bestMatch) {
          // Проверяем, не соединены ли уже эти порты
          const alreadyConnected = port.connections.some(
            c => c.connectedPortId === bestMatch.id
          );

          if (!alreadyConnected) {
            this.connectPorts(port, bestMatch);
            connectedCount++;
            // console.log(`Соединен порт ${port.id} с ${bestMatch.id}`);
          }
        }
      }
    } finally {
      this.isUpdating = false;
    }

    if (brokenCount > 0 || connectedCount > 0) {
      // console.log(`Связи: разорвано ${brokenCount}, создано ${connectedCount}`);
    }

    return { broken: brokenCount, connected: connectedCount };
  }

  getAllConnections() {
    const connections = [];
    const allPorts = this.getAllPorts();
    for (const port of allPorts) {
      for (const conn of port.connections) {
        connections.push({
          portId: port.id,
          connectedPortId: conn.connectedPortId,
          elementId: conn.connectedElementId
        });
      }
    }
    return connections;
  }

  clearAllConnections() {
    const allPorts = this.getAllPorts();
    for (const port of allPorts) {
      port.connections = [];
    }
    this.connections.clear();
  }
}
