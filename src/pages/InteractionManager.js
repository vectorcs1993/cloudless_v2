export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, selectionManager, options, layerManager = null) {
    this.canvas = canvas;
    this.elements = elements;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.selectionManager = selectionManager;
    this.layerManager = layerManager;
    this.options = options;
    this.onElementMoveCallback = null;

    // Состояния взаимодействия
    this.isDragging = false;
    this.isPanning = false;
    this.isSelecting = false;
    this.draggingElements = [];
    this.draggingCallout = null;
    this.draggingCalloutElement = null;
    this.dragStartCalloutsPositions = null;
    this.dragStartMouseScreen = { x: 0, y: 0 };
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartElementsPositions = [];
    this.selectionStart = null;
    this.currentSnappedPorts = null;
    this.autoUpdateConnections = true;
  }

  setAutoUpdateConnections(enabled) {
    this.autoUpdateConnections = enabled;
  }

  setOnElementMoveCallback(callback) {
    this.onElementMoveCallback = callback;
  }

  isElementInteractive(element) {
    if (!this.layerManager) return true;
    return !this.layerManager.isLayerLocked(element);
  }

  getAllPortsFromElements(elements) {
    const ports = [];
    for (const element of elements) {
      if (element.ports) {
        ports.push(...element.ports);
      }
    }
    return ports;
  }

  applyPortSnappingForMultiple(elements, deltaWorldX, deltaWorldY, startPositions) {
    // Возвращаем элементы на исходные позиции
    for (const pos of startPositions) {
      this.setElementPosition(pos.element, pos.x, pos.y);
    }

    if (!this.options.snapToPorts.value) {
      this.moveElements(elements, deltaWorldX, deltaWorldY);
      // Обновляем порты после перемещения
      for (const element of elements) {
        if (element.updatePorts) element.updatePorts();
      }
      return;
    }

    const movingPorts = this.getAllPortsFromElements(elements);
    const movingElementIds = new Set();
    for (const element of elements) {
      movingElementIds.add(element.id);
    }

    if (movingPorts.length === 0) {
      this.moveElements(elements, deltaWorldX, deltaWorldY);
      for (const element of elements) {
        if (element.updatePorts) element.updatePorts();
      }
      return;
    }

    let bestMatch = null;
    let bestDistance = Infinity;
    const allPorts = this.connectionManager.getAllPorts();

    for (const movingPort of movingPorts) {
      for (const targetPort of allPorts) {
        if (movingElementIds.has(targetPort.elementId)) continue;
        if (movingPort.elementId === targetPort.elementId) continue;

        if (this.layerManager) {
          const targetElement = this.findElementById(targetPort.elementId);
          if (targetElement && this.layerManager.isLayerLocked(targetElement)) continue;
        }

        const predictedX = movingPort.worldX + deltaWorldX;
        const predictedY = movingPort.worldY + deltaWorldY;
        const distance = Math.hypot(predictedX - targetPort.worldX, predictedY - targetPort.worldY);

        if (distance < bestDistance && distance < 40) {
          bestDistance = distance;
          bestMatch = {
            movingPort,
            targetPort,
            offsetX: targetPort.worldX - movingPort.worldX,
            offsetY: targetPort.worldY - movingPort.worldY
          };
        }
      }
    }

    if (bestMatch) {
      this.moveElements(elements, bestMatch.offsetX, bestMatch.offsetY);
      this.renderer.setHighlightedPort(bestMatch.targetPort);

      if (this.autoUpdateConnections) {
        this.connectPorts(bestMatch.movingPort, bestMatch.targetPort);
      }
    } else {
      this.moveElements(elements, deltaWorldX, deltaWorldY);
      this.renderer.setHighlightedPort(null);
    }

    // Обновляем порты после перемещения
    for (const element of elements) {
      if (element.updatePorts) element.updatePorts();
    }
  }

  startDrag(e) {
    this.isDragging = true;
    this.draggingElements = [...this.renderer.selectedElements];

    this.draggingElements = this.draggingElements.filter(el => this.isElementInteractive(el));

    if (this.draggingElements.length === 0) {
      this.isDragging = false;
      return;
    }

    this.dragStartElementsPositions = this.draggingElements.map(element => ({
      element,
      x: element.x,
      y: element.y,
      callouts: (element.callouts || []).map(callout => ({
        callout,
        x: callout.x,
        y: callout.y
      }))
    }));

    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.currentSnappedPorts = [];

    const movingPorts = this.getAllPortsFromElements(this.draggingElements);

    const movingElementIds = new Set();
    for (const element of this.draggingElements) {
      movingElementIds.add(element.id);
    }

    for (const movingPort of movingPorts) {
      if (movingPort.isConnected()) {
        const targetElement = this.findElementById(movingPort.connectedElementId);
        if (targetElement && !movingElementIds.has(targetElement.id) && this.isElementInteractive(targetElement)) {
          const targetPort = targetElement.ports?.find(p => p.id === movingPort.connectedPortId);
          if (targetPort) {
            this.currentSnappedPorts.push({ movingPort, targetPort, element: this.draggingElements[0] });
          }
        }
      }
    }

    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  moveElement(element, deltaX, deltaY) {
    if (!this.isElementInteractive(element)) return;

    element.x += deltaX;
    element.y += deltaY;
    element.updatePorts();
    if (element.callouts) {
      element.callouts.forEach(callout => {
        callout.x += deltaX;
        callout.y += deltaY;
      });
    }
    element.updateCalloutText();
  }

  getInteractiveElements() {
    if (this.layerManager) {
      return this.layerManager.getInteractiveElements();
    }
    return this.elements.value;
  }

  findElementAt(x, y) {
    const ctx = this.canvas.getContext('2d');
    const interactiveElements = this.getInteractiveElements();

    for (let i = interactiveElements.length - 1; i >= 0; i--) {
      const element = interactiveElements[i];
      if (element.hitTest(x, y, ctx)) {
        return element;
      }
    }
    return null;
  }

  findCalloutAt(x, y) {
    const interactiveElements = this.getInteractiveElements();

    for (const element of interactiveElements) {
      for (const callout of element.callouts) {
        const hitResult = callout.hitTest(x, y, this.options.scale.value, element);
        if (hitResult.hit) {
          return { callout, element, isHandle: hitResult.isHandle };
        }
      }
    }
    return null;
  }

  findPortAtPosition(worldX, worldY, maxDistance = 15) {
    const allPorts = this.connectionManager.getAllPorts();
    for (const port of allPorts) {
      if (this.layerManager) {
        const portElement = this.findElementById(port.elementId);
        if (portElement && this.layerManager.isLayerLocked(portElement)) {
          continue;
        }
      }
      const distance = Math.hypot(port.worldX - worldX, port.worldY - worldY);
      if (distance < maxDistance) return port;
    }
    return null;
  }

  findElementById(elementId) {
    const allElements = this.layerManager ? this.layerManager.getAllElements() : this.elements.value;
    return allElements.find(el => el.id === elementId);
  }

  addCalloutToElement(element, worldPos) {
    if (!this.isElementInteractive(element)) return;
    const calloutX = worldPos.x + 50 / this.options.scale.value;
    const calloutY = worldPos.y - 30 / this.options.scale.value;
    element.addCallout(calloutX, calloutY);
    element.updateCalloutText();
    this.renderer.draw();
  }

  startDragCallout(calloutHit, e) {
    if (!this.isElementInteractive(calloutHit.element)) return;
    this.isDragging = true;
    this.draggingCallout = calloutHit;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartCalloutPos = { x: calloutHit.callout.x, y: calloutHit.callout.y };
    this.draggingCalloutElement = calloutHit.element;
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startPan(e) {
    this.isPanning = true;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
    this.canvas.style.cursor = 'grabbing';
  }

  moveElements(elements, deltaX, deltaY) {
    for (const element of elements) {
      this.moveElement(element, deltaX, deltaY);
    }
    this.updateSelectedElementReactive();
  }

  setElementPosition(element, newX, newY) {
    if (!this.isElementInteractive(element)) return;
    const deltaX = newX - element.x;
    const deltaY = newY - element.y;
    this.moveElement(element, deltaX, deltaY);
  }

  connectPorts(movingPort, targetPort) {
    if (movingPort.isConnected()) {
      const oldTarget = this.connectionManager.getPortById(movingPort.connectedPortId);
      if (oldTarget) this.connectionManager.disconnectPorts(movingPort, oldTarget);
    }
    if (targetPort.isConnected()) {
      const oldMoving = this.connectionManager.getPortById(targetPort.connectedPortId);
      if (oldMoving) this.connectionManager.disconnectPorts(targetPort, oldMoving);
    }
    this.connectionManager.connectPorts(movingPort, targetPort);
    this.currentSnappedPorts = [{ movingPort, targetPort, element: this.draggingElements[0] }];
  }

  updateSelectedElementReactive() {
    if (this.onElementMoveCallback) {
      if (this.draggingElements.length > 0) {
        this.onElementMoveCallback(this.draggingElements);
      } else if (this.renderer.selectedElements) {
        this.onElementMoveCallback(this.renderer.selectedElements);
      }
    }
  }

  onMouseDown(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (e.button === 0) {
      const isCtrlPressed = e.ctrlKey || e.metaKey;

      const calloutHit = this.findCalloutAt(worldPos.x, worldPos.y);
      if (calloutHit) {
        this.startDragCallout(calloutHit, e);
        return;
      }

      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);

      if (clickedElement) {
        if (!this.isElementInteractive(clickedElement)) return;

        if (isCtrlPressed) {
          const index = this.renderer.selectedElements.findIndex(el => el.id === clickedElement.id);
          if (index === -1) {
            this.renderer.selectedElements.push(clickedElement);
          } else {
            this.renderer.selectedElements.splice(index, 1);
          }
          this.renderer.draw();
          if (this.onElementMoveCallback) {
            this.onElementMoveCallback(this.renderer.selectedElements);
          }
        } else {
          if (!this.renderer.selectedElements.includes(clickedElement)) {
            this.renderer.selectedElements = [clickedElement];
            this.renderer.draw();
            if (this.onElementMoveCallback) {
              this.onElementMoveCallback(this.renderer.selectedElements);
            }
          }
        }
        this.startDrag(e);
      } else {
        if (!isCtrlPressed) {
          this.renderer.selectedElements = [];
          this.renderer.draw();
          if (this.onElementMoveCallback) {
            this.onElementMoveCallback(this.renderer.selectedElements);
          }
        }
        this.isSelecting = true;
        const rect = this.canvas.getBoundingClientRect();
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        this.selectionStart = screenPos;
        this.selectionManager.startSelectionRect(screenPos.x, screenPos.y);
        this.renderer.startSelectionRect(screenPos.x, screenPos.y);
        this.renderer.draw();
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.startPan(e);
    } else if (e.button === 2) {
      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement && this.isElementInteractive(clickedElement)) {
        this.connectionManager.disconnectElement(clickedElement);
        clickedElement.rotation = ((clickedElement.rotation || 0) + 45) % 360;
        clickedElement.updatePorts();
        clickedElement.updateCalloutText();
        this.renderer.draw();
      }
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (this.draggingCallout) {
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const deltaX = currentWorldPos.x - startWorldPos.x;
      const deltaY = currentWorldPos.y - startWorldPos.y;

      this.draggingCallout.callout.x = this.dragStartCalloutPos.x + deltaX;
      this.draggingCallout.callout.y = this.dragStartCalloutPos.y + deltaY;

      if (this.draggingCalloutElement) {
        this.draggingCalloutElement.updateCalloutText();
      }

      this.renderer.draw();
      return;
    }

    if (this.isDragging && this.draggingElements.length > 0) {
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const deltaWorldX = currentWorldPos.x - startWorldPos.x;
      const deltaWorldY = currentWorldPos.y - startWorldPos.y;
      this.applyPortSnappingForMultiple(
        this.draggingElements,
        deltaWorldX,
        deltaWorldY,
        this.dragStartElementsPositions
      );
      this.renderer.draw();
      return;
    }

    if (this.isPanning) {
      this.options.panX.value = this.dragStartPan.x + (e.clientX - this.dragStartMouseScreen.x);
      this.options.panY.value = this.dragStartPan.y + (e.clientY - this.dragStartMouseScreen.y);
      this.renderer.draw();
      return;
    }

    if (this.isSelecting && this.selectionStart) {
      const currentScreenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      this.selectionManager.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.draw();
      return;
    }

    let cursorStyle = 'default';
    let elementUnderCursor = null;
    if (this.options.showPorts.value) {
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      this.renderer.setHighlightedPort(portUnderCursor);
      if (portUnderCursor) {
        cursorStyle = 'pointer';
      }
      elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
      if (elementUnderCursor && this.isElementInteractive(elementUnderCursor)) {
        cursorStyle = 'pointer';
      }
    } else {
      elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
      cursorStyle = (elementUnderCursor && this.isElementInteractive(elementUnderCursor)) ? 'pointer' : 'default';
      this.renderer.setHighlightedPort(null);
    }

    if (elementUnderCursor && this.isElementInteractive(elementUnderCursor)) {
      this.renderer.setHighlightedElements([elementUnderCursor]);
    } else {
      this.renderer.clearHighlightedElements();
    }

    this.canvas.style.cursor = cursorStyle;
    this.renderer.draw();
  }

  onMouseUp(e) {
    // Завершаем выделение прямоугольником
    if (this.isSelecting) {
      const selected = this.selectionManager.endSelectionRect(
        this.options.panX.value,
        this.options.panY.value,
        this.options.scale.value,
        this.layerManager
      );
      this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
      if (this.onElementMoveCallback) {
        this.onElementMoveCallback(selected);
      }
      this.isSelecting = false;
      this.selectionStart = null;
      this.renderer.draw();
    }

    // Завершаем перетаскивание элементов
    if (this.isDragging && this.draggingElements.length > 0) {
      const movedElements = [...this.draggingElements];
      this.isDragging = false;
      this.draggingElements = [];
      this.dragStartElementsPositions = [];
      this.currentSnappedPorts = null;
      if (this.canvas) this.canvas.style.cursor = '';

      // СИНХРОННОЕ ОБНОВЛЕНИЕ СВЯЗЕЙ
      if (this.autoUpdateConnections && this.options.snapToPorts.value) {
        // Сначала обновляем порты у всех перемещенных элементов
        for (const element of movedElements) {
          if (element.updatePorts) {
            element.updatePorts();
          }
        }

        // Затем обновляем все связи
        const result = this.connectionManager.updateAllPortsAndConnections(40, this.layerManager);
        console.log(`Связи после перемещения: разорвано ${result.broken}, создано ${result.connected}`);
      }

      this.renderer.draw();
    }

    // Завершаем перетаскивание выноски
    if (this.draggingCallout) {
      this.draggingCallout = null;
      this.draggingCalloutElement = null;
      this.draggingCalloutParentGroup = null;

      if (this.canvas) this.canvas.style.cursor = '';
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      if (portUnderCursor && this.options.showPorts.value) {
        this.renderer.setHighlightedPort(portUnderCursor);
        this.canvas.style.cursor = 'pointer';
      } else {
        const elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
        this.canvas.style.cursor = (elementUnderCursor && this.isElementInteractive(elementUnderCursor)) ? 'pointer' : 'default';
        this.renderer.setHighlightedPort(null);
      }
      this.renderer.draw();
    }

    // Завершаем панорамирование
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = '';
      this.renderer.draw();
    }

    // Очищаем подсветку порта
    setTimeout(() => {
      if (!this.isDragging && !this.draggingCallout && !this.isSelecting && this.renderer) {
        if (this.renderer.setHighlightedPort) {
          this.renderer.setHighlightedPort(null);
        }
        this.renderer.draw();
      }
    }, 100);
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const worldBefore = this.renderer.screenToWorld(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(this.options.scale.value * delta, 0.2), 5);

    if (newScale !== this.options.scale.value) {
      this.options.scale.value = newScale;
      const worldAfter = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.options.panX.value += (worldAfter.x - worldBefore.x) * this.options.scale.value;
      this.options.panY.value += (worldAfter.y - worldBefore.y) * this.options.scale.value;
      this.renderer.draw();
    }
  }
}
