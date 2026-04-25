// TraceFormatter.js
import { Fitting } from './Fitting.js';

export class TraceFormatter {
  constructor(layerManager, connectionManager, showNotify) {
    this.layerManager = layerManager;
    this.connectionManager = connectionManager;
    this.showNotify = showNotify;
  }

  // Главный метод форматирования
  format() {
    console.log('=== ФОРМАТ ТРАССЫ ===');

    const allElements = this.layerManager.getAllElements();
    const ducts = allElements.filter(el => el.type === 'duct');
    const existingFittings = allElements.filter(el => el.type === 'fitting');

    console.log(`Найдено воздуховодов: ${ducts.length}`);
    console.log(`Существующих фитингов: ${existingFittings.length}`);

    // 1. Анализируем все соединения портов
    const junctions = this.analyzeJunctions(ducts);

    console.log(`Найдено узлов соединений: ${junctions.length}`);

    // 2. Для каждого узла определяем нужный фитинг
    const newFittings = [];
    const updatedFittings = [];

    for (const junction of junctions) {
      // Проверяем, есть ли уже фитинг в этой точке
      const existingFitting = this.findFittingAt(junction.x, junction.y, existingFittings);

      if (existingFitting) {
        // Обновляем существующий фитинг
        const newType = this.determineFittingType(junction);
        if (newType !== 'none') {
          if (existingFitting.fittingType !== newType) {
            existingFitting.fittingType = newType;
            // Если это отвод, устанавливаем угол
            if (newType === 'elbow' && junction.detectedAngle) {
              existingFitting.angle = junction.detectedAngle;
            }
            updatedFittings.push(existingFitting);
            console.log(`Обновлен фитинг ${existingFitting.id}: ${newType}${newType === 'elbow' ? ` (${existingFitting.angle}°)` : ''}`);
          } else if (newType === 'elbow' && junction.detectedAngle && existingFitting.angle !== junction.detectedAngle) {
            // Обновляем угол если изменился
            existingFitting.angle = junction.detectedAngle;
            updatedFittings.push(existingFitting);
            console.log(`Обновлен угол фитинга ${existingFitting.id}: ${existingFitting.angle}°`);
          }
        }
      } else {
        // Создаем новый фитинг
        const fittingType = this.determineFittingType(junction);
        if (fittingType !== 'none') {
          const newFitting = this.createFitting(junction, fittingType);
          newFittings.push(newFitting);
          console.log(`Создан фитинг ${newFitting.id}: ${fittingType}${fittingType === 'elbow' ? ` (${newFitting.angle}°)` : ''} в (${junction.x}, ${junction.y})`);
        }
      }
    }

    // 3. Добавляем новые фитинги в активный слой
    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      activeLayer.elements.push(...newFittings);
    }

    // 4. Обновляем связи (переподключаем порты через фитинги)
    this.updateConnectionsThroughFittings([...newFittings, ...updatedFittings]);

    // 5. Очищаем старые прямые соединения между воздуховодами
    this.cleanupDirectConnections(ducts);

    console.log(`Создано фитингов: ${newFittings.length}, обновлено: ${updatedFittings.length}`);

    this.showNotify({
      type: 'positive',
      message: `Трасса отформатирована: создано ${newFittings.length} фитингов, обновлено ${updatedFittings.length}`,
      timeout: 3000
    });

