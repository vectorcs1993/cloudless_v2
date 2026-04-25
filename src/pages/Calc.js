// Calc.js - упрощенный аэродинамический расчет
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
    this.results = null;
  }

  async calculate() {
    Logger.info('═══════════════════════════════════════════');
    Logger.info('     АЭРОДИНАМИЧЕСКИЙ РАСЧЕТ');
    Logger.info('═══════════════════════════════════════════');

    try {
      const allElements = this.getAllElements();
      console.log(allElements);

      const ducts = allElements.filter(el => el.type === 'duct');
      const fittings = allElements.filter(el => el.type === 'fitting');

      Logger.info(`📦 Элементов: ${allElements.length}`);
      Logger.info(`   ├─ Воздуховодов: ${ducts.length}`);
      Logger.info(`   └─ Фитингов: ${fittings.length}`);

      if (ducts.length === 0) {
        throw new Error('Нет воздуховодов для расчета');
      }

      const connections = this.buildConnections(ducts, fittings);
      Logger.info(`🔗 Связей: ${connections.length}`);

      const traces = this.findTraces(ducts, connections);
      Logger.info(`🛤️  Трасс: ${traces.length}`);

      if (traces.length === 0) {
        throw new Error('Не найдено связных трасс');
      }

      for (let i = 0; i < traces.length; i++) {
        this.calculateTrace(traces[i], i + 1);
      }

      const totalLosses = traces.reduce((sum, t) => sum + t.losses, 0);
      const totalLength = traces.reduce((sum, t) => sum + t.totalLength, 0);

      this.results = {
        traces,
        totalLosses,
        totalLength,
        tracesCount: traces.length,
        timestamp: new Date().toISOString()
      };

      Logger.success('\n═══════════════════════════════════════════');
      Logger.success(`✅ РАСЧЕТ ЗАВЕРШЕН`);
      Logger.success(`   📊 Общие потери: ${totalLosses.toFixed(2)} Па`);
      Logger.success(`   📏 Общая длина: ${(totalLength / 1000).toFixed(2)} м`);
      Logger.success(`   🛤️  Количество трасс: ${traces.length}`);
      Logger.success('═══════════════════════════════════════════');

      return this.results;
    } catch (error) {
      Logger.error(`❌ Ошибка: ${error.message}`);
      throw error;
    }
  }

  getAllElements() {
    if (!this.elements) return [];
    if (Array.isArray(this.elements)) return this.elements;

    if (this.elements.value) {
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

  buildConnections(ducts, fittings) {
    const connections = [];
    const ductMap = new Map(ducts.map(d => [d.id, d]));
    const fittingMap = new Map(fittings.map(f => [f.id, f]));

    for (const duct of ducts) {
      if (!duct.ports) continue;

      for (const port of duct.ports) {
        if (!port.isConnected?.()) continue;

        for (const conn of port.connections) {
          const targetElement = ductMap.get(conn.connectedElementId) || fittingMap.get(conn.connectedElementId);

          if (targetElement && targetElement.id !== duct.id) {
            const exists = connections.some(c =>
              (c.from === duct.id && c.to === targetElement.id) ||
              (c.from === targetElement.id && c.to === duct.id)
            );

            if (!exists) {
              connections.push({
                from: duct.id,
                to: targetElement.id,
                fromType: 'duct',
                toType: targetElement.type,
                viaFitting: targetElement.type === 'fitting' ? targetElement : null
              });
            }
          }
        }
      }
    }

    return connections;
  }

  findTraces(ducts, connections) {
    const traces = [];
    const usedDucts = new Set();
    const ductMap = new Map(ducts.map(d => [d.id, d]));

    // Находим концевые точки
    const connectionCount = new Map();
    for (const conn of connections) {
      if (conn.fromType === 'duct') connectionCount.set(conn.from, (connectionCount.get(conn.from) || 0) + 1);
      if (conn.toType === 'duct') connectionCount.set(conn.to, (connectionCount.get(conn.to) || 0) + 1);
    }

    const endpoints = ducts.filter(d => connectionCount.get(d.id) === 1);
    Logger.info(`📍 Концевых точек: ${endpoints.length}`);

    // Строим трассы от каждого конца
    for (const start of endpoints) {
      if (usedDucts.has(start.id)) continue;

      const trace = this.buildTrace(start, connections, ductMap);
      if (trace.ducts.length > 0) {
        traces.push(trace);
        trace.ducts.forEach(d => usedDucts.add(d.id));
      }
    }

    // Неиспользованные воздуховоды
    const unused = ducts.filter(d => !usedDucts.has(d.id));
    if (unused.length > 0) {
      Logger.warn(`⚠️ Найдено ${unused.length} неиспользованных воздуховодов`);

      for (const duct of unused) {
        if (!usedDucts.has(duct.id)) {
          const trace = this.buildTrace(duct, connections, ductMap);
          if (trace.ducts.length > 0) {
            traces.push(trace);
            trace.ducts.forEach(d => usedDucts.add(d.id));
          }
        }
      }
    }

    return traces;
  }

  buildTrace(startDuct, connections, ductMap) {
    const traceDucts = [];
    const traceFittings = [];
    let current = startDuct;
    let prevId = null;
    const visited = new Set();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      traceDucts.push(current);

      const nextConn = connections.find(c =>
        (c.from === current.id && c.to !== prevId) ||
        (c.to === current.id && c.from !== prevId)
      );

      if (!nextConn) break;

      if (nextConn.viaFitting) {
        traceFittings.push(nextConn.viaFitting);
      }

      const nextId = nextConn.from === current.id ? nextConn.to : nextConn.from;
      const nextDuct = ductMap.get(nextId);

      if (nextDuct) {
        prevId = current.id;
        current = nextDuct;
      } else {
        break;
      }
    }

    let totalLength = 0;
    let totalLosses = 0;
    const sections = [];

    for (let i = 0; i < traceDucts.length - 1; i++) {
      const duct = traceDucts[i];
      const fitting = traceFittings[i];

      const length = duct.b || 100;
      const section = this.getDuctSection(duct);
      const losses = this.calculateLosses(section, length);

      totalLength += length;
      totalLosses += losses;

      sections.push({
        index: i + 1,
        ductId: duct.id,
        ductName: duct.name || `ВД_${duct.id}`,
        fittingType: fitting?.fittingType || null,
        length: length,
        losses: losses,
        diameter: section.diameter,
        width: section.width,
        height: section.height
      });
    }

    return {
      ducts: traceDucts,
      fittings: traceFittings,
      sections,
      totalLength,
      losses: totalLosses,
      flow: this.options.totalAirFlow
    };
  }

  getDuctSection(duct) {
    const isRound = duct.sectionType === 'round';

    if (isRound) {
      const diameter = duct.a || 125;
      return {
        type: 'round',
        diameter: diameter,
        area: Math.PI * Math.pow(diameter / 2, 2),
        perimeter: Math.PI * diameter
      };
    } else {
      const width = duct.a || 125;
      const height = duct.c || 100;
      return {
        type: 'rectangular',
        width: width,
        height: height,
        area: width * height,
        perimeter: 2 * (width + height)
      };
    }
  }

  calculateLosses(section, lengthMm) {
    const flowM3s = this.options.totalAirFlow / 3600;
    const areaM2 = section.area / 1e6;
    const velocity = areaM2 > 0 ? flowM3s / areaM2 : 0;

    let dh = 0;
    if (section.type === 'round') {
      dh = section.diameter / 1000;
    } else {
      const a = section.width / 1000;
      const b = section.height / 1000;
      dh = (2 * a * b) / (a + b);
    }

    const tK = this.options.temperature + 273.15;
    const rAir = 287.05;
    const density = this.options.atmosphericPressure / (rAir * tK);

    const dynPressure = density * Math.pow(velocity, 2) / 2;

    const mu = 1.716e-5;
    const re = dh > 0 ? (velocity * dh * density) / mu : 0;

    let lambda = 0.02;
    if (re > 0 && re < 2300) lambda = 64 / re;
    else if (re >= 2300) lambda = 0.11 * Math.pow(this.options.roughness / 1000 / dh + 68 / re, 0.25);

    const lengthM = lengthMm / 1000;
    const frictionLoss = lambda * (lengthM / dh) * dynPressure;
    const localLoss = frictionLoss * 0.3;

    return frictionLoss + localLoss;
  }

  calculateTrace(trace, traceNumber) {
    Logger.info(`\n🛤️ ТРАССА ${traceNumber}`);
    Logger.info(`   📏 Длина: ${(trace.totalLength / 1000).toFixed(2)} м`);
    Logger.info(`   📊 Потери: ${trace.losses.toFixed(2)} Па`);
    Logger.info(`   📦 Участков: ${trace.sections.length}`);

    for (const section of trace.sections) {
      const fittingInfo = section.fittingType ? ` [${section.fittingType}]` : '';
      Logger.info(`      └─ ${section.ductName}${fittingInfo} | L=${section.length} мм | ΔP=${section.losses.toFixed(1)} Па`);
    }

    trace.traceNumber = traceNumber;
    return trace;
  }

  getResults() {
    return this.results;
  }

  printReport() {
    if (!this.results) {
      Logger.warn('Нет результатов. Сначала выполните расчет.');
      return;
    }

    Logger.info('\n═══════════════════════════════════════════');
    Logger.info('              ОТЧЕТ ПО РАСЧЕТУ');
    Logger.info('═══════════════════════════════════════════');
    Logger.info(`📊 Исходные данные:`);
    Logger.info(`   Расход воздуха: ${this.options.totalAirFlow} м³/ч`);
    Logger.info(`   Температура: ${this.options.temperature} °C`);
    Logger.info(`   Шероховатость: ${this.options.roughness} мм`);

    Logger.info(`\n📈 Результаты:`);
    Logger.info(`   Общие потери: ${this.results.totalLosses.toFixed(2)} Па`);
    Logger.info(`   Общая длина: ${(this.results.totalLength / 1000).toFixed(2)} м`);
    Logger.info(`   Количество трасс: ${this.results.tracesCount}`);

    for (const trace of this.results.traces) {
      Logger.info(`\n   🛤️ Трасса ${trace.traceNumber}:`);
      Logger.info(`      Потери: ${trace.losses.toFixed(2)} Па`);
      Logger.info(`      Длина: ${(trace.totalLength / 1000).toFixed(2)} м`);
      for (const section of trace.sections) {
        const fittingMark = section.fittingType ? ` 🔧${section.fittingType}` : '';
        const sizeInfo = section.diameter ? `⌀${section.diameter}` : `${section.width}x${section.height}`;
        Logger.info(`         └─ ${section.ductName}${fittingMark} | ${sizeInfo} | ${section.length} мм | ${section.losses.toFixed(1)} Па`);
      }
    }

    Logger.info('\n═══════════════════════════════════════════');
  }
}
