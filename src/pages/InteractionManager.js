// InteractionManager.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

import { ElementFactory } from './ElementFactory.js';

export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, selectionManager, options, layerManager = null) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.selectionManager = selectionManager;
    this.layerManager = layerManager;
    this.options = options;

    // Состояния
    this.isDragging = false;
    this.isPanning = false;
    this.isSelecting = false;
    this.dragElements = [];
    this.dragCallout = null;
    this.dragStartWorld = null;
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartScreen = { x: 0, y: 0 };
    this.dragStartPositions = [];
    this.selectionStart = null;
    this.autoUpdateConnections = true;

    // Режим рисования трассы
    this.traceActive = false;           // Активен ли режим рисования
    this.traceStartPort = null;         // Стартовый порт (точка начала)

    // Кэши для оптимизации
    this.snapCache = new Map();
    this.lastSnapCheck = 0;
    this.snapCheckThrottle = 16;
    this._dragFrameRequest = null;
  }

  // ========== РЕЖИМ РИСОВАНИЯ ==========

  startTrace(port) {
    if (!port) return;

    this.traceActive = true;
    this.traceStartPort = port;

    this.canvas.style.cursor = 'crosshair';
    if (this.onTraceStart) this.onTraceStart(port);
  }

  // ПРОСТО ВЫХОД ИЗ РЕЖИМА - НИЧЕГО НЕ УДАЛЯЕМ
  cancelTrace() {
    this.traceActive = false;
    this.traceStartPort = null;
    this.traceGhostPoints = [];

    if (this.renderer) {
      this.renderer.setTraceGhostPoints([]);
      this.renderer.draw();
    }

    this.canvas.style.cursor = '';
    if (this.onTraceCancel) this.onTraceCancel();
  }

  // Создание воздуховода от стартового порта до точки
  createDuctFromPortToPoint(startPort, endPoint, endPort = null) {
    const activeLayer = this.layerManager?.getActiveLayer();
    if (!activeLayer || activeLayer.locked) {
      if (this.onError) this.onError('Слой заблокирован');
      return null;
    }

    let dx = endPoint.x - startPort.worldX;
    let dy = endPoint.y - startPort.worldY;

    // Только 8 направлений
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    let minDiff = 180;
    let snappedAngle = angle;

    for (const sa of snapAngles) {
      let diff = Math.abs(angle - sa);
      if (diff < minDiff) {
        minDiff = diff;
        snappedAngle = sa;
      }
    }

    if (minDiff <= 22.5) {
      const rad = snappedAngle * Math.PI / 180;
      const len = Math.hypot(dx, dy);
      dx = Math.cos(rad) * len;
      dy = Math.sin(rad) * len;
      angle = snappedAngle;
    }

    const distance = Math.hypot(dx, dy);
    const distanceMm = distance * (this.options.mmPerPx?.value || 2);

    if (distanceMm < 30) {
      if (this.onError) this.onError('Слишком короткий воздуховод (мин. 30 мм)');
      return null;
    }

    const halfLengthPx = distance / 2;
    const centerX = startPort.worldX + Math.cos(angle * Math.PI / 180) * halfLengthPx;
    const centerY = startPort.worldY + Math.sin(angle * Math.PI / 180) * halfLengthPx;

    let elementType = 'duct';
    let params = {
      b: Math.max(30, distanceMm),
      a: 125,
      sectionType: 'round',
      rotation: angle
    };

    // Автоподбор размера из исходного порта
    const sourceElement = this.findElementById(startPort.elementId);
    if (sourceElement && sourceElement.a) params.a = sourceElement.a;

    if (endPort) {
      const targetElement = this.findElementById(endPort.elementId);
      if (targetElement && targetElement.a && targetElement.a !== params.a) {
        elementType = 'transition';
        params.a2 = targetElement.a;
      }
    }

    const newId = this.getNextElementId();
    const newElement = ElementFactory.createElement(elementType, newId, centerX, centerY, params);
    if (!newElement) return null;

    newElement.updatePorts();

    // Создаем выноску
    const topLeft = newElement.getTopLeft();
    newElement.addCallout(newElement.x, topLeft.y - 50);
    newElement.updateCalloutText();
    newElement.showCallout = true;

    activeLayer.elements.push(newElement);

    const inletPort = newElement.ports.find(p => p.direction === 'inlet' || p.direction === 'left');
    const outletPort = newElement.ports.find(p => p.direction === 'outlet' || p.direction === 'right');

    if (startPort && inletPort) {
      this.connectionManager?.connectPorts(startPort, inletPort);
    }
    if (endPort && outletPort) {
      this.connectionManager?.connectPorts(endPort, outletPort);
    }

    if (this.onElementCreated) this.onElementCreated(newElement);
    return newElement;
  }

  // Обработка клика в режиме рисования
  handleTraceClick(worldPos) {
    if (!this.traceActive || !this.traceStartPort) return false;

    const targetPort = this.findPortAt(worldPos.x, worldPos.y, 20);
    let newElement = null;

    if (targetPort && targetPort !== this.traceStartPort) {
      newElement = this.createDuctFromPortToPoint(
        this.traceStartPort,
        { x: targetPort.worldX, y: targetPort.worldY },
        targetPort
      );
    } else {
      newElement = this.createDuctFromPortToPoint(
        this.traceStartPort,
        worldPos,
        null
      );
    }

    if (newElement) {
      if (this.autoUpdateConnections) {
        setTimeout(() => {
          this.connectionManager?.updateAllPortsAndConnections(
            this.options.snapDistance?.value || 10,
            this.layerManager
          );
          this.renderer?.draw();
        }, 50);
      }

      if (this.onElementCreated) this.onElementCreated(newElement);

      const outletPort = newElement.ports.find(p => p.direction === 'outlet' || p.direction === 'right');
      if (outletPort) {
        this.traceStartPort = outletPort;
      } else {
        this.cancelTrace();
      }
      return true;
    }
    return false;
  }

  // Обновление предпросмотра (от порта до курсора)
  updateTracePreview(worldPos) {
    if (!this.traceActive || !this.traceStartPort) return;

    const startPoint = { x: this.traceStartPort.worldX, y: this.traceStartPort.worldY };
    let endPoint = { x: worldPos.x, y: worldPos.y };

    // Только 8 направлений
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    let minDiff = 180;
    let snappedAngle = angle;

    for (const sa of snapAngles) {
      let diff = Math.abs(angle - sa);
      if (diff < minDiff) {
        minDiff = diff;
        snappedAngle = sa;
      }
    }

    if (minDiff <= 22.5) {
      const rad = snappedAngle * Math.PI / 180;
      const len = Math.hypot(dx, dy);
      endPoint = {
        x: startPoint.x + Math.cos(rad) * len,
        y: startPoint.y + Math.sin(rad) * len
      };
    }

    this.traceGhostPoints = [startPoint, endPoint];
    this.renderer?.setTraceGhostPoints(this.traceGhostPoints);
    this.renderer?.draw();
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  getNextElementId() {
    const allElements = this.layerManager?.getAllElements() || [];
    const maxId = Math.max(0, ...allElements.map(el => el.id || 0), 100);
    return maxId + 1;
  }

  setAutoUpdateConnections(enabled) {
    this.autoUpdateConnections = enabled;
  }

  setOnElementCreated(callback) { this.onElementCreated = callback; }
  setOnTraceStart(callback) { this.onTraceStart = callback; }
  setOnTraceCancel(callback) { this.onTraceCancel = callback; }
  setOnError(callback) { this.onError = callback; }

  isInteractive(element) {
    return !this.layerManager?.isLayerLocked(element);
  }

  getInteractiveElements() {
    return this.layerManager?.getInteractiveElements() || [];
  }

  isPointOverCallout(x, y) {
    if (!this.options.showCallouts?.value) return false;
    const elements = this.getInteractiveElements();
    for (const el of elements) {
      if (el.callouts?.length && el.showCallout !== false) {
        for (const callout of el.callouts) {
          if (callout.hitTest(x, y, this.options.scale?.value || 1, el).hit) return true;
        }
      }
    }
    return false;
  }

  findElementAt(x, y) {
    if (this.isPointOverCallout(x, y)) return null;
    const ctx = this.canvas.getContext('2d');
    const elements = this.getInteractiveElements();
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].hitTest(x, y, ctx)) return elements[i];
    }
    return null;
  }

  findCalloutAt(x, y) {
    if (!this.options.showCallouts?.value) return null;
    const elements = this.getInteractiveElements();
    for (const el of elements) {
      if (el.callouts?.length && el.showCallout !== false) {
        for (const callout of el.callouts) {
          const hit = callout.hitTest(x, y, this.options.scale?.value || 1, el);
          if (hit.hit) return { callout, element: el, isHandle: hit.isHandle };
        }
      }
    }
    return null;
  }

  findPortAt(x, y, maxDist = 15) {
    if (this.isPointOverCallout(x, y)) return null;
    const ports = this.connectionManager?.getAllPorts() || [];
    let closestPort = null;
    let closestDist = maxDist;

    for (const port of ports) {
      const el = this.findElementById(port.elementId);
      if (el && !this.isInteractive(el)) continue;
      const dist = Math.hypot(port.worldX - x, port.worldY - y);
      if (dist < closestDist) {
        closestDist = dist;
        closestPort = port;
      }
    }
    return closestPort;
  }

  findElementById(id) {
    const all = this.layerManager?.getAllElements() || [];
    return all.find(el => el.id === id);
  }

  // ========== МЕТОДЫ ПЕРЕМЕЩЕНИЯ ==========

  moveWithSnap(elements, dx, dy, startPositions) {
    if (!elements?.length) return;
    this.resetToStartPositions(startPositions);

    let snapOffset = null;
    if (this.options.snapToPorts?.value && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
      snapOffset = this.findBestSnapOffset(elements, dx, dy);
    }

    const offset = snapOffset || { ox: dx, oy: dy };
    this.applyOffsetToElements(elements, offset);

    if (snapOffset && this.autoUpdateConnections) {
      this.highlightSnappedPorts(elements, offset);
    } else {
      this.renderer?.setHighlightedPort(null);
    }
  }

  resetToStartPositions(startPositions) {
    for (const p of startPositions) {
      p.el.x = p.x;
      p.el.y = p.y;
      if (p.el.updatePorts) p.el.updatePorts();
      if (p.el.callouts && p.startCalloutPositions) {
        for (let i = 0; i < p.el.callouts.length; i++) {
          if (p.startCalloutPositions[i]) {
            p.el.callouts[i].x = p.startCalloutPositions[i].x;
            p.el.callouts[i].y = p.startCalloutPositions[i].y;
          }
        }
      }
      if (p.el.updateCalloutText) p.el.updateCalloutText();
    }
  }

  findBestSnapOffset(elements, dx, dy) {
    const now = Date.now();
    const useCache = (now - this.lastSnapCheck) < this.snapCheckThrottle;
    const movingPorts = this.getMovingPorts(elements);
    if (movingPorts.length === 0) return null;

    let staticPorts;
    if (useCache && this.snapCache.has('staticPorts')) {
      staticPorts = this.snapCache.get('staticPorts');
    } else {
      staticPorts = this.getStaticPorts(elements);
      this.snapCache.set('staticPorts', staticPorts);
      this.lastSnapCheck = now;
    }

    let bestDist = Infinity;
    let bestSnapOffset = null;
    const predictedPorts = movingPorts.map(mp => ({
      predictedX: mp.worldX + dx,
      predictedY: mp.worldY + dy,
      originalX: mp.worldX,
      originalY: mp.worldY
    }));
    const snapDistSq = (this.options.snapDistance?.value || 10) ** 2;

    for (const pred of predictedPorts) {
      for (const tp of staticPorts) {
        const dx2 = pred.predictedX - tp.worldX;
        const dy2 = pred.predictedY - tp.worldY;
        const distSq = dx2 * dx2 + dy2 * dy2;
        if (distSq < bestDist && distSq < snapDistSq) {
          bestDist = distSq;
          bestSnapOffset = { ox: tp.worldX - pred.originalX, oy: tp.worldY - pred.originalY };
          if (distSq < 25) break;
        }
      }
      if (bestDist < 25) break;
    }
    return bestSnapOffset;
  }

  getMovingPorts(elements) {
    const ports = [];
    for (const el of elements) {
      if (el.ports?.length) {
        for (const port of el.ports) {
          if (port.worldX !== undefined && port.worldY !== undefined) {
            ports.push({ ...port, elementId: el.id });
          }
        }
      }
    }
    return ports;
  }

  getStaticPorts(movingElements) {
    const movingIds = new Set(movingElements.map(el => el.id));
    const allPorts = this.connectionManager?.getAllPorts() || [];
    const staticPorts = [];
    for (const port of allPorts) {
      if (!movingIds.has(port.elementId)) {
        const el = this.findElementById(port.elementId);
        if (el && this.isInteractive(el)) staticPorts.push(port);
      }
    }
    return staticPorts;
  }

  applyOffsetToElements(elements, offset) {
    const { ox, oy } = offset;
    for (const el of elements) {
      el.x += ox;
      el.y += oy;
      if (el.updatePorts) el.updatePorts();
      if (el.callouts?.length) {
        for (const c of el.callouts) {
          c.x += ox;
          c.y += oy;
        }
      }
      if (el.updateCalloutText) el.updateCalloutText();
    }
  }

  highlightSnappedPorts(elements, snapOffset) {
    if (!snapOffset) return;
    for (const el of elements) {
      if (el.ports?.length) {
        for (const port of el.ports) {
          const staticPorts = this.getStaticPorts(elements);
          for (const sp of staticPorts) {
            const dist = Math.hypot(port.worldX - sp.worldX, port.worldY - sp.worldY);
            if (dist < (this.options.snapDistance?.value || 10)) {
              this.renderer?.setHighlightedPort(sp);
              return;
            }
          }
        }
      }
    }
    this.renderer?.setHighlightedPort(null);
  }

  clearSnapCache() { this.snapCache.clear(); }

  // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

  onMouseMove(e) {
    const world = this.renderer.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Приоритет: режим рисования
    if (this.traceActive) {
      this.updateTracePreview(world);
      return;
    }

    if (this.dragCallout) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      this.dragCallout.callout.x = this.dragStartPositions[0].x + dx;
      this.dragCallout.callout.y = this.dragStartPositions[0].y + dy;
      this.dragCallout.element.updateCalloutText?.();
      this.renderer.draw();
      return;
    }

    if (this.isDragging && this.dragElements.length) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      if (!this._dragFrameRequest) {
        this._dragFrameRequest = requestAnimationFrame(() => {
          this.moveWithSnap(this.dragElements, dx, dy, this.dragStartPositions);
          this.renderer.draw();
          this._dragFrameRequest = null;
        });
      }
      return;
    }

    if (this.isPanning) {
      const deltaX = screen.x - this.dragStartScreen.x;
      const deltaY = screen.y - this.dragStartScreen.y;
      this.options.panX.value = this.dragStartPan.x + deltaX;
      this.options.panY.value = this.dragStartPan.y + deltaY;
      this.renderer.draw();
      return;
    }

    if (this.isSelecting && this.selectionStart) {
      this.selectionManager?.updateSelectionRect(screen.x, screen.y);
      this.renderer.updateSelectionRect(screen.x, screen.y);
      this.renderer.draw();
      return;
    }

    // Ховер
    const isOverCallout = this.options.showCallouts?.value && this.isPointOverCallout(world.x, world.y);
    if (!isOverCallout) {
      const element = this.findElementAt(world.x, world.y);
      this.renderer.setHighlightedElements(element ? [element] : []);
      if (this.options.showPorts?.value) {
        const port = this.findPortAt(world.x, world.y);
        this.renderer.setHighlightedPort(port);
        this.canvas.style.cursor = port ? 'crosshair' : (element ? 'pointer' : 'default');
      } else {
        this.canvas.style.cursor = element ? 'pointer' : 'default';
      }
    } else {
      this.renderer.setHighlightedElements([]);
      this.renderer.setHighlightedPort(null);
      this.canvas.style.cursor = 'default';
    }
    this.renderer.draw();
  }

  onMouseDown(e) {
    const world = this.renderer.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // ПРАВАЯ КНОПКА - ПРОСТО ВЫХОД ИЗ РЕЖИМА РИСОВАНИЯ (без удаления)
    if (e.button === 2) {
      e.preventDefault();
      if (this.traceActive) {
        this.cancelTrace();
        this.renderer.draw();
        return;
      }
      // Убираем поворот элемента по ПКМ, чтобы не мешал
      return;
    }

    // ЛЕВАЯ КНОПКА
    if (e.button === 0) {
      // Если в режиме рисования - создаем элемент
      if (this.traceActive) {
        this.handleTraceClick(world);
        this.renderer.draw();
        return;
      }

      const callout = this.findCalloutAt(world.x, world.y);
      if (callout && this.isInteractive(callout.element)) {
        this.dragCallout = callout;
        this.dragStartWorld = world;
        this.dragStartPositions = [{ el: callout.callout, x: callout.callout.x, y: callout.callout.y }];
        this.canvas.style.cursor = 'grabbing';
        this.renderer.draw();
        return;
      }

      const isOverCallout = this.options.showCallouts?.value && this.isPointOverCallout(world.x, world.y);
      if (isOverCallout) return;

      // Клик на порте - НАЧАЛО РИСОВАНИЯ
      if (this.options.showPorts?.value && !isOverCallout) {
        const port = this.findPortAt(world.x, world.y);
        if (port && this.isInteractive(this.findElementById(port.elementId))) {
          this.startTrace(port);
          this.renderer.draw();
          return;
        }
      }

      const element = this.findElementAt(world.x, world.y);
      if (element) {
        if (!this.isInteractive(element)) return;
        if (!e.ctrlKey && !e.metaKey) {
          if (!this.renderer.selectedElements.includes(element)) {
            this.renderer.setSelectedElements([element]);
          }
        } else {
          const selected = [...this.renderer.selectedElements];
          const idx = selected.findIndex(el => el.id === element.id);
          idx === -1 ? selected.push(element) : selected.splice(idx, 1);
          this.renderer.setSelectedElements(selected);
        }
        this.isDragging = true;
        this.dragElements = [...this.renderer.selectedElements].filter(el => this.isInteractive(el));
        this.dragStartWorld = world;
        this.dragStartPositions = this.dragElements.map(el => ({
          el,
          x: el.x,
          y: el.y,
          startCalloutPositions: el.callouts?.map(c => ({ x: c.x, y: c.y })) || []
        }));
        this.canvas.style.cursor = 'grabbing';
        this.clearSnapCache();
      } else {
        if (!e.ctrlKey && !e.metaKey) {
          this.renderer.setSelectedElements([]);
        }
        this.isSelecting = true;
        this.selectionStart = { x: screen.x, y: screen.y };
        this.selectionManager?.startSelectionRect(screen.x, screen.y);
        this.renderer.startSelectionRect(screen.x, screen.y);
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
      this.dragStartScreen = { x: screen.x, y: screen.y };
      this.canvas.style.cursor = 'grabbing';
    }
    this.renderer.draw();
  }

  onMouseUp(e) {
    if (this.isSelecting) {
      const selected = this.selectionManager?.endSelectionRect(
        this.options.panX.value, this.options.panY.value, this.options.scale?.value || 1, this.layerManager
      ) || [];
      if (selected.length) this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
      this.isSelecting = false;
      this.selectionStart = null;
      this.renderer.draw();
    }

    if (this.isDragging && this.dragElements.length && this.autoUpdateConnections) {
      setTimeout(() => {
        this.connectionManager?.updateAllPortsAndConnections(this.options.snapDistance?.value || 10, this.layerManager);
        this.renderer.draw();
      }, 50);
    }

    this.isDragging = false;
    this.isPanning = false;
    this.dragElements = [];
    this.dragCallout = null;
    this.dragStartPositions = [];
    this.canvas.style.cursor = '';

    if (this._dragFrameRequest) {
      cancelAnimationFrame(this._dragFrameRequest);
      this._dragFrameRequest = null;
    }

    this.clearSnapCache();

    setTimeout(() => {
      this.renderer.setHighlightedPort(null);
      this.renderer.draw();
    }, 100);
  }

  onWheel(e) {
    e.preventDefault();
    const before = this.renderer.screenToWorld(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(this.options.scale.value * delta, 0.2), 5);
    if (newScale !== this.options.scale.value) {
      this.options.scale.value = newScale;
      const after = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.options.panX.value += (after.x - before.x) * newScale;
      this.options.panY.value += (after.y - before.y) * newScale;
      this.renderer.draw();
    }
  }
}
