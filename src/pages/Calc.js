// Calc.js - аэродинамический расчет с поддержкой фитингов
import { Logger } from './Logger.js';

export class Calc {
  constructor(elements, options = {}) {
    this.elements = elements;
    this.options = {
      mmPerPx: options.mmPerPx || 2,
      totalAirFlow: options.totalAirFlow || 3000,
      temperature: options.temperature || 20,
      atmosphericPressure: options.atmosphericPressure || 101300,
      roughness: options.roughness || 0.1,
      ...options
    };
    this.results = {
      traces: [],
      totalLosses: 0,
      totalFlow: 0,
      tracesCount: 0
    };
  }

  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }

  async calculate() {
    Logger.info('=== НАЧАЛО АЭРОДИНАМИЧЕСКОГО РАСЧЕТА ===');

    return new Promise((resolve, reject) => {
      try {
        const allElements = this.getAllElements();
        Logger.info(`Всего элементов: ${allElements.length}`);
        Logger.info(`  Воздуховодов: ${allElements.filter(el => el.type === 'duct').length}`);
        Logger.info(`  Фитингов: ${allElements.filter(el => el.type === 'fitting').length}`);

        if (allElements.length === 0) {
          Logger.error('Нет элементов для расчета');
          reject(new Error('Нет элементов для расчета'));
          return;
        }

        const graph = this.buildGraph(allElements);
        Logger.info(`Граф: ${graph.nodes.size} узлов, ${graph.edges.length} связей`);

        const traces = this.findAllTraces(graph);
        Logger.info(`Найдено трасс: ${traces.length}`);

        if (traces.length === 0) {
          Logger.error('Не найдено ни одной трассы');
          reject(new Error('Не найдено ни одной трассы. Проверьте соединения воздуховодов.'));
          return;
        }

        const traceResults = [];
        let totalLosses = 0;
        let totalFlow = 0;

        for (let i = 0; i < traces.length; i++) {
          const result = this.calculateTrace(traces[i], i + 1);
          traceResults.push(result);
          totalLosses += result.losses;
          totalFlow += result.flow;
          Logger.success(`Трасса ${i + 1}: ${result.sections.length} участков, потери ${result.losses.toFixed(2)} Па`);
        }

        this.results = {
          traces: traceResults,
          totalLosses,
          totalFlow,
          tracesCount: traces.length,
          timestamp: new Date().toISOString()
        };

        Logger.success(`=== РАСЧЕТ ЗАВЕРШЕН ===`);
        Logger.success(`Суммарные потери: ${totalLosses.toFixed(2)} Па`);
        Logger.success(`Общий расход: ${totalFlow} м³/ч`);

        resolve(this.results);
      } catch (error) {
        Logger.error(`Ошибка расчета: ${error.message}`);
        reject(error);
      }
    });
  }

  getAllElements() {
    if (!this.elements) return [];

    if (Array.isArray(this.elements)) {
      return this.elements;
    }

    if (this.elements.value && Array.isArray(this.elements.value)) {
      const result = [];
      for (const layer of this.elements.value) {
        if (layer.visible !== false) {
          result.push(...layer.elements);
        }
      }
      return result;
    }

    return [];
  }

  buildGraph(elements) {
    const nodes = new Map();
    const edges = [];

    for (const el of elements) {
      nodes.set(el.id, el);
    }

    for (const el of elements) {
      if (el.ports && el.ports.length) {
        for (const port of el.ports) {
          if (port.connections && port.connections.length) {
            for (const conn of port.connections) {
              const targetElement = nodes.get(conn.connectedElementId);
              if (targetElement) {
                const edgeKey = [el.id, conn.connectedElementId].sort().join('_');
                if (!edges.some(e => e.key === edgeKey)) {
                  edges.push({
                    key: edgeKey,
                    from: el.id,
                    to: conn.connectedElementId,
                    fromPort: port,
                    toPortId: conn.connectedPortId,
                    fromType: el.type,
                    toType: targetElement.type
                  });
                }
              }
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  // Поиск концевых точек (воздуховоды, у которых только одно соединение)
  findEndpoints(graph) {
    const endpoints = [];
    const connectionCount = new Map();

    // Подсчитываем количество соединений для каждого узла
    for (const edge of graph.edges) {
      // Считаем только соединения воздуховод-воздуховод (без фитингов)
      const fromEl = graph.nodes.get(edge.from);
      const toEl = graph.nodes.get(edge.to);

      if (fromEl?.type === 'duct' && toEl?.type === 'duct') {
        connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
        connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
      }
    }

    // Находим узлы с одним соединением
    for (const [nodeId, count] of connectionCount) {
      if (count === 1) {
        const element = graph.nodes.get(nodeId);
        if (element && element.type === 'duct') {
          endpoints.push(element);
          Logger.info(`Концевая точка: ${this.getElementName(element)}`);
        }
      }
    }

    // Если нет концевых точек, значит система замкнутая (кольцевая)
    if (endpoints.length === 0) {
      Logger.warn('Система замкнутая (кольцевая), концевых точек не найдено');
      // Возвращаем все воздуховоды как потенциальные начала
      for (const [nodeId, element] of graph.nodes) {
        if (element.type === 'duct') {
          endpoints.push(element);
          break; // берем только первый
        }
      }
    }

    return endpoints;
  }

  findAllTraces(graph) {
    const traces = [];
    const visitedTraces = new Set(); // для отслеживания уникальных трасс

    // Находим все концевые точки (воздуховоды с 1 соединением)
    const endpoints = this.findEndpoints(graph);
    Logger.info(`Найдено концевых точек: ${endpoints.length}`);

    // Для каждой концевой точки строим трассу
    for (const endpoint of endpoints) {
      const trace = this.buildTraceFromEndpoint(graph, endpoint);
      if (trace && trace.length > 0) {
        // Создаем ключ трассы (из ID первого и последнего элемента)
        const firstId = trace[0].from.id;
        const lastId = trace[trace.length - 1].to.id;
        const traceKey = `${Math.min(firstId, lastId)}_${Math.max(firstId, lastId)}`;

        if (!visitedTraces.has(traceKey)) {
          visitedTraces.add(traceKey);
          traces.push(trace);
          Logger.info(`Найдена трасса: ${trace.length} участков, от ${this.getElementName(trace[0].from)} до ${this.getElementName(trace[trace.length - 1].to)}`);
        }
      }
    }

    // Если нет концевых точек (замкнутая система), берем любой воздуховод и идем в обе стороны
    if (traces.length === 0 && graph.nodes.size > 0) {
      Logger.warn('Замкнутая система, поиск циклических трасс');
      const anyDuct = Array.from(graph.nodes.values()).find(el => el.type === 'duct');
      if (anyDuct) {
        const traceForward = this.buildTraceFromEndpoint(graph, anyDuct, true);
        if (traceForward.length > 0) traces.push(traceForward);
      }
    }

    return traces;
  }

  buildTraceFromEndpoint(graph, startElement, isCyclic = false) {
    const trace = [];
    let currentElement = startElement;
    let previousElementId = null;
    let maxIterations = 100;
    let iterations = 0;
    const visited = new Set(); // предотвращаем зацикливание

    while (currentElement && iterations < maxIterations && !visited.has(currentElement.id)) {
      visited.add(currentElement.id);
      iterations++;

      // Ищем следующее ребро (не возвращаясь назад)
      const nextEdge = graph.edges.find(edge => {
        if (edge.from === currentElement.id && edge.to !== previousElementId) {
          return true;
        }
        if (edge.to === currentElement.id && edge.from !== previousElementId) {
          return true;
        }
        return false;
      });

      if (!nextEdge) break;

      const nextElementId = nextEdge.from === currentElement.id ? nextEdge.to : nextEdge.from;
      const nextElement = graph.nodes.get(nextElementId);

      if (!nextElement) break;

      // Если следующий элемент - фитинг, пропускаем и идем дальше
      if (nextElement.type === 'fitting') {
        const nextAfterFitting = graph.edges.find(edge => {
          if (edge.from === nextElement.id && edge.to !== currentElement.id) {
            return true;
          }
          if (edge.to === nextElement.id && edge.from !== currentElement.id) {
            return true;
          }
          return false;
        });

        if (nextAfterFitting) {
          const afterFittingId = nextAfterFitting.from === nextElement.id ? nextAfterFitting.to : nextAfterFitting.from;
          const afterFitting = graph.nodes.get(afterFittingId);

          if (afterFitting && (afterFitting.type === 'duct' || afterFitting.type === 'fitting')) {
            // Пропускаем фитинг, но не добавляем в трассу
            previousElementId = currentElement.id;
            currentElement = afterFitting;
            continue;
          }
        }
        break;
      }

      // Если следующий элемент - воздуховод, добавляем участок
      if (nextElement.type === 'duct') {
        trace.push({
          from: currentElement,
          to: nextElement,
          viaFitting: null,
          length: this.getDuctLength(currentElement, nextElement),
          section: this.getDuctSection(currentElement)
        });

        previousElementId = currentElement.id;
        currentElement = nextElement;
      } else if (nextElement.type === 'fitting' && !isCyclic) {
        // Пропускаем фитинг
        previousElementId = currentElement.id;
        currentElement = nextElement;
      } else {
        break;
      }
    }

    return trace;
  }

  getDuctLength(ductA, ductB) {
    if (ductA.b) return ductA.b;
    if (ductB.b) return ductB.b;

    if (ductA.ports && ductB.ports) {
      for (const portA of ductA.ports) {
        for (const portB of ductB.ports) {
          const isConnected = portA.connections?.some(c => c.connectedElementId === ductB.id) ||
            portB.connections?.some(c => c.connectedElementId === ductA.id);
          if (isConnected) {
            const dx = (portA.worldX || 0) - (portB.worldX || 0);
            const dy = (portA.worldY || 0) - (portB.worldY || 0);
            const distancePx = Math.hypot(dx, dy);
            return distancePx * this.options.mmPerPx;
          }
        }
      }
    }

    return 100;
  }

  getDuctSection(duct) {
    if (duct.sectionType === 'round') {
      return {
        type: 'round',
        diameter: duct.a || 125,
        area: this.calculateArea('round', duct.a)
      };
    } else {
      return {
        type: 'rectangular',
        width: duct.a || 125,
        height: duct.c || 100,
        area: this.calculateArea('rectangular', duct.a, duct.c)
      };
    }
  }

  calculateArea(type, a, b = null) {
    if (type === 'round') {
      return Math.PI * Math.pow(a / 2, 2);
    } else {
      return a * (b || a);
    }
  }

  getElementName(element) {
    if (!element) return '?';
    if (element.name) return element.name;
    if (element.type === 'duct') return `ВД_${element.id}`;
    if (element.type === 'fitting') {
      const types = {
        elbow: 'Отв',
        tee: 'Тр',
        cross: 'Кр',
        transition: 'Пер'
      };
      return `${types[element.fittingType] || 'Ф'}_${element.id}`;
    }
    return `${element.type}_${element.id}`;
  }

  calculateTrace(trace, traceNumber) {
    Logger.info(`--- ТРАССА ${traceNumber} ---`);

    let totalLength = 0;
    let totalLosses = 0;
    const sections = [];
    const flowPerSection = this.options.totalAirFlow / Math.max(1, trace.length);

    for (let i = 0; i < trace.length; i++) {
      const segment = trace[i];
      const length = segment.length;
      const flow = flowPerSection;
      const viaFitting = segment.viaFitting;

      totalLength += length;
      const losses = this.calculateSectionLosses(segment, flow, length);
      totalLosses += losses;

      let fromName = this.getElementName(segment.from);
      let toName = this.getElementName(segment.to);

      if (viaFitting) {
        toName = `${viaFitting.fittingType === 'elbow' ? `Отв${viaFitting.angle || ''}°` : this.getElementName(viaFitting)} → ${toName}`;
      }

      sections.push({
        index: i + 1,
        from: fromName,
        to: toName,
        viaFitting: viaFitting ? viaFitting.id : null,
        fittingType: viaFitting ? viaFitting.fittingType : null,
        fittingAngle: viaFitting ? viaFitting.angle : null,
        length: length,
        flow: flow,
        losses: losses,
        section: segment.section
      });

      Logger.info(`  Уч.${i + 1}: ${fromName} → ${toName} | L=${length.toFixed(0)} мм | Q=${flow.toFixed(0)} м³/ч | ΔP=${losses.toFixed(1)} Па`);
      if (viaFitting) {
        Logger.info(`       через фитинг: ${viaFitting.fittingType}${viaFitting.angle ? ` (${viaFitting.angle}°)` : ''} [${viaFitting.id}]`);
      }
    }

    return {
      traceNumber,
      sections,
      totalLength,
      flow: flowPerSection * trace.length,
      losses: totalLosses
    };
  }

  calculateSectionLosses(section, flow, length) {
    const flowM3s = flow / 3600;
    const areaM2 = section.section.area / 1e6;
    const velocity = areaM2 > 0 ? flowM3s / areaM2 : 0;

    let dh = 0;
    if (section.section.type === 'round') {
      dh = section.section.diameter / 1000;
    } else {
      const a = section.section.width / 1000;
      const b = section.section.height / 1000;
      dh = (2 * a * b) / (a + b);
    }

    const airDensity = this.calculateAirDensity();
    const dynamicViscosity = this.calculateDynamicViscosity();
    const re = dh > 0 ? (velocity * dh * airDensity) / dynamicViscosity : 0;

    const relativeRoughness = this.options.roughness / 1000 / dh;
    let lambda = 0.11 * Math.pow(relativeRoughness + 68 / re, 0.25);
    lambda = Math.max(0.01, Math.min(0.1, lambda));

    const r = lambda * (airDensity * Math.pow(velocity, 2)) / (2 * dh);
    const lengthM = length / 1000;
    const frictionLoss = r * lengthM;

    let localCoeff = 0.3;
    if (section.viaFitting) {
      const coefficients = { elbow: 0.5, tee: 0.8, cross: 1.2, transition: 0.3 };
      localCoeff = coefficients[section.viaFitting.fittingType] || 0.5;
    }

    return frictionLoss + frictionLoss * localCoeff;
  }

  calculateAirDensity() {
    const rAir = 287.05;
    const tK = this.options.temperature + 273.15;
    return this.options.atmosphericPressure / (rAir * tK);
  }

  calculateDynamicViscosity() {
    const tK = this.options.temperature + 273.15;
    const mu0 = 1.716e-5;
    const t0 = 273.15;
    const s = 110.4;
    return mu0 * Math.pow(tK / t0, 1.5) * (t0 + s) / (tK + s);
  }

  getResults() {
    return this.results;
  }

  printReport() {
    Logger.info('\n╔════════════════════════════════════════════════════════════════╗');
    Logger.info('║                    ОТЧЕТ ПО РАСЧЕТУ ВОЗДУХОВОДОВ                ║');
    Logger.info('╚════════════════════════════════════════════════════════════════╝');

    Logger.info(`\n📊 Исходные данные:`);
    Logger.info(`   Общий расход воздуха: ${this.options.totalAirFlow} м³/ч`);
    Logger.info(`   Температура воздуха: ${this.options.temperature} °C`);
    Logger.info(`   Атмосферное давление: ${this.options.atmosphericPressure} Па`);
    Logger.info(`   Шероховатость стенок: ${this.options.roughness} мм`);

    Logger.info(`\n📈 Результаты расчета:`);
    Logger.info(`   Всего трасс: ${this.results.tracesCount}`);
    Logger.info(`   Суммарные потери: ${this.results.totalLosses?.toFixed(2) || 0} Па`);
    Logger.info(`   Общий расход: ${this.results.totalFlow || 0} м³/ч`);

    if (this.results.traces && this.results.traces.length) {
      Logger.info(`\n📋 Детализация по трассам:`);
      for (const trace of this.results.traces) {
        Logger.info(`\n   Трасса ${trace.traceNumber}:`);
        Logger.info(`     Длина: ${trace.totalLength?.toFixed(1) || 0} мм`);
        Logger.info(`     Расход: ${trace.flow?.toFixed(1) || 0} м³/ч`);
        Logger.info(`     Потери: ${trace.losses?.toFixed(2) || 0} Па`);

        if (trace.sections && trace.sections.length) {
          for (const sec of trace.sections) {
            const fittingInfo = sec.fittingType ? ` [${sec.fittingType}${sec.fittingAngle ? ` ${sec.fittingAngle}°` : ''}]` : '';
            Logger.info(`       Уч.${sec.index}: ${sec.from} → ${sec.to}${fittingInfo} | L=${sec.length.toFixed(0)} мм | Q=${sec.flow.toFixed(0)} м³/ч | ΔP=${sec.losses.toFixed(1)} Па`);
          }
        }
      }
    }

    Logger.info('\n╔════════════════════════════════════════════════════════════════╗');
    Logger.info('║                       РАСЧЕТ ЗАВЕРШЕН                           ║');
    Logger.info('╚════════════════════════════════════════════════════════════════╝');
  }
}
