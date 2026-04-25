// только аэродинамический расчет
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

  // Обновление опций
  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }

  // Основной метод расчета
  async calculate() {
    console.log('=== НАЧАЛО АЭРОДИНАМИЧЕСКОГО РАСЧЕТА ===');

    return new Promise((resolve, reject) => {
      try {
        const allElements = this.getAllElements();
        console.log(`Всего элементов: ${allElements.length}`);

        if (allElements.length === 0) {
          reject(new Error('Нет элементов для расчета'));
          return;
        }

        // Строим граф связей (учитывая фитинги)
        const graph = this.buildGraph(allElements);
        console.log(`Граф: ${graph.nodes.size} узлов, ${graph.edges.length} связей`);

        // Находим все трассы
        const traces = this.findAllTraces(graph);
        console.log(`Найдено трасс: ${traces.length}`);

        // Рассчитываем каждую трассу
        const traceResults = [];
        let totalLosses = 0;
        let totalFlow = 0;

        for (let i = 0; i < traces.length; i++) {
          const result = this.calculateTrace(traces[i], i + 1);
          traceResults.push(result);
          totalLosses += result.losses;
          totalFlow += result.flow;
        }

        this.results = {
          traces: traceResults,
          totalLosses,
          totalFlow,
          tracesCount: traces.length,
          timestamp: new Date().toISOString()
        };

        console.log(`\n=== ИТОГО ===`);
        console.log(`Потери: ${totalLosses.toFixed(2)} Па`);
        console.log(`Расход: ${totalFlow} м³/ч`);

        resolve(this.results);
      } catch (error) {
        console.error('Ошибка расчета:', error);
        reject(error);
      }
    });
  }

  // Получение всех элементов из слоев
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

  // Построение графа
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
                // Проверяем уникальность ребра
                const edgeKey = [el.id, conn.connectedElementId].sort().join('_');
                if (!edges.some(e => e.key === edgeKey)) {
                  edges.push({
                    key: edgeKey,
                    from: el.id,
                    to: conn.connectedElementId,
                    fromPort: port,
                    toPortId: conn.connectedPortId
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

  // Поиск концевых точек
  findEndpoints(graph) {
    const connectionCount = new Map();

    for (const edge of graph.edges) {
      connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
      connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
    }

    const endpoints = [];
    for (const [nodeId, count] of connectionCount) {
      if (count === 1) {
        const element = graph.nodes.get(nodeId);
        if (element && element.type === 'duct') {
          endpoints.push(element);
        }
      }
    }

    // Если нет концевых точек, берем первый воздуховод
    if (endpoints.length === 0) {
      const firstDuct = Array.from(graph.nodes.values()).find(el => el.type === 'duct');
      if (firstDuct) endpoints.push(firstDuct);
    }

    return endpoints;
  }

  // Поиск всех трасс
  findAllTraces(graph) {
    const traces = [];
    const endpoints = this.findEndpoints(graph);

    for (const endpoint of endpoints) {
      const trace = this.buildTraceFromEndpoint(graph, endpoint);
      if (trace && trace.length > 0) {
        traces.push(trace);
      }
    }

    return traces;
  }

  // Построение трассы от конца до конца
  buildTraceFromEndpoint(graph, startElement) {
    const trace = [];
    let currentElement = startElement;
    let previousElementId = null;
    let maxIterations = 100;
    let iterations = 0;

    while (currentElement && iterations < maxIterations) {
      iterations++;

      // Ищем следующее ребро
      const nextEdge = graph.edges.find(edge => {
        if (edge.from === currentElement.id && edge.to !== previousElementId) return true;
        if (edge.to === currentElement.id && edge.from !== previousElementId) return true;
        return false;
      });

      if (!nextEdge) break;

      const nextElementId = nextEdge.from === currentElement.id ? nextEdge.to : nextEdge.from;
      const nextElement = graph.nodes.get(nextElementId);

      if (nextElement && nextElement.type === 'duct') {
        trace.push({
          from: currentElement,
          to: nextElement,
          length: this.getDuctLength(currentElement, nextElement),
          section: this.getDuctSection(currentElement)
        });

        previousElementId = currentElement.id;
        currentElement = nextElement;
      } else {
        break;
      }
    }

    return trace;
  }

  // Получение длины воздуховода
  getDuctLength(ductA, ductB) {
    // Если у воздуховода есть свойство b (длина)
    if (ductA.b) return ductA.b;
    if (ductB.b) return ductB.b;

    // Иначе считаем по координатам портов
    if (ductA.ports && ductB.ports) {
      for (const portA of ductA.ports) {
        for (const portB of ductB.ports) {
          if (portA.isConnected?.() && portB.isConnected?.()) {
            const isConnected = portA.connections.some(c => c.connectedElementId === ductB.id) ||
              portB.connections.some(c => c.connectedElementId === ductA.id);
            if (isConnected) {
              const dx = (portA.worldX || 0) - (portB.worldX || 0);
              const dy = (portA.worldY || 0) - (portB.worldY || 0);
              const distancePx = Math.hypot(dx, dy);
              return distancePx * this.options.mmPerPx;
            }
          }
        }
      }
    }

    return 100; // значение по умолчанию
  }

  // Получение сечения воздуховода
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

  // Расчет площади сечения
  calculateArea(type, a, b = null) {
    if (type === 'round') {
      return Math.PI * Math.pow(a / 2, 2);
    } else {
      return a * (b || a);
    }
  }

  // Расчет одной трассы
  calculateTrace(trace, traceNumber) {
    console.log(`\n--- ТРАССА ${traceNumber} ---`);

    let totalLength = 0;
    let totalLosses = 0;
    const sections = [];

    // Расход равномерно распределяем по участкам трассы
    const flowPerSection = this.options.totalAirFlow / Math.max(1, trace.length);

    for (let i = 0; i < trace.length; i++) {
      const segment = trace[i];
      const length = segment.length;
      const flow = flowPerSection;

      totalLength += length;
      const losses = this.calculateSectionLosses(segment, flow, length);
      totalLosses += losses;

      sections.push({
        index: i + 1,
        from: this.getElementName(segment.from),
        to: this.getElementName(segment.to),
        length: length,
        flow: flow,
        losses: losses,
        section: segment.section
      });

      console.log(`  Уч.${i + 1}: ${this.getElementName(segment.from)} → ${this.getElementName(segment.to)} | L=${length.toFixed(0)} мм | Q=${flow.toFixed(0)} м³/ч | ΔP=${losses.toFixed(1)} Па`);
    }

    return {
      traceNumber,
      sections,
      totalLength,
      flow: flowPerSection * trace.length,
      losses: totalLosses
    };
  }

  // Имя элемента для отображения
  getElementName(element) {
    if (element.name) return element.name;
    if (element.type === 'duct') return `ВД_${element.id}`;
    if (element.type === 'fitting') return `Ф_${element.id}`;
    return `${element.type}_${element.id}`;
  }

  // Расчет потерь на участке
  calculateSectionLosses(section, flow, length) {
    const flowM3s = flow / 3600;
    const areaM2 = section.section.area / 1e6; // перевод мм² в м²
    const velocity = areaM2 > 0 ? flowM3s / areaM2 : 0;

    // Эквивалентный диаметр
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

    // Коэффициент трения (формула Альтшуля)
    const relativeRoughness = this.options.roughness / 1000 / dh;
    let lambda = 0.11 * Math.pow(relativeRoughness + 68 / re, 0.25);
    lambda = Math.max(0.01, Math.min(0.1, lambda));

    // Потери на трение
    const r = lambda * (airDensity * Math.pow(velocity, 2)) / (2 * dh);
    const lengthM = length / 1000;
    const frictionLoss = r * lengthM;

    // Местные потери (30% от потерь на трение - упрощенно)
    const localLoss = frictionLoss * 0.3;

    return frictionLoss + localLoss;
  }

  // Плотность воздуха
  calculateAirDensity() {
    const rAir = 287.05;
    const tK = this.options.temperature + 273.15;
    return this.options.atmosphericPressure / (rAir * tK);
  }

  // Динамическая вязкость воздуха
  calculateDynamicViscosity() {
    const tK = this.options.temperature + 273.15;
    const mu0 = 1.716e-5;
    const t0 = 273.15;
    const s = 110.4;
    return mu0 * Math.pow(tK / t0, 1.5) * (t0 + s) / (tK + s);
  }

  // Получение результатов
  getResults() {
    return this.results;
  }

  // Печать отчета
  printReport() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ОТЧЕТ ПО РАСЧЕТУ ВОЗДУХОВОДОВ                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    console.log(`\n📊 Исходные данные:`);
    console.log(`   Общий расход воздуха: ${this.options.totalAirFlow} м³/ч`);
    console.log(`   Температура воздуха: ${this.options.temperature} °C`);
    console.log(`   Атмосферное давление: ${this.options.atmosphericPressure} Па`);
    console.log(`   Шероховатость стенок: ${this.options.roughness} мм`);

    console.log(`\n📈 Результаты расчета:`);
    console.log(`   Всего трасс: ${this.results.tracesCount}`);
    console.log(`   Суммарные потери: ${this.results.totalLosses?.toFixed(2) || 0} Па`);
    console.log(`   Общий расход: ${this.results.totalFlow || 0} м³/ч`);

    if (this.results.traces && this.results.traces.length) {
      console.log(`\n📋 Детализация по трассам:`);
      for (const trace of this.results.traces) {
        console.log(`\n   Трасса ${trace.traceNumber}:`);
        console.log(`     Длина: ${trace.totalLength?.toFixed(1) || 0} мм`);
        console.log(`     Расход: ${trace.flow?.toFixed(1) || 0} м³/ч`);
        console.log(`     Потери: ${trace.losses?.toFixed(2) || 0} Па`);

        if (trace.sections && trace.sections.length) {
          for (const sec of trace.sections) {
            console.log(`       Уч.${sec.index}: ${sec.from} → ${sec.to} | L=${sec.length.toFixed(0)} мм | Q=${sec.flow.toFixed(0)} м³/ч | ΔP=${sec.losses.toFixed(1)} Па`);
          }
        }
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       РАСЧЕТ ЗАВЕРШЕН                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
  }
}
