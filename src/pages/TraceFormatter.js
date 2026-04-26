// TraceFormatter.js
import { Fitting } from './Fitting.js';
import { Logger } from './Logger.js';

export class TraceFormatter {
  constructor(layerManager, connectionManager, showNotify) {
    this.layerManager = layerManager;
    this.connectionManager = connectionManager;
    this.showNotify = showNotify;
  }

  format() {
    Logger.info('=== ФОРМАТ ТРАССЫ ===');

    const allElements = this.layerManager.getAllElements();
    const ducts = allElements.filter(el => el.type === 'duct');
    const existingFittings = allElements.filter(el => el.type === 'fitting');

    Logger.info(`Найдено воздуховодов: ${ducts.length}`);
    Logger.info(`Существующих фитингов: ${existingFittings.length}`);

    const junctions = this.analyzeJunctions(ducts);
    Logger.info(`Найдено узлов соединений: ${junctions.length}`);

    const newFittings = [];
    const updatedFittings = [];

    for (const junction of junctions) {
      const existingFitting = this.findFittingAt(junction.x, junction.y, existingFittings);

      if (existingFitting) {
        const newType = this.determineFittingType(junction);
        if (newType !== 'none') {
          if (existingFitting.fittingType !== newType) {
            existingFitting.fittingType = newType;
            if (newType === 'elbow' && junction.detectedAngle) {
              existingFitting.angle = junction.detectedAngle;
            }
            updatedFittings.push(existingFitting);
            Logger.info(`Обновлен фитинг ${existingFitting.id}: ${newType}${newType === 'elbow' ? ` (${existingFitting.angle}°)` : ''}`);
          } else if (newType === 'elbow' && junction.detectedAngle && existingFitting.angle !== junction.detectedAngle) {
            existingFitting.angle = junction.detectedAngle;
            updatedFittings.push(existingFitting);
            Logger.info(`Обновлен угол фитинга ${existingFitting.id}: ${existingFitting.angle}°`);
          }
        }
      } else {
        const fittingType = this.determineFittingType(junction);
        if (fittingType !== 'none') {
          const newFitting = this.createFitting(junction, fittingType);
          newFittings.push(newFitting);
          Logger.success(`Создан фитинг ${newFitting.id}: ${fittingType}${fittingType === 'elbow' ? ` (${newFitting.angle}°)` : ''} в (${Math.round(junction.x)}, ${Math.round(junction.y)})`);
        }
      }
    }

    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      activeLayer.elements.push(...newFittings);
    }

    this.updateConnectionsThroughFittings([...newFittings, ...updatedFittings]);
    this.cleanupDirectConnections(ducts);

    Logger.success(`Создано фитингов: ${newFittings.length}, обновлено: ${updatedFittings.length}`);

    this.showNotify({
      type: 'positive',
      message: `Трасса отформатирована: создано ${newFittings.length} фитингов, обновлено ${updatedFittings.length}`,
      timeout: 3000
    });

    return { newFittings, updatedFittings, junctions };
  }

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
      result.push({
        ...junction,
        key,
        portCount: junction.ports.length,
        ductCount: junction.ducts.size
      });
    }

    return result;
  }

  determineFittingType(junction) {
    const ductCount = junction.ductCount;
    const portCount = junction.portCount;
    const ducts = this.getDuctsAtJunction(junction);

    Logger.info(`Анализ узла: ductCount=${ductCount}, portCount=${portCount}`);

    if (ductCount === 2) {
      return this.analyzeTwoDucts(junction, ducts);
    }

    if (ductCount === 3) {
      Logger.info(`  → ТРОЙНИК`);
      return 'tee';
    }

    if (ductCount === 4) {
      Logger.info(`  → КРЕСТОВИНА`);
      return 'cross';
    }

    if (portCount >= 3 && ductCount === 2) {
      Logger.info(`  → ПЕРЕХОД`);
      return 'transition';
    }

    return 'none';
  }

  analyzeTwoDucts(junction, ducts) {
    const duct1 = ducts[0];
    const duct2 = ducts[1];

    const size1 = this.getDuctSize(duct1);
    const size2 = this.getDuctSize(duct2);

    Logger.warn(`size1 ${size1.area}`);
    Logger.warn(`size2 ${size2.area}`);
    const angle1 = junction.angles[0];
    const angle2 = junction.angles[1];
    const angleDiff = this.getAngleDifference(angle1, angle2);

    const isDifferentSize = this.areSizesDifferent(size1, size2);
    const isCollinear = Math.abs(angleDiff - 180) < 15 || Math.abs(angleDiff) < 15;

    Logger.info(`  2 воздуховода: разница углов=${Math.round(angleDiff)}°, ${isDifferentSize ? 'разные размеры' : 'одинаковые'}`);

    if (isDifferentSize && isCollinear) {
      Logger.warn(`    → ПЕРЕХОД`);
      return 'transition';
    }

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
      Logger.warn(`    → ОТВОД (${junction.detectedAngle}°)`);
      return 'elbow';
    }

    if (isCollinear) {
      Logger.info(`    → БЕЗ ФИТИНГА (соосно)`);
      return 'none';
    }

    return 'none';
  }

  getDuctsAtJunction(junction) {
    const ducts = [];
    const allElements = this.layerManager.getAllElements();

    for (const ductId of junction.ducts) {
      const duct = allElements.find(el => el.id === ductId && el.type === 'duct');
      if (duct) ducts.push(duct);
    }

    return ducts;
  }

  getDuctSize(duct) {
    if (duct.sectionType === 'round') {
      return {
        type: 'round',
        width: duct.a,
        height: duct.a,
        area: (Math.PI * Math.pow((duct.a) / 2, 2)).toFixed(0),
      };
    } else {
      return {
        type: 'rectangular',
        width: duct.a,
        height: duct.c,
        area: ((duct.a) * (duct.c)).toFixed(0),
      };
    }
  }

  areSizesDifferent(size1, size2) {
    if ((size1.type === 'round' && size2.type === 'rectangular') || (size1.type === 'rectangular' && size2.type === 'round')) {
      return true;
    } else {
      if (size1.type === 'round' && size2.type === 'round') {
        return Math.abs(size1.width - size2.width) > 0;
      } else if (size1.type === 'rectangular' && size2.type === 'rectangular') {
        const widthDiff = Math.abs(size1.width - size2.width);
        const heightDiff = Math.abs(size1.height - size2.height);
        return widthDiff > 0 || heightDiff > 0;
      }
    }
    return false;
  }

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

  getAngleDifference(angle1, angle2) {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

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

  createFitting(junction, fittingType) {



    const nextId = this.layerManager.getNextElementId();
    const fitting = new Fitting(nextId, junction.x, junction.y, fittingType);

    if (fittingType === 'elbow' && junction.detectedAngle) {
      fitting.angle = junction.detectedAngle;
    }

    if (fittingType === 'transition') {
      const [d1, d2] = this.getDuctsAtJunction(junction);
      fitting.sectionType = d1.sectionType;
      fitting.sectionType2 = d2.sectionType;
    }


    fitting.connectedPortIds = junction.ports.map(p => p.id);
    fitting.updatePorts();

    if (fitting.showCallout) {
      fitting.addCallout(fitting.x, fitting.y - 40);
      fitting.updateCalloutText();
    }

    return fitting;
  }

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

  findPortsAtPoint(x, y) {
    const tolerance = 10;
    const allPorts = this.connectionManager.getAllPorts();

    return allPorts.filter(port => {
      const dx = Math.abs(port.worldX - x);
      const dy = Math.abs(port.worldY - y);
      return dx < tolerance && dy < tolerance;
    });
  }

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
