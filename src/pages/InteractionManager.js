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
    // Если над выноской - не находим элемент
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

  moveWithSnap(elements, dx, dy, startPositions) {
    // Сброс в начальные позиции
    for (const p of startPositions) {
      p.el.x = p.x;
      p.el.y = p.y;
      p.el.updatePorts?.();
      if (p.el.callouts && p.startCalloutPositions) {
        for (let i = 0; i < p.el.callouts.length; i++) {
          p.el.callouts[i].x = p.startCalloutPositions[i].x;
          p.el.callouts[i].y = p.startCalloutPositions[i].y;
        }
      }
      p.el.updateCalloutText?.();
    }

    // Поиск snapping
    let snapOffset = null;
    if (this.options.snapToPorts?.value) {
      const movingPorts = elements.flatMap(el => el.ports || []);
      const movingIds = new Set(elements.map(el => el.id));
      let bestDist = Infinity;

      for (const mp of movingPorts) {
        for (const tp of this.connectionManager.getAllPorts()) {
          if (movingIds.has(tp.elementId)) continue;
          const targetEl = this.findElementById(tp.elementId);
          if (targetEl && !this.isInteractive(targetEl)) continue;

          const predicted = { x: mp.worldX + dx, y: mp.worldY + dy };
          const dist = Math.hypot(predicted.x - tp.worldX, predicted.y - tp.worldY);
          if (dist < bestDist && dist < this.options.snapDistance.value) {
            bestDist = dist;
            snapOffset = { ox: tp.worldX - mp.worldX, oy: tp.worldY - mp.worldY };
          }
        }
      }
    }

    // Применение сдвига
    const offset = snapOffset || { ox: dx, oy: dy };
    for (const el of elements) {
      el.x += offset.ox;
      el.y += offset.oy;
      el.updatePorts?.();
      if (el.callouts) {
        for (const c of el.callouts) {
          c.x += offset.ox;
          c.y += offset.oy;
        }
      }
      el.updateCalloutText?.();
    }

    // Подсветка и соединение при snap
    if (snapOffset && this.autoUpdateConnections) {
      // Здесь можно добавить логику соединения портов, но она сложная
      // Пока просто подсветим
      this.renderer.setHighlightedPort(null);
    } else {
      this.renderer.setHighlightedPort(null);
    }
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

    // Drag элементов
    if (this.isDragging && this.dragElements.length) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      this.moveWithSnap(this.dragElements, dx, dy, this.dragStartPositions);
      this.renderer.draw();
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
      return; // Выходим, не переходим к другим обработчикам
    }

    // ЛЕВАЯ КНОПКА - всё как было
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
        this.dragStartPositions = this.dragElements.map(el => ({
          el,
          x: el.x,
          y: el.y,
          startCalloutPositions: el.callouts?.map(c => ({ x: c.x, y: c.y })) || []
        }));
        this.canvas.style.cursor = 'grabbing';
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
      this.connectionManager?.updateAllPortsAndConnections(this.options.snapDistance.value, this.layerManager);
    }

    this.isDragging = false;
    this.isPanning = false;
    this.dragElements = [];
    this.dragCallout = null;
    this.dragStartPositions = [];
    this.canvas.style.cursor = '';

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