    return { newFittings, updatedFittings, junctions };
  }

  // Анализ всех соединений между воздуховодами
  analyzeJunctions(ducts) {
    const junctions = new Map();

    for (const duct of ducts) {
      if (!duct.ports) continue;

      for (const port of duct.ports) {
        if (!port.isConnected || !port.isConnected()) continue;

        const connections = port.getConnections();

        for (const conn of connections) {
          const connectedElement = this.layerManager.getElementById(conn.connectedElementId);

          if (connectedElement && connectedElement.type === 'duct') {
            const key = `${Math.round(port.worldX * 10)},${Math.round(port.worldY * 10)}`;

            if (!junctions.has(key)) {
              junctions.set(key, {
                x: port.worldX,
                y: port.worldY,
                ports: [],
                ducts: new Set(),
                angles: []
              });
            }

            const junction = junctions.get(key);

            if (!junction.ports.find(p => p.id === port.id)) {
              junction.ports.push(port);
            }

            junction.ducts.add(duct.id);
            const angle = this.getPortAngle(port, duct);
            junction.angles.push(angle);
          }
        }
      }
    }

    const result = [];
    for (const [key, junction] of junctions) {
      const uniqueAngles = [...new Set(junction.angles.map(a => Math.round(a / 45) * 45))];

      result.push({
        ...junction,
        key,
        portCount: junction.ports.length,
        ductCount: junction.ducts.size,
        uniqueAngles
      });
    }

    return result;
  }

  // Определение типа фитинга по соединению
  determineFittingType(junction) {
    const ductCount = junction.ductCount;
    const portCount = junction.portCount;

    const ducts = this.getDuctsAtJunction(junction);

    console.log(`Анализ узла: ductCount=${ductCount}, portCount=${portCount}`);

    // 2 воздуховода
    if (ductCount === 2) {
      return this.analyzeTwoDucts(junction, ducts);
    }

    // 3 воздуховода - тройник
    if (ductCount === 3) {
      return 'tee';
    }

    // 4 воздуховода - крестовина
    if (ductCount === 4) {
      return 'cross';
    }

    // Переход
    if (portCount >= 3 && ductCount === 2) {
      return 'transition';
    }

    return 'none';
  }

  // Анализ двух воздуховодов
  analyzeTwoDucts(junction, ducts) {
    const duct1 = ducts[0];
    const duct2 = ducts[1];

    const size1 = this.getDuctSize(duct1);
    const size2 = this.getDuctSize(duct2);

    const angle1 = junction.angles[0];
    const angle2 = junction.angles[1];
    const angleDiff = this.getAngleDifference(angle1, angle2);

    console.log(`  2 воздуховода: разница углов=${angleDiff}°`);

    const isDifferentSize = this.areSizesDifferent(size1, size2);
    const isCollinear = Math.abs(angleDiff - 180) < 15 || Math.abs(angleDiff) < 15;

    // Переход (разные размеры, соосно)
    if (isDifferentSize && isCollinear) {
      console.log(`    → ПЕРЕХОД`);
      return 'transition';
    }

    // Отвод (есть угол)
    const isAngled = Math.abs(angleDiff - 180) > 15 && Math.abs(angleDiff) > 15;

    if (isAngled) {
      if (Math.abs(angleDiff - 90) < 20) {
        junction.detectedAngle = 90;
      } else if (Math.abs(angleDiff - 45) < 15) {
        junction.detectedAngle = 45;
      } else if (Math.abs(angleDiff - 60) < 15) {
        junction.detectedAngle = 60;
      } else if (Math.abs(angleDiff - 30) < 15) {
        junction.detectedAngle = 30;
      } else {
        junction.detectedAngle = Math.round(angleDiff);
      }
      console.log(`    → ОТВОД (${junction.detectedAngle}°)`);
      return 'elbow';
    }

    // Соосное соединение - фитинг не нужен
    if (isCollinear) {
      console.log(`    → БЕЗ ФИТИНГА (соосно)`);
      return 'none';
    }

    return 'none';
  }

  // Получение воздуховодов в узле
  getDuctsAtJunction(junction) {
    const ducts = [];
    const allElements = this.layerManager.getAllElements();

    for (const ductId of junction.ducts) {
      const duct = allElements.find(el => el.id === ductId && el.type === 'duct');
      if (duct) ducts.push(duct);
    }

    return ducts;
  }

  // Получение размеров воздуховода
  getDuctSize(duct) {
    if (duct.sectionType === 'round') {
      return {
        type: 'round',
        width: duct.a || 125,
        height: duct.a || 125,
        area: Math.PI * Math.pow((duct.a || 125) / 2, 2)
      };
    } else {
      return {
        type: 'rectangular',
        width: duct.a || 125,
        height: duct.c || 100,
        area: (duct.a || 125) * (duct.c || 100)
      };
    }
  }

  // Проверка разных размеров
  areSizesDifferent(size1, size2) {
    if (size1.type === 'round' && size2.type === 'round') {
      return Math.abs(size1.width - size2.width) > 10;
    }

    if (size1.type === 'rectangular' && size2.type === 'rectangular') {
      const widthDiff = Math.abs(size1.width - size2.width);
      const heightDiff = Math.abs(size1.height - size2.height);
      return widthDiff > 10 || heightDiff > 10;
    }

    return true;
  }

  // Получение угла порта
  getPortAngle(port, element) {
    const side = port.side;
    const rotation = element.rotation || 0;

    const sideAngles = {
      'left': 180,
      'right': 0,
      'top': 270,
      'bottom': 90,
      'center': 0
    };

    let baseAngle = sideAngles[side] || 0;
    let angle = (baseAngle + rotation) % 360;

    return angle;
  }

  // Разница между двумя углами
  getAngleDifference(angle1, angle2) {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  // Поиск существующего фитинга в точке
  findFittingAt(x, y, existingFittings) {
    const tolerance = 15;

    for (const fitting of existingFittings) {
      const dx = Math.abs(fitting.x - x);
      const dy = Math.abs(fitting.y - y);
      if (dx < tolerance && dy < tolerance) {
        return fitting;
      }
    }
    return null;
  }

  // Создание нового фитинга
  // Создание нового фитинга
  createFitting(junction, fittingType) {
    const nextId = this.layerManager.getNextElementId();

    const fitting = new Fitting(nextId, junction.x, junction.y, fittingType);

    if (fittingType === 'elbow' && junction.detectedAngle) {
      fitting.angle = junction.detectedAngle;
    }

    fitting.connectedPortIds = junction.ports.map(p => p.id);

    // ВАЖНО: обновляем порты фитинга!
    fitting.updatePorts();

    if (fitting.showCallout) {
      fitting.addCallout(fitting.x, fitting.y - 40);
      fitting.updateCalloutText();
    }

    return fitting;
  }

  // Обновление связей через фитинги
  updateConnectionsThroughFittings(allFittings) {
    for (const fitting of allFittings) {
      const portsAtPoint = this.findPortsAtPoint(fitting.x, fitting.y);

      for (const port of portsAtPoint) {
        this.connectionManager.disconnectPort(port);
      }

      const fittingPort = fitting.getPorts()[0];
      if (fittingPort) {
        for (const port of portsAtPoint) {
          this.connectionManager.connectPorts(port, fittingPort);
        }
      }
    }
  }

  // Поиск всех портов в точке
  findPortsAtPoint(x, y) {
    const tolerance = 10;
    const allPorts = this.connectionManager.getAllPorts();

    return allPorts.filter(port => {
      const dx = Math.abs(port.worldX - x);
      const dy = Math.abs(port.worldY - y);
      return dx < tolerance && dy < tolerance;
    });
  }

  // Очистка прямых соединений между воздуховодами
  cleanupDirectConnections(ducts) {
    const allElements = this.layerManager.getAllElements();
    const fittings = allElements.filter(el => el.type === 'fitting');
    const fittingPositions = new Set();

    for (const fitting of fittings) {
      const key = `${Math.round(fitting.x * 10)},${Math.round(fitting.y * 10)}`;
      fittingPositions.add(key);
    }

    for (const duct of ducts) {
      for (const port of duct.ports) {
        const portKey = `${Math.round(port.worldX * 10)},${Math.round(port.worldY * 10)}`;

        if (fittingPositions.has(portKey)) {
          const connections = port.getConnections();
          for (const conn of connections) {
            const connectedEl = this.layerManager.getElementById(conn.connectedElementId);
            if (connectedEl && connectedEl.type === 'duct') {
              this.connectionManager.disconnectPort(port, conn.connectedPortId);
            }
          }
        }
      }
    }
  }
}
