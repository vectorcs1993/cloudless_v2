import { Tee, DuctDirect, Fan } from './Elements.js';

// ========== КЛАСС МЕНЕДЖЕРА ВЗАИМОДЕЙСТВИЙ ==========
export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, options) {
    this.canvas = canvas;
    this.elements = elements;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.options = options;
    this.onElementMoveCallback = null;

    this.isDragging = false;
    this.isPanning = false;
    this.draggingElement = null;
    this.draggingCallout = null;
    this.draggingCalloutElement = null; // ссылку на элемент для выноски
    this.dragStartCalloutsPositions = null; // хранения начальных позиций выносок
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartElementPos = { x: 0, y: 0 };
    this.wasSnapped = false;
    this.currentSnappedPorts = null;
  }

  // Добавляем метод для установки callback
  setOnElementMoveCallback(callback) {
    this.onElementMoveCallback = callback;
  }

  findElementAt(x, y) {
    for (let i = this.elements.value.length - 1; i >= 0; i--) {
      if (this.elements.value[i].hitTest(x, y)) {
        return this.elements.value[i];
      }
    }
    return null;
  }

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

  onMouseDown(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (e.button === 0) {
      // Сначала проверяем выноски
      const calloutHit = this.findCalloutAt(worldPos.x, worldPos.y);
      if (calloutHit) {
        this.startDragCallout(calloutHit, e);
        return;
      }

      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement) {
        // ВАЖНО: Обновляем выделенный элемент
        this.renderer.setSelectedElement(clickedElement);
        this.startDrag(clickedElement, e);
      } else {
        // Снимаем выделение если кликнули мимо
        this.renderer.setSelectedElement(null);
        this.renderer.draw();
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.startPan(e);
    } else if (e.button === 2) {
      // Правый клик - добавить выноску
      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement) {
        this.addCalloutToElement(clickedElement, worldPos);
      }
    }
  }

  addCalloutToElement(element, worldPos) {
    // Добавляем выноску в позиции курсора, но со смещением
    const calloutX = worldPos.x + 50 / this.options.scale.value;
    const calloutY = worldPos.y - 30 / this.options.scale.value;
    element.addCallout(calloutX, calloutY);

    // Обновляем текст выноски
    element.updateCalloutText();

    this.renderer.draw();
  }

  startDragCallout(calloutHit, e) {
    this.isDragging = true;
    this.draggingCallout = calloutHit;
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragStartElementPos = { x: calloutHit.callout.x, y: calloutHit.callout.y };

    // Сохраняем ссылку на элемент, чтобы потом обновить текст
    this.draggingCalloutElement = calloutHit.element;

    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startDrag(element, e) {
    this.isDragging = true;
    this.draggingElement = element;
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragStartElementPos = { x: element.x, y: element.y };

    // Сохраняем начальные позиции выносок
    this.dragStartCalloutsPositions = element.callouts.map(callout => ({
      callout,
      x: callout.x,
      y: callout.y
    }));

    this.wasSnapped = element.ports?.some(p => p.isConnected()) || false;

    if (this.wasSnapped) {
      const connectedPort = element.ports.find(p => p.isConnected());
      if (connectedPort) {
        const targetElement = this.elements.value.find(el => el.id === connectedPort.connectedElementId);
        if (targetElement) {
          const targetPort = targetElement.ports.find(p => p.id === connectedPort.connectedPortId);
          if (targetPort) {
            this.currentSnappedPorts = { movingPort: connectedPort, targetPort };
          }
        }
      }
    }
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startPan(e) {
    this.isPanning = true;
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
    this.canvas.style.cursor = 'grabbing';
  }

  onMouseMove(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (this.options.showPorts.value && !this.isDragging && !this.draggingCallout) {
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      this.renderer.setHighlightedPort(portUnderCursor);
      this.canvas.style.cursor = portUnderCursor ? 'pointer' : 'default';
    } else if (!this.isDragging && !this.draggingCallout) {
      this.renderer.setHighlightedPort(null);
    }

    if (this.draggingCallout) {
      const currentWorldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouse.x, this.dragStartMouse.y);
      const deltaX = currentWorldPos.x - startWorldPos.x;
      const deltaY = currentWorldPos.y - startWorldPos.y;

      this.draggingCallout.callout.x = this.dragStartElementPos.x + deltaX;
      this.draggingCallout.callout.y = this.dragStartElementPos.y + deltaY;

      // Обновляем текст выноски на случай изменения параметров
      if (this.draggingCalloutElement) {
        this.draggingCalloutElement.updateCalloutText();
      }

      this.renderer.draw();
    } else if (this.isDragging && this.draggingElement) {
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouse.x, this.dragStartMouse.y);
      const deltaX = worldPos.x - startWorldPos.x;
      const deltaY = worldPos.y - startWorldPos.y;
      this.applyPortSnapping(deltaX, deltaY);
      this.renderer.draw();
    } else if (this.isPanning) {
      this.options.panX.value = this.dragStartPan.x + (e.clientX - this.dragStartMouse.x);
      this.options.panY.value = this.dragStartPan.y + (e.clientY - this.dragStartMouse.y);
      this.renderer.draw();
    }
  }

  applyPortSnapping(deltaX, deltaY) {
    if (!this.options.snapToPorts.value) {
      this.draggingElement.x = this.dragStartElementPos.x + deltaX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY;

      // Перемещаем выноски вместе с элементом
      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaX;
          callout.y = y + deltaY;
        });
      }

      this.updateSelectedElementReactive();
      return;
    }

    const tempX = this.dragStartElementPos.x + deltaX;
    const tempY = this.dragStartElementPos.y + deltaY;
    let tempElement;

    switch (this.draggingElement.type) {
      case 'duct':
        tempElement = new DuctDirect(this.draggingElement.id, tempX, tempY,
          this.draggingElement.length, this.draggingElement.width);
        break;
      case 'fan':
        tempElement = new Fan(this.draggingElement.id, tempX, tempY, this.draggingElement.diameter);
        tempElement.flow = this.draggingElement.flow;
        break;
      case 'tee':
        tempElement = new Tee(this.draggingElement.id, tempX, tempY,
          this.draggingElement.width, this.draggingElement.height);
        break;
      default:
        tempElement = { ...this.draggingElement, x: tempX, y: tempY };
    }
    tempElement.rotation = this.draggingElement.rotation || 0;

    const closestPortsPair = this.connectionManager.findClosestPorts(tempElement, 40);

    if (closestPortsPair && closestPortsPair.distance < 40) {
      if (this.wasSnapped && this.currentSnappedPorts) {
        this.connectionManager.disconnectPorts(this.currentSnappedPorts.movingPort, this.currentSnappedPorts.targetPort);
        this.wasSnapped = false;
        this.currentSnappedPorts = null;
      }

      const offsetX = closestPortsPair.targetPort.worldX - closestPortsPair.movingPort.worldX;
      const offsetY = closestPortsPair.targetPort.worldY - closestPortsPair.movingPort.worldY;
      this.draggingElement.x = this.dragStartElementPos.x + deltaX + offsetX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY + offsetY;

      // Перемещаем выноски вместе с элементом
      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaX + offsetX;
          callout.y = y + deltaY + offsetY;
        });
      }

      this.draggingElement.updatePorts();

      const updatedMovingPort = this.draggingElement.ports.find(p => p.direction === closestPortsPair.movingPort.direction);
      const updatedTargetPort = this.elements.value
        .find(el => el.id === closestPortsPair.targetPort.elementId)
        ?.ports.find(p => p.id === closestPortsPair.targetPort.id);

      if (updatedMovingPort && updatedTargetPort) {
        this.connectionManager.connectPorts(updatedMovingPort, updatedTargetPort);
        this.currentSnappedPorts = { movingPort: updatedMovingPort, targetPort: updatedTargetPort };
        this.wasSnapped = true;
      }
      this.renderer.setHighlightedPort(updatedTargetPort);
    } else {
      if (this.wasSnapped && this.currentSnappedPorts) {
        this.connectionManager.disconnectPorts(this.currentSnappedPorts.movingPort, this.currentSnappedPorts.targetPort);
        this.wasSnapped = false;
        this.currentSnappedPorts = null;
      }
      this.draggingElement.x = this.dragStartElementPos.x + deltaX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY;

      // Перемещаем выноски вместе с элементом
      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaX;
          callout.y = y + deltaY;
        });
      }

      this.draggingElement.updatePorts();
      this.renderer.setHighlightedPort(null);
    }

    this.draggingElement.updateCalloutText();
    this.updateSelectedElementReactive();
  }

  // Добавляем метод для обновления реактивной переменной
  updateSelectedElementReactive() {
    // Этот метод будет вызываться из onCanvasMouseMove через callback
    if (this.onElementMoveCallback) {
      this.onElementMoveCallback(this.draggingElement);
    }
  }
  findPortAtPosition(worldX, worldY, maxDistance = 15) {
    const allPorts = this.connectionManager.getAllPorts();
    for (const port of allPorts) {
      const distance = Math.hypot(port.worldX - worldX, port.worldY - worldY);
      if (distance < maxDistance) return port;
    }
    return null;
  }

  onMouseUp(e) {
    // Обработка завершения перемещения элемента
    if (this.isDragging && this.draggingElement) {
      // Проверяем наличие snapToPorts и его значение
      if (this.snapToPorts && typeof this.snapToPorts === 'object' && this.snapToPorts.value === true) {
        try {
          // Обновляем мировые координаты портов перемещаемого элемента
          if (this.draggingElement.updatePortsWorldCoordinates) {
            this.draggingElement.updatePortsWorldCoordinates();
          }

          // Обновляем координаты портов всех элементов
          if (this.elements && this.elements.value) {
            this.elements.value.forEach(element => {
              if (element !== this.draggingElement && element.updatePortsWorldCoordinates) {
                element.updatePortsWorldCoordinates();
              }
            });
          }

          // Ищем ближайшие порты
          const closest = this.connectionManager.findClosestPorts(this.draggingElement);
          if (closest && closest.distance < 40) {
            this.connectionManager.connectPorts(closest.movingPort, closest.targetPort);
          }
        } catch (error) {
          console.warn('Error during port snapping:', error);
        }
      }

      this.isDragging = false;
      this.draggingElement = null;
      this.dragStartCalloutsPositions = null;
      this.wasSnapped = false;
      this.currentSnappedPorts = null;
      if (this.canvas) this.canvas.style.cursor = '';
      if (this.renderer) this.renderer.draw();
    }

    // Обработка завершения перемещения выноски
    if (this.draggingCallout) {
      this.draggingCallout = null;
      this.draggingCalloutElement = null;
      if (this.canvas) this.canvas.style.cursor = '';
      if (this.renderer) this.renderer.draw();
    }

    // Обработка завершения панорамирования
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = '';
      if (this.renderer) this.renderer.draw();
    }

    // Очищаем подсветку порта через небольшую задержку
    setTimeout(() => {
      if (!this.isDragging && !this.draggingCallout && this.renderer) {
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
