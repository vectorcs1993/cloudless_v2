export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, selectionManager, options) {
    this.canvas = canvas;
    this.elements = elements;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.selectionManager = selectionManager;
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

  findElementAt(x, y) {
    const ctx = this.canvas.getContext('2d');

    const searchInElement = (element) => {
      if (element.hitTest(x, y, ctx)) {
        return element;
      }

      // Если элемент - группа, проверяем её элементы
      if (element.type === 'group' && element.elements) {
        for (let i = element.elements.length - 1; i >= 0; i--) {
          const result = searchInElement(element.elements[i]);
          if (result) return result;
        }
      }

      return null;
    };

    for (let i = this.elements.value.length - 1; i >= 0; i--) {
      const result = searchInElement(this.elements.value[i]);
      if (result) return result;
    }

    return null;
  }

  findCalloutAt(x, y) {
    // Рекурсивная функция для поиска выноски во всех элементах, включая группы
    const searchInElement = (element) => {
      // Проверяем выноски текущего элемента
      for (const callout of element.callouts) {
        const hitResult = callout.hitTest(x, y, this.options.scale.value, element);
        if (hitResult.hit) {
          return { callout, element, isHandle: hitResult.isHandle };
        }
      }

      // Если элемент - группа, рекурсивно ищем в её элементах
      if (element.type === 'group' && element.elements) {
        for (const child of element.elements) {
          const result = searchInElement(child);
          if (result) return result;
        }
      }

      return null;
    };

    // Ищем во всех элементах
    for (const element of this.elements.value) {
      const result = searchInElement(element);
      if (result) return result;
    }

    return null;
  }

  findPortAtPosition(worldX, worldY, maxDistance = 15) {
    const allPorts = this.connectionManager.getAllPorts();
    for (const port of allPorts) {
      const distance = Math.hypot(port.worldX - worldX, port.worldY - worldY);
      if (distance < maxDistance) return port;
    }
    return null;
  }

  addCalloutToElement(element, worldPos) {
    const calloutX = worldPos.x + 50 / this.options.scale.value;
    const calloutY = worldPos.y - 30 / this.options.scale.value;
    element.addCallout(calloutX, calloutY);
    element.updateCalloutText();
    this.renderer.draw();
  }

  startDragCallout(calloutHit, e) {
    this.isDragging = true;
    this.draggingCallout = calloutHit;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartCalloutPos = { x: calloutHit.callout.x, y: calloutHit.callout.y };
    this.draggingCalloutElement = calloutHit.element;
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  // Добавьте метод для поиска родительской группы:
  findParentGroup(element) {
    for (const el of this.elements.value) {
      if (el.type === 'group' && el.elements && el.elements.includes(element)) {
        return el;
      }
      // Рекурсивный поиск во вложенных группах
      if (el.type === 'group' && el.elements) {
        const found = this.findParentGroupInChildren(el, element);
        if (found) return found;
      }
    }
    return null;
  }

  findParentGroupInChildren(group, targetElement) {
    for (const el of group.elements) {
      if (el === targetElement) return group;
      if (el.type === 'group' && el.elements) {
        const found = this.findParentGroupInChildren(el, targetElement);
        if (found) return found;
      }
    }
    return null;
  }

  startDrag(e) {
    this.isDragging = true;
    this.draggingElements = [...this.renderer.selectedElements];
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
    for (const element of this.draggingElements) {
      if (element.type !== 'group') {
        const connectedPort = element.ports?.find(p => p.isConnected());
        if (connectedPort) {
          const targetElement = this.elements.value.find(el => el.id === connectedPort.connectedElementId);
          if (targetElement && !this.draggingElements.includes(targetElement)) {
            const targetPort = targetElement.ports?.find(p => p.id === connectedPort.connectedPortId);
            if (targetPort) {
              this.currentSnappedPorts.push({ movingPort: connectedPort, targetPort, element });
            }
          }
        }
      }
    }
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startPan(e) {
    this.isPanning = true;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
    this.canvas.style.cursor = 'grabbing';
  }

  moveElement(element, deltaX, deltaY) {
    if (element.type === 'group') {
      element.move(deltaX, deltaY);
    } else {
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
  }

  moveElements(elements, deltaX, deltaY) {
    for (const element of elements) {
      this.moveElement(element, deltaX, deltaY);
    }
    this.updateSelectedElementReactive();
  }

  setElementPosition(element, newX, newY) {
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

  applyPortSnappingForMultiple(elements, deltaWorldX, deltaWorldY, startPositions) {
    for (const pos of startPositions) {
      this.setElementPosition(pos.element, pos.x, pos.y);
    }

    if (!this.options.snapToPorts.value) {
      this.moveElements(elements, deltaWorldX, deltaWorldY);
      return;
    }

    // Используем новый метод, который учитывает все перемещаемые элементы
    const bestMatch = this.connectionManager.findClosestPortsForMovingWithMultiple(
      elements, deltaWorldX, deltaWorldY, 40
    );

    if (bestMatch) {
      const adjustedDeltaX = deltaWorldX + bestMatch.offsetX;
      const adjustedDeltaY = deltaWorldY + bestMatch.offsetY;
      this.moveElements(elements, adjustedDeltaX, adjustedDeltaY);
      this.renderer.setHighlightedPort(bestMatch.targetPort);
    } else {
      this.moveElements(elements, deltaWorldX, deltaWorldY);
      this.renderer.setHighlightedPort(null);
    }
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
        // Начинаем выделение прямоугольником
        this.isSelecting = true;
        const rect = this.canvas.getBoundingClientRect();
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        this.selectionStart = screenPos;
        // Запускаем прямоугольник выделения в selectionManager
        this.selectionManager.startSelectionRect(screenPos.x, screenPos.y);
        this.renderer.startSelectionRect(screenPos.x, screenPos.y);
        this.renderer.draw();
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.startPan(e);
    } else if (e.button === 2) {
      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement) {
        this.connectionManager.disconnectElement(clickedElement);
        clickedElement.rotation = ((clickedElement.rotation || 0) + 90) % 360;
        clickedElement.updatePorts();
        clickedElement.updateCalloutText();
        this.renderer.draw();
      }
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (this.draggingCallout) {
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const deltaX = currentWorldPos.x - startWorldPos.x;
      const deltaY = currentWorldPos.y - startWorldPos.y;

      // Перемещаем выноску
      this.draggingCallout.callout.x = this.dragStartCalloutPos.x + deltaX;
      this.draggingCallout.callout.y = this.dragStartCalloutPos.y + deltaY;

      // Обновляем текст выноски (на случай если он изменился)
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
      // Обновляем прямоугольник в selectionManager и renderer
      this.selectionManager.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.draw();
      return;
    }

    let cursorStyle = 'default';
    if (this.options.showPorts.value) {
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      this.renderer.setHighlightedPort(portUnderCursor);
      if (portUnderCursor) {
        this.renderer.setTooltipPort(portUnderCursor, screenX, screenY);
        cursorStyle = 'pointer';
      } else {
        this.renderer.clearTooltip();
        const elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
        if (elementUnderCursor) {
          cursorStyle = 'pointer';
        }
      }
    } else {
      const elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
      cursorStyle = elementUnderCursor ? 'pointer' : 'default';
      this.renderer.setHighlightedPort(null);
      this.renderer.clearTooltip();
    }
    this.canvas.style.cursor = cursorStyle;
    this.renderer.draw();
  }

  onMouseUp(e) {
    // Завершаем выделение прямоугольником
    if (this.isSelecting) {
      // Получаем выбранные элементы из selectionManager
      const selected = this.selectionManager.endSelectionRect(
        this.options.panX.value,
        this.options.panY.value,
        this.options.scale.value
      );
      // Обновляем renderer и callback
      this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
      if (this.onElementMoveCallback) {
        this.onElementMoveCallback(selected);
      }
      // Сбрасываем состояние выделения
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

      if (this.autoUpdateConnections && this.options.snapToPorts.value && movedElements.length > 0) {
        setTimeout(() => {
          console.log('Автоматическое обновление связей после перемещения элементов');
          const restored = this.connectionManager.updateAllPortsAndConnections(5);
          if (restored > 0) {
            console.log(`Автоматически восстановлено ${restored} связей`);
          }
          this.renderer.draw();
        }, 50);
      } else {
        this.renderer.draw();
      }
    }

    // Завершаем перетаскивание выноски
    if (this.draggingCallout) {
      this.draggingCallout = null;
      this.draggingCalloutElement = null;
      this.draggingCalloutParentGroup = null;

      if (this.canvas) this.canvas.style.cursor = '';
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      if (portUnderCursor && this.options.showPorts.value) {
        this.renderer.setHighlightedPort(portUnderCursor);
        this.renderer.setTooltipPort(portUnderCursor, screenX, screenY);
        this.canvas.style.cursor = 'pointer';
      } else {
        const elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
        this.canvas.style.cursor = elementUnderCursor ? 'pointer' : 'default';
        this.renderer.setHighlightedPort(null);
        this.renderer.clearTooltip();
      }
      this.renderer.draw();
    }

    // Завершаем панорамирование
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = '';
      this.renderer.draw();
    }

    // Очищаем подсветку порта через некоторое время
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


