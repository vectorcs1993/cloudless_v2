export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, options) {
    this.canvas = canvas;
    this.elements = elements;           // ref массив элементов
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.options = options;              // содержит snapToPorts, panX, panY, scale и др.
    this.onElementMoveCallback = null;

    // Состояния взаимодействия
    this.isDragging = false;
    this.isPanning = false;
    this.isSelecting = false;
    this.draggingElement = null;
    this.draggingCallout = null;
    this.draggingCalloutElement = null;
    this.dragStartCalloutsPositions = null;
    this.dragStartMouseScreen = { x: 0, y: 0 };
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartElementPos = { x: 0, y: 0 };
    this.selectionStart = null;
    this.currentSnappedPorts = null;   // запоминаем текущее соединение при перетаскивании
    this.autoUpdateConnections = true; // флаг автоматического обновления связей
  }
  setAutoUpdateConnections(enabled) {
    this.autoUpdateConnections = enabled;
  }
  setOnElementMoveCallback(callback) {
    this.onElementMoveCallback = callback;
  }

  // Найти элемент под курсором (мировые координаты)
  findElementAt(x, y) {
    // Получаем контекст canvas для hitTest
    const ctx = this.canvas.getContext('2d');

    for (let i = this.elements.value.length - 1; i >= 0; i--) {
      const element = this.elements.value[i];
      // Передаём контекст в hitTest
      if (element.hitTest(x, y, ctx)) {
        return element;
      }
    }
    return null;
  }

  // Найти выноску под курсором
  findCalloutAt(x, y) {
    for (const element of this.elements.value) {
      for (const callout of element.callouts) {
        const hitResult = callout.hitTest(x, y, this.options.scale.value, element);
        if (hitResult.hit) {
          return { callout, element, isHandle: hitResult.isHandle };
        }
      }
    }
    return null;
  }

  // Найти порт под курсором
  findPortAtPosition(worldX, worldY, maxDistance = 15) {
    const allPorts = this.connectionManager.getAllPorts();
    for (const port of allPorts) {
      const distance = Math.hypot(port.worldX - worldX, port.worldY - worldY);
      if (distance < maxDistance) return port;
    }
    return null;
  }

  // Добавить выноску элементу
  addCalloutToElement(element, worldPos) {
    const calloutX = worldPos.x + 50 / this.options.scale.value;
    const calloutY = worldPos.y - 30 / this.options.scale.value;
    element.addCallout(calloutX, calloutY);
    element.updateCalloutText();
    this.renderer.draw();
  }

  // Перетаскивание выноски
  startDragCallout(calloutHit, e) {
    this.isDragging = true;
    this.draggingCallout = calloutHit;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartElementPos = { x: calloutHit.callout.x, y: calloutHit.callout.y };
    this.draggingCalloutElement = calloutHit.element;
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  // Начать перетаскивание элемента
  startDrag(element, e) {
    this.isDragging = true;
    this.draggingElement = element;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartElementPos = { x: element.x, y: element.y };

    // Сохраняем начальные позиции выносок элемента
    this.dragStartCalloutsPositions = (element.callouts || []).map(callout => ({
      callout,
      x: callout.x,
      y: callout.y
    }));

    // Запоминаем текущее соединение, если элемент не группа
    if (element.type !== 'group') {
      const connectedPort = element.ports?.find(p => p.isConnected());
      if (connectedPort) {
        const targetElement = this.elements.value.find(el => el.id === connectedPort.connectedElementId);
        if (targetElement) {
          const targetPort = targetElement.ports?.find(p => p.id === connectedPort.connectedPortId);
          if (targetPort) {
            this.currentSnappedPorts = { movingPort: connectedPort, targetPort };
          }
        }
      }
    } else {
      this.currentSnappedPorts = null;
    }

    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  // Панорамирование
  startPan(e) {
    this.isPanning = true;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };
    this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
    this.canvas.style.cursor = 'grabbing';
  }

  // Универсальное перемещение элемента или группы (относительное смещение)
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
    this.updateSelectedElementReactive();
  }

  // Установить абсолютную позицию элемента или группы
  setElementPosition(element, newX, newY) {
    const deltaX = newX - element.x;
    const deltaY = newY - element.y;
    this.moveElement(element, deltaX, deltaY);
  }

  // Установить соединение между портами и запомнить его
  connectPorts(movingPort, targetPort) {
    // Разрываем старые соединения, если они были
    if (movingPort.isConnected()) {
      const oldTarget = this.connectionManager.getPortById(movingPort.connectedPortId);
      if (oldTarget) this.connectionManager.disconnectPorts(movingPort, oldTarget);
    }
    if (targetPort.isConnected()) {
      const oldMoving = this.connectionManager.getPortById(targetPort.connectedPortId);
      if (oldMoving) this.connectionManager.disconnectPorts(targetPort, oldMoving);
    }
    this.connectionManager.connectPorts(movingPort, targetPort);
    this.currentSnappedPorts = { movingPort, targetPort };
  }

  applyPortSnapping(element, deltaWorldX, deltaWorldY) {
    // Сначала сбрасываем элемент в начальную позицию
    this.setElementPosition(element, this.dragStartElementPos.x, this.dragStartElementPos.y);

    if (!this.options.snapToPorts.value) {
      // Без привязки просто перемещаем на дельту
      this.moveElement(element, deltaWorldX, deltaWorldY);
      return;
    }

    const match = this.connectionManager.findClosestPortsForMoving(element, deltaWorldX, deltaWorldY, 40);

    if (match && match.distance < 40) {
      // Корректируем смещение, чтобы порт встал на место
      const adjustedDeltaX = deltaWorldX + match.offsetX;
      const adjustedDeltaY = deltaWorldY + match.offsetY;
      this.moveElement(element, adjustedDeltaX, adjustedDeltaY);
      // Убираем создание связи - только подсветка порта
      this.renderer.setHighlightedPort(match.targetPort);
    } else {
      this.moveElement(element, deltaWorldX, deltaWorldY);
      this.renderer.setHighlightedPort(null);
      // Убираем разрыв связей - они не создавались
    }
  }

  updateSelectedElementReactive() {
    if (this.onElementMoveCallback) {
      if (this.draggingElement) {
        this.onElementMoveCallback([this.draggingElement]);
      } else if (this.renderer.selectedElements) {
        this.onElementMoveCallback(this.renderer.selectedElements);
      }
    }
  }

  // ========== Обработчики событий canvas ==========
  onMouseDown(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (e.button === 0) {
      const isCtrlPressed = e.ctrlKey || e.metaKey;

      // Проверяем выноску
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
          this.renderer.selectedElements = [clickedElement];
          this.renderer.draw();
          if (this.onElementMoveCallback) {
            this.onElementMoveCallback(this.renderer.selectedElements);
          }
        }
        this.startDrag(clickedElement, e);
      } else {
        if (!isCtrlPressed) {
          this.renderer.selectedElements = [];
          this.renderer.draw();
        }
        this.isSelecting = true;
        const screenPos = {
          x: e.clientX - this.canvas.getBoundingClientRect().left,
          y: e.clientY - this.canvas.getBoundingClientRect().top
        };
        this.selectionStart = screenPos;
        this.renderer.startSelectionRect(screenPos.x, screenPos.y);
        this.renderer.draw();
      }

      if (this.onElementMoveCallback) {
        this.onElementMoveCallback(this.renderer.selectedElements);
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.startPan(e);
    } else if (e.button === 2) {
      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement) {
        this.addCalloutToElement(clickedElement, worldPos);
      }
    }
  }

  onMouseMove(e) {
    // Получаем правильные экранные координаты относительно canvas
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    // Перетаскивание выноски
    if (this.draggingCallout) {
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const deltaX = currentWorldPos.x - startWorldPos.x;
      const deltaY = currentWorldPos.y - startWorldPos.y;

      this.draggingCallout.callout.x = this.dragStartElementPos.x + deltaX;
      this.draggingCallout.callout.y = this.dragStartElementPos.y + deltaY;

      if (this.draggingCalloutElement) {
        this.draggingCalloutElement.updateCalloutText();
      }

      this.renderer.draw();
      return; // Важно: выходим, чтобы не проверять порты во время перетаскивания
    }

    // Перетаскивание элемента
    if (this.isDragging && this.draggingElement) {
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const deltaWorldX = currentWorldPos.x - startWorldPos.x;
      const deltaWorldY = currentWorldPos.y - startWorldPos.y;

      this.applyPortSnapping(this.draggingElement, deltaWorldX, deltaWorldY);
      this.renderer.draw();
      return;
    }

    // Панорамирование
    if (this.isPanning) {
      this.options.panX.value = this.dragStartPan.x + (e.clientX - this.dragStartMouseScreen.x);
      this.options.panY.value = this.dragStartPan.y + (e.clientY - this.dragStartMouseScreen.y);
      this.renderer.draw();
      return;
    }

    // Выделение прямоугольником
    if (this.isSelecting && this.selectionStart) {
      const currentScreenPos = {
        x: e.clientX - this.canvas.getBoundingClientRect().left,
        y: e.clientY - this.canvas.getBoundingClientRect().top
      };
      this.renderer.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.draw();
      return;
    }

    // Обычное состояние - проверяем порты и элементы
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
    if (this.isSelecting) {
      this.renderer.endSelectionRect();
      this.isSelecting = false;
      this.selectionStart = null;
      this.renderer.draw();

      if (this.onElementMoveCallback) {
        this.onElementMoveCallback(this.renderer.selectedElements);
      }
    }

    if (this.isDragging && this.draggingElement) {
      const movedElement = this.draggingElement;

      this.isDragging = false;
      this.draggingElement = null;
      this.dragStartCalloutsPositions = null;
      this.currentSnappedPorts = null;

      if (this.canvas) this.canvas.style.cursor = '';

      if (this.autoUpdateConnections && this.options.snapToPorts.value && movedElement) {
        setTimeout(() => {
          console.log('Автоматическое обновление связей после перемещения элемента');
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

    if (this.draggingCallout) {
      this.draggingCallout = null;
      this.draggingCalloutElement = null;
      if (this.canvas) this.canvas.style.cursor = '';

      // ПРИНУДИТЕЛЬНО ПРОВЕРЯЕМ ПОРТ ПОСЛЕ ЗАВЕРШЕНИЯ ПЕРЕТАСКИВАНИЯ ВЫНОСКИ
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Проверяем порт под курсором
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      if (portUnderCursor && this.options.showPorts.value) {
        this.renderer.setHighlightedPort(portUnderCursor);
        this.renderer.setTooltipPort(portUnderCursor, screenX, screenY);
        this.canvas.style.cursor = 'pointer';
      } else {
        // Проверяем элемент под курсором
        const elementUnderCursor = this.findElementAt(worldPos.x, worldPos.y);
        this.canvas.style.cursor = elementUnderCursor ? 'pointer' : 'default';
        this.renderer.setHighlightedPort(null);
        this.renderer.clearTooltip();
      }

      this.renderer.draw();
    }

    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = '';
      this.renderer.draw();
    }

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
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
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
