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
    this.dragStartScreen = { x: 0, y: 0 }; // для панорамирования
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
    return this.layerManager?.getInteractiveElements() || this.elements.value || [];
  }

  findElementAt(x, y) {
    const ctx = this.canvas.getContext('2d');
    const elements = this.getInteractiveElements();
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].hitTest(x, y, ctx)) return elements[i];
    }
    return null;
  }

  findCalloutAt(x, y) {
    const elements = this.getInteractiveElements();
    for (const el of elements) {
      for (const callout of el.callouts || []) {
        const hit = callout.hitTest(x, y, this.options.scale.value, el);
        if (hit.hit) return { callout, element: el, isHandle: hit.isHandle };
      }
    }
    return null;
  }

  findPortAt(x, y, maxDist = 15) {
    const ports = this.connectionManager?.getAllPorts() || [];
    for (const port of ports) {
      const el = this.findElementById(port.elementId);
      if (el && !this.isInteractive(el)) continue;
      if (Math.hypot(port.worldX - x, port.worldY - y) < maxDist) return port;
    }
    return null;
  }

  findElementById(id) {
    const all = this.layerManager?.getAllElements() || this.elements.value || [];
    return all.find(el => el.id === id);
  }

  moveElement(el, dx, dy) {
    if (!this.isInteractive(el)) return;
    el.x += dx;
    el.y += dy;
    el.updatePorts?.();
    el.callouts?.forEach(c => { c.x += dx; c.y += dy; });
    el.updateCalloutText?.();
  }

  moveElements(elements, dx, dy) {
    for (const el of elements) {
      this.moveElement(el, dx, dy);
    }
  }

  moveWithSnap(elements, dx, dy, startPositions) {
    for (const p of startPositions) {
      p.el.x = p.x;
      p.el.y = p.y;
      p.el.updatePorts?.();
    }

    if (!this.options.snapToPorts?.value) {
      this.moveElements(elements, dx, dy);
      return;
    }

    const movingPorts = [];
    for (const el of elements) {
      if (el.ports) movingPorts.push(...el.ports);
    }
    if (movingPorts.length === 0) {
      this.moveElements(elements, dx, dy);
      return;
    }

    const movingIds = new Set(elements.map(el => el.id));
    let best = null;
    let bestDist = Infinity;

    for (const mp of movingPorts) {
      const allPorts = this.connectionManager.getAllPorts();
      for (const tp of allPorts) {
        if (movingIds.has(tp.elementId)) continue;
        const targetEl = this.findElementById(tp.elementId);
        if (targetEl && !this.isInteractive(targetEl)) continue;
        const predicted = { x: mp.worldX + dx, y: mp.worldY + dy };
        const dist = Math.hypot(predicted.x - tp.worldX, predicted.y - tp.worldY);
        if (dist < bestDist && dist < 40) {
          bestDist = dist;
          best = { movingPort: mp, targetPort: tp, ox: tp.worldX - mp.worldX, oy: tp.worldY - mp.worldY };
        }
      }
    }

    if (best) {
      this.moveElements(elements, best.ox, best.oy);
      this.renderer.setHighlightedPort(best.targetPort);
      if (this.autoUpdateConnections) {
        if (best.movingPort.isConnected?.()) {
          const old = this.connectionManager.getPortById(best.movingPort.connectedPortId);
          if (old) this.connectionManager.disconnectPorts(best.movingPort, old);
        }
        if (best.targetPort.isConnected?.()) {
          const old = this.connectionManager.getPortById(best.targetPort.connectedPortId);
          if (old) this.connectionManager.disconnectPorts(best.targetPort, old);
        }
        this.connectionManager.connectPorts(best.movingPort, best.targetPort);
      }
    } else {
      this.moveElements(elements, dx, dy);
      this.renderer.setHighlightedPort(null);
    }
  }

  onMouseDown(e) {
    const world = this.renderer.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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
        this.dragStartPositions = this.dragElements.map(el => ({ el, x: el.x, y: el.y }));
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
    } else if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      this.isPanning = true;
      this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
      this.dragStartScreen = { x: screen.x, y: screen.y };
      this.canvas.style.cursor = 'grabbing';
    }
    this.renderer.draw();
  }

  onMouseMove(e) {
    const world = this.renderer.screenToWorld(e.clientX, e.clientY);
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (this.dragCallout) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      this.dragCallout.callout.x = this.dragStartPositions[0].x + dx;
      this.dragCallout.callout.y = this.dragStartPositions[0].y + dy;
      this.dragCallout.element.updateCalloutText?.();
      this.renderer.draw();
      return;
    }

    if (this.isDragging && this.dragElements.length > 0) {
      const dx = world.x - this.dragStartWorld.x;
      const dy = world.y - this.dragStartWorld.y;
      this.moveWithSnap(this.dragElements, dx, dy, this.dragStartPositions);
      this.renderer.draw();
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

    const element = this.findElementAt(world.x, world.y);
    this.renderer.setHighlightedElements(element ? [element] : []);
    if (this.options.showPorts?.value) {
      const port = this.findPortAt(world.x, world.y);
      this.renderer.setHighlightedPort(port);
      this.canvas.style.cursor = port ? 'pointer' : (element ? 'pointer' : 'default');
    } else {
      this.canvas.style.cursor = element ? 'pointer' : 'default';
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
      this.connectionManager?.updateAllPortsAndConnections(40, this.layerManager);
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
