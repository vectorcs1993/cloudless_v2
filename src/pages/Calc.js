// Calc.js
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
      sections: [],
      totalLosses: 0,
      totalFlow: 0
    };
  }

  // Обновление опций
  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }

  // Основной метод расчета (Promise)
  async calculate() {
    console.log('=== НАЧАЛО РАСЧЕТА СИСТЕМЫ ВОЗДУХОВОДОВ ===');

    // Имитация асинхронной операции (в будущем - запрос к серверу)
    return new Promise((resolve, reject) => {
      try {
        // Получаем все элементы
        const allElements = this.getAllElements();
        console.log(`Всего элементов в системе: ${allElements.length}`);

        if (allElements.length === 0) {
          reject(new Error('Нет элементов для расчета'));
          return;
        }

        // Строим граф связей
        const graph = this.buildGraph(allElements);
        console.log(`Построен граф с ${graph.nodes.size} узлами и ${graph.edges.length} связями`);

        // Находим все трассы (пути от начала до конца)
        const traces = this.findAllTraces(graph);
        console.log(`Найдено трасс: ${traces.length}`);

        // Для каждой трассы выполняем расчет
        const sectionResults = [];
        let totalLosses = 0;
        let totalFlow = 0;

        for (let i = 0; i < traces.length; i++) {
          const trace = traces[i];
          const result = this.calculateTrace(trace, i + 1);
          sectionResults.push(result);
          totalLosses += result.losses || 0;
          totalFlow += result.flow || 0;

          console.log(`\n--- ТРАССА ${i + 1} ---`);
          console.log(`  Участков: ${result.sections.length}`);
          console.log(`  Общая длина: ${result.totalLength} мм`);
          console.log(`  Расход воздуха: ${result.flow} м³/ч`);
          console.log(`  Потери давления: ${result.losses.toFixed(2)} Па`);
        }

        this.results = {
          sections: sectionResults,
          totalLosses,
          totalFlow,
          tracesCount: traces.length,
          timestamp: new Date().toISOString()
        };

        console.log('\n=== ИТОГО ПО СИСТЕМЕ ===');
        console.log(`Всего трасс: ${traces.length}`);
        console.log(`Суммарные потери: ${totalLosses.toFixed(2)} Па`);
        console.log(`Общий расход: ${totalFlow} м³/ч`);

        resolve(this.results);
      } catch (error) {
        console.error('Ошибка при расчете:', error);
        reject(error);
      }
    });
  }

  // Форматирование трассы для экспорта (Promise)
  async formatTrace(traceData = null) {
    return new Promise((resolve, reject) => {
      try {
        const data = traceData || this.results;

        if (!data.sections || data.sections.length === 0) {
          reject(new Error('Нет данных для форматирования. Сначала выполните расчет.'));
          return;
        }

        // Форматирование для экспорта
        const formatted = {
          header: {
            title: 'Отчет по расчету воздуховодов',
            date: new Date().toISOString(),
            totalTraces: data.tracesCount || 0,
            totalLosses: data.totalLosses || 0,
            totalFlow: data.totalFlow || 0
          },
          traces: data.sections.map(trace => ({
            number: trace.traceNumber,
            totalLength: trace.totalLength,
            totalFlow: trace.totalFlow,
            losses: trace.losses,
            sections: trace.sections.map(sec => ({
              index: sec.index,
              from: sec.from,
              to: sec.to,
              length: sec.length,
              flow: sec.flow,
              losses: sec.losses,
              sectionType: sec.section?.type || 'unknown',
              diameter: sec.section?.diameter,
              width: sec.section?.width,
              height: sec.section?.height
            }))
          })),
          settings: {
            totalAirFlow: this.options.totalAirFlow,
            temperature: this.options.temperature,
            atmosphericPressure: this.options.atmosphericPressure,
            roughness: this.options.roughness,
            mmPerPx: this.options.mmPerPx
          }
        };

        console.log('=== ФОРМАТ ТРАССЫ ===');
        console.log(JSON.stringify(formatted, null, 2));

        resolve(formatted);
      } catch (error) {
        console.error('Ошибка при форматировании:', error);
        reject(error);
      }
    });
  }

  // Экспорт в JSON (Promise)
  async exportToJSON() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.results.sections || this.results.sections.length === 0) {
          reject(new Error('Нет данных для экспорта. Сначала выполните расчет.'));
          return;
        }

        const json = JSON.stringify(this.results, null, 2);
        resolve(json);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Экспорт в CSV (Promise)
  async exportToCSV() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.results.sections || this.results.sections.length === 0) {
          reject(new Error('Нет данных для экспорта. Сначала выполните расчет.'));
          return;
        }

        let csv = 'Трасса,Участок,От,До,Длина(мм),Расход(м³/ч),Потери(Па),Тип сечения\n';

        for (const trace of this.results.sections) {
          for (const sec of trace.sections) {
            csv += `${trace.traceNumber},${sec.index},${sec.from},${sec.to},${sec.length.toFixed(0)},${sec.flow.toFixed(0)},${sec.losses.toFixed(2)},${sec.section?.type || 'unknown'}\n`;
          }
        }

        resolve(csv);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Получение результатов
  getResults() {
    return this.results;
  }

  // Остальные методы остаются без изменений...
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
                const edgeExists = edges.some(e =>
                  (e.from === el.id && e.to === conn.connectedElementId) ||
                  (e.from === conn.connectedElementId && e.to === el.id)
                );
                if (!edgeExists) {
                  edges.push({
                    from: el.id,
                    to: conn.connectedElementId,
                    fromPort: port,
                    toPortId: conn.connectedPortId,
                    element: el
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

  findAllTraces(graph) {
    const traces = [];
    const visitedEdges = new Set();
    const endpoints = this.findEndpoints(graph);
    console.log(`Найдено концевых точек: ${endpoints.length}`);

    for (const endpoint of endpoints) {
      const trace = this.buildTraceFromEndpoint(graph, endpoint, visitedEdges);
      if (trace && trace.length > 0) {
        traces.push(trace);
      }
    }

    return traces;
  }

  findEndpoints(graph) {
    const endpoints = [];
    const connectionCount = new Map();

    for (const edge of graph.edges) {
      connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
      connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
    }

    for (const [nodeId, count] of connectionCount) {
      if (count === 1) {
        const element = graph.nodes.get(nodeId);
        if (element) {
          endpoints.push(element);
        }
      }
    }

    if (endpoints.length === 0 && graph.nodes.size > 0) {
      endpoints.push(Array.from(graph.nodes.values())[0]);
    }

    return endpoints;
  }

  buildTraceFromEndpoint(graph, startElement, visitedEdges) {
    const trace = [];
    let currentElement = startElement;
    let previousElementId = null;
    let maxIterations = 100;
    let iterations = 0;

    while (currentElement && iterations < maxIterations) {
      iterations++;

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

      if (nextElement) {
        trace.push({
          from: currentElement,
          to: nextElement,
          length: this.getElementLength(currentElement, nextElement),
          section: this.getElementSection(currentElement),
          flow: 0
        });

        previousElementId = currentElement.id;
        currentElement = nextElement;
      } else {
        break;
      }
    }

    return trace;
  }

  getElementLength(fromElement, toElement) {
    if (fromElement.type === 'duct' && fromElement.b) {
      return fromElement.b;
    }
    if (toElement.type === 'duct' && toElement.b) {
      return toElement.b;
    }

    if (fromElement.ports && toElement.ports) {
      for (const port1 of fromElement.ports) {
        for (const port2 of toElement.ports) {
          if (port1.connections?.some(c => c.connectedElementId === toElement.id) ||
            port2.connections?.some(c => c.connectedElementId === fromElement.id)) {
            const dx = (port1.worldX || 0) - (port2.worldX || 0);
            const dy = (port1.worldY || 0) - (port2.worldY || 0);
            const distancePx = Math.hypot(dx, dy);
            return distancePx * this.options.mmPerPx;
          }
        }
      }
    }

    return 100;
  }

  getElementSection(element) {
    if (element.sectionType === 'round') {
      return {
        type: 'round',
        diameter: element.a || 125,
        area: this.calculateArea('round', element.a)
      };
    } else {
      return {
        type: 'rectangular',
        width: element.a || 125,
        height: element.c || 100,
        area: this.calculateArea('rectangular', element.a, element.c)
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

  calculateTrace(trace, traceNumber) {
    console.log(`\n[Расчет трассы ${traceNumber}]`);
    console.log(`Количество участков: ${trace.length}`);

    let totalLength = 0;
    let totalLosses = 0;
    const sections = [];

    let remainingFlow = this.options.totalAirFlow;
    const flowPerSection = remainingFlow / Math.max(1, trace.length);

    for (let i = 0; i < trace.length; i++) {
      const section = trace[i];
      const length = section.length;
      const flow = flowPerSection;

      totalLength += length;
      const losses = this.calculateSectionLosses(section, flow, length);
      totalLosses += losses;

      sections.push({
        index: i + 1,
        from: section.from.name || `${section.from.type}_${section.from.id}`,
        to: section.to.name || `${section.to.type}_${section.to.id}`,
        length: length,
        flow: flow,
        losses: losses,
        section: section.section
      });

      console.log(`  Участок ${i + 1}: ${section.from.name || section.from.id} → ${section.to.name || section.to.id}`);
      console.log(`    Длина: ${length.toFixed(1)} мм`);
      console.log(`    Расход: ${flow.toFixed(1)} м³/ч`);
      console.log(`    Потери: ${losses.toFixed(2)} Па`);
    }

    return {
      traceNumber,
      sections,
      totalLength,
      totalFlow: flowPerSection * trace.length,
      losses: totalLosses
    };
  }

  calculateSectionLosses(section, flow, length) {
    const flowM3s = flow / 3600;

    let areaM2 = 0;
    if (section.section.type === 'round') {
      const dM = section.section.diameter / 1000;
      areaM2 = Math.PI * Math.pow(dM / 2, 2);
    } else {
      areaM2 = (section.section.width / 1000) * (section.section.height / 1000);
    }

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
    const localLoss = frictionLoss * 0.3;

    return frictionLoss + localLoss;
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

  printReport() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ОТЧЕТ ПО РАСЧЕТУ ВОЗДУХОВОДОВ                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    console.log(`\n📊 Исходные данные:`);
    console.log(`   Общий расход воздуха: ${this.options.totalAirFlow} м³/ч`);
    console.log(`   Температура воздуха: ${this.options.temperature} °C`);
    console.log(`   Атмосферное давление: ${this.options.atmosphericPressure} Па`);
    console.log(`   Шероховатость стенок: ${this.options.roughness} мм`);
    console.log(`   Масштаб: ${this.options.mmPerPx} мм/пиксель`);

    console.log(`\n📈 Результаты расчета:`);
    console.log(`   Всего трасс: ${this.results.tracesCount || 0}`);
    console.log(`   Суммарные потери: ${this.results.totalLosses?.toFixed(2) || 0} Па`);
    console.log(`   Общий расход: ${this.results.totalFlow || 0} м³/ч`);

    if (this.results.sections && this.results.sections.length) {
      console.log(`\n📋 Детализация по трассам:`);
      for (const trace of this.results.sections) {
        console.log(`\n   Трасса ${trace.traceNumber}:`);
        console.log(`     Длина: ${trace.totalLength?.toFixed(1) || 0} мм`);
        console.log(`     Расход: ${trace.totalFlow?.toFixed(1) || 0} м³/ч`);
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
