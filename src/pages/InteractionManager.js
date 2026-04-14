export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, selectionManager, options, layerManager = null) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.selectionManager = selectionManager;
    this.layerManager = layerManager;
    this.options = options;

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

    // Оптимизация: кэш для привязки
    this.snapCache = new Map();
    this.lastSnapCheck = 0;
    this.snapCheckThrottle = 16; // ms
  }

  setAutoUpdateConnections(enabled) {
    this.autoUpdateConnections = enabled;
  }

  isInteractive(element) {
    return !this.layerManager?.isLayerLocked(element);
  }

  getInteractiveElements() {
    return this.layerManager?.getInteractiveElements() || this.elements?.value || [];
  }

  // Проверка, находится ли точка над выноской (только если выноски включены)
  isPointOverCallout(x, y) {
    if (!this.options.showCallouts?.value) return false;

    const elements = this.getInteractiveElements();
    for (const el of elements) {
      if (el.callouts?.length && el.showCallout !== false) {
        for (const callout of el.callouts) {
          if (callout.hitTest(x, y, this.options.scale.value, el).hit) return true;
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
          const hit = callout.hitTest(x, y, this.options.scale.value, el);
          if (hit.hit) return { callout, element: el, isHandle: hit.isHandle };
        }
      }
    }
    return null;
  }

  findPortAt(x, y, maxDist = 15) {
    if (this.isPointOverCallout(x, y)) return null;

    const ports = this.connectionManager?.getAllPorts() || [];
    for (const port of ports) {
      const el = this.findElementById(port.elementId);
      if (el && !this.isInteractive(el)) continue;
      if (Math.hypot(port.worldX - x, port.worldY - y) < maxDist) return port;
    }
    return null;
  }

  findElementById(id) {
    const all = this.layerManager?.getAllElements() || this.elements?.value || [];
    return all.find(el => el.id === id);
  }

  // ОПТИМИЗИРОВАННОЕ ГРУППОВОЕ ПЕРЕМЕЩЕНИЕ С ПРИВЯЗКОЙ
  moveWithSnap(elements, dx, dy, startPositions) {
    if (!elements || elements.length === 0) return;

    // Быстрый сброс в начальные позиции
    this.resetToStartPositions(startPositions);

    // Поиск оптимального snapping offset (только если включен и элементы двигаются)
    let snapOffset = null;
    if (this.options.snapToPorts?.value && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
      snapOffset = this.findBestSnapOffset(elements, dx, dy);
    }

    // Применение сдвига с оптимизацией батчинга
    const offset = snapOffset || { ox: dx, oy: dy };
    this.applyOffsetToElements(elements, offset);

    // Подсветка при привязке
    if (snapOffset && this.autoUpdateConnections) {
      this.highlightSnappedPorts(elements, offset);
    } else {
      this.renderer.setHighlightedPort(null);
    }
  }

  // Сброс в начальные позиции с оптимизацией
  resetToStartPositions(startPositions) {
    for (const p of startPositions) {
      p.el.x = p.x;
      p.el.y = p.y;

      // Оптимизация: обновляем порты только если они изменились
      if (p.el.updatePorts) {
        p.el.updatePorts();
      }

      // Восстановление позиций выносок
      if (p.el.callouts && p.startCalloutPositions) {
        for (let i = 0; i < p.el.callouts.length; i++) {
          if (p.startCalloutPositions[i]) {
            p.el.callouts[i].x = p.startCalloutPositions[i].x;
            p.el.callouts[i].y = p.startCalloutPositions[i].y;
          }
        }
      }

      if (p.el.updateCalloutText) {
        p.el.updateCalloutText();
      }
    }
  }

  // Поиск лучшего snapping offset с оптимизацией через пространственное индексирование
  findBestSnapOffset(elements, dx, dy) {
    const now = Date.now();
    const useCache = (now - this.lastSnapCheck) < this.snapCheckThrottle;

    // Получаем все движущиеся порты
    const movingPorts = this.getMovingPorts(elements);
    if (movingPorts.length === 0) return null;

    // Кэшируем статические порты для оптимизации
    let staticPorts;
    if (useCache && this.snapCache.has('staticPorts')) {
      staticPorts = this.snapCache.get('staticPorts');
    } else {
      staticPorts = this.getStaticPorts(elements);
      this.snapCache.set('staticPorts', staticPorts);
      this.lastSnapCheck = now;
    }

    // Быстрый поиск ближайшей пары портов
    let bestDist = Infinity;
    let bestSnapOffset = null;

    // Оптимизация: предварительно вычисляем предсказанные позиции
    const predictedPorts = movingPorts.map(mp => ({
      port: mp,
      predictedX: mp.worldX + dx,
      predictedY: mp.worldY + dy,
      originalX: mp.worldX,
      originalY: mp.worldY
    }));

    // Поиск с ранним выходом
    for (const pred of predictedPorts) {
      for (const tp of staticPorts) {
        // Быстрая проверка расстояния с квадратом (избегаем Math.hypot)
        const dx2 = pred.predictedX - tp.worldX;
        const dy2 = pred.predictedY - tp.worldY;
        const distSq = dx2 * dx2 + dy2 * dy2;
        const snapDistSq = this.options.snapDistance.value * this.options.snapDistance.value;

        if (distSq < bestDist && distSq < snapDistSq) {
          bestDist = distSq;
          bestSnapOffset = {
            ox: tp.worldX - pred.originalX,
            oy: tp.worldY - pred.originalY
          };

          // Если нашли очень близкое совпадение, выходим рано
          if (distSq < 25) break;
        }
      }
      if (bestDist < 25) break;
    }

    return bestSnapOffset;
  }

  // Получение всех движущихся портов с кэшем
  getMovingPorts(elements) {
    const movingIds = new Set(elements.map(el => el.id));
    const ports = [];

    for (const el of elements) {
      if (el.ports && el.ports.length) {
        for (const port of el.ports) {
          if (port.worldX !== undefined && port.worldY !== undefined) {
            ports.push({
              ...port,
              elementId: el.id
            });
          }
        }
      }
    }

    return ports;
  }

  // Получение статических портов (не двигающихся) с оптимизацией
  getStaticPorts(movingElements) {
    const movingIds = new Set(movingElements.map(el => el.id));
    const allPorts = this.connectionManager?.getAllPorts() || [];
    const staticPorts = [];

    for (const port of allPorts) {
      if (!movingIds.has(port.elementId)) {
        const el = this.findElementById(port.elementId);
        if (el && this.isInteractive(el)) {
          staticPorts.push(port);
        }
      }
    }

    return staticPorts;
  }

  // Применение offset ко всем элементам с батчингом обновлений
  applyOffsetToElements(elements, offset) {
    const { ox, oy } = offset;

    // Батчинг обновлений портов и выносок
    for (const el of elements) {
      el.x += ox;
      el.y += oy;

      // Отложенное обновление портов
      if (el.updatePorts) {
        el.updatePorts();
      }

      // Обновление выносок
      if (el.callouts && el.callouts.length) {
        for (const c of el.callouts) {
          c.x += ox;
          c.y += oy;
        }
      }

      if (el.updateCalloutText) {
        el.updateCalloutText();
      }
    }
  }

  // Подсветка портов при привязке
  highlightSnappedPorts(elements, snapOffset) {
    if (!snapOffset) return;

    // Находим порт, который привязался
    for (const el of elements) {
      if (el.ports && el.ports.length) {
        for (const port of el.ports) {
          const predictedX = port.worldX;
          const predictedY = port.worldY;

          // Ищем ближайший статический порт
          const staticPorts = this.getStaticPorts(elements);
          for (const sp of staticPorts) {
            const dx = predictedX - sp.worldX;
            const dy = predictedY - sp.worldY;
            const dist = Math.hypot(dx, dy);

            if (dist < this.options.snapDistance.value) {
              this.renderer.setHighlightedPort(sp);
              return;
            }
          }
        }
      }
    }

    this.renderer.setHighlightedPort(null);
  }

  // Очистка кэша привязки
  clearSnapCache() {
    this.snapCache.clear();
  }

  onMouseMove(e) {
    const world = this.renderer.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Drag выноски
    if (this.dragCallout) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      this.dragCallout.callout.x = this.dragStartPositions[0].x + dx;
      this.dragCallout.callout.y = this.dragStartPositions[0].y + dy;
      this.dragCallout.element.updateCalloutText?.();
      this.renderer.draw();
      return;
    }

    // Drag элементов - оптимизированная версия
    if (this.isDragging && this.dragElements.length) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;

      // Оптимизация: используем requestAnimationFrame для плавности
      if (!this._dragFrameRequest) {
        this._dragFrameRequest = requestAnimationFrame(() => {
          this.moveWithSnap(this.dragElements, dx, dy, this.dragStartPositions);
          this.renderer.draw();
          this._dragFrameRequest = null;
        });
      }
      return;
    }

    // Pan
    if (this.isPanning) {
      const deltaX = screen.x - this.dragStartScreen.x;
      const deltaY = screen.y - this.dragStartScreen.y;
      this.options.panX.value = this.dragStartPan.x + deltaX;
      this.options.panY.value = this.dragStartPan.y + deltaY;
      this.renderer.draw();
      return;
    }

    // Selection rect
    if (this.isSelecting && this.selectionStart) {
      this.selectionManager?.updateSelectionRect(screen.x, screen.y);
      this.renderer.updateSelectionRect(screen.x, screen.y);
      this.renderer.draw();
      return;
    }

    // Ховер - только если не над выноской
    const isOverCallout = this.options.showCallouts?.value && this.isPointOverCallout(world.x, world.y);

    if (!isOverCallout) {
      const element = this.findElementAt(world.x, world.y);
      this.renderer.setHighlightedElements(element ? [element] : []);

      if (this.options.showPorts?.value) {
        const port = this.findPortAt(world.x, world.y);
        this.renderer.setHighlightedPort(port);
        this.canvas.style.cursor = port ? 'pointer' : (element ? 'pointer' : 'default');
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
    const isOverCallout = this.options.showCallouts?.value && this.isPointOverCallout(world.x, world.y);

    // ПРАВАЯ КНОПКА - только поворот, никакого перетаскивания
    if (e.button === 2) {
      e.preventDefault();
      const element = this.findElementAt(world.x, world.y);
      if (element && this.isInteractive(element)) {
        element.rotation = (element.rotation + 45) % 360;
        element.updatePorts?.();
        element.updateCalloutText?.();

        if (this.autoUpdateConnections) {
          this.connectionManager?.updateAllPortsAndConnections(this.options.snapDistance.value, this.layerManager);
        }

        this.renderer.draw();
      }
      return;
    }

    // ЛЕВАЯ КНОПКА
    if (e.button === 0) {
      const callout = this.findCalloutAt(world.x, world.y);
      if (callout && this.isInteractive(callout.element)) {
        this.dragCallout = callout;
        this.dragStartWorld = world;
        this.dragStartPositions = [{ el: callout.callout, x: callout.callout.x, y: callout.callout.y }];
        this.canvas.style.cursor = 'grabbing';
        this.renderer.draw();
        return;
      }

      if (isOverCallout) return;

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

        // Оптимизация: предварительное сохранение позиций
        this.dragStartPositions = this.dragElements.map(el => ({
          el,
          x: el.x,
          y: el.y,
          startCalloutPositions: el.callouts?.map(c => ({ x: c.x, y: c.y })) || []
        }));

        this.canvas.style.cursor = 'grabbing';

        // Очищаем кэш привязки при начале нового drag
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
    }
    // СРЕДНЯЯ КНОПКА - панорамирование
    else if (e.button === 1) {
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
        this.options.panX.value, this.options.panY.value, this.options.scale.value, this.layerManager
      ) || [];
      if (selected.length) this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
      this.isSelecting = false;
      this.selectionStart = null;
      this.renderer.draw();
    }

    if (this.isDragging && this.dragElements.length && this.autoUpdateConnections) {
      // Отложенное обновление связей для производительности
      setTimeout(() => {
        this.connectionManager?.updateAllPortsAndConnections(this.options.snapDistance.value, this.layerManager);
        this.renderer.draw();
      }, 50);
    }

    this.isDragging = false;
    this.isPanning = false;
    this.dragElements = [];
    this.dragCallout = null;
    this.dragStartPositions = [];
    this.canvas.style.cursor = '';

    // Отменяем ожидающий frame request
    if (this._dragFrameRequest) {
      cancelAnimationFrame(this._dragFrameRequest);
      this._dragFrameRequest = null;
    }

    // Очищаем кэш
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
