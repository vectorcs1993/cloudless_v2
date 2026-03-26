import { Tee, DuctDirect, Fan } from './Elements.js';

export class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, options) {
    this.canvas = canvas;
    this.elements = elements;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.options = options;
    this.onElementMoveCallback = null;

    // Состояния взаимодействия
    this.isDragging = false;
    this.isPanning = false;
    this.isSelecting = false;
    this.draggingElement = null;
    this.draggingCallout = null;
    this.draggingCalloutElement = null;
    this.dragStartCalloutsPositions = null;
    this.dragStartMouseScreen = { x: 0, y: 0 }; // Экранные координаты
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartElementPos = { x: 0, y: 0 };
    this.selectionStart = null;
    this.wasSnapped = false;
    this.currentSnappedPorts = null;
  }

  setOnElementMoveCallback(callback) {
    this.onElementMoveCallback = callback;
  }

  findElementAt(x, y) {
    for (let i = this.elements.value.length - 1; i >= 0; i--) {
      const element = this.elements.value[i];
      if (element.hitTest(x, y)) {
        return element;
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
    this.dragStartElementPos = { x: calloutHit.callout.x, y: calloutHit.callout.y };
    this.draggingCalloutElement = calloutHit.element;
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startDrag(element, e) {
    this.isDragging = true;
    this.draggingElement = element;
    this.dragStartMouseScreen = { x: e.clientX, y: e.clientY };

    // Сохраняем начальную позицию элемента в мировых координатах
    this.dragStartElementPos = { x: element.x, y: element.y };

    // Сохраняем начальные позиции выносок
    this.dragStartCalloutsPositions = (element.callouts || []).map(callout => ({
      callout,
      x: callout.x,
      y: callout.y
    }));

    // Для группы не проверяем привязку к портам
    if (element.type === 'group') {
      this.wasSnapped = false;
      this.currentSnappedPorts = null;
    } else {
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

  // Применение привязки к портам при перемещении
  applyPortSnapping(deltaWorldX, deltaWorldY) {
    if (!this.options.snapToPorts.value) {
      // Простое перемещение без привязки
      this.draggingElement.x = this.dragStartElementPos.x + deltaWorldX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaWorldY;

      // Перемещаем выноски вместе с элементом
      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaWorldX;
          callout.y = y + deltaWorldY;
        });
      }

      this.updateSelectedElementReactive();
      return;
    }

    const tempX = this.dragStartElementPos.x + deltaWorldX;
    const tempY = this.dragStartElementPos.y + deltaWorldY;
    let tempElement;

    // Создаем временный элемент для проверки привязки
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
      this.draggingElement.x = this.dragStartElementPos.x + deltaWorldX + offsetX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaWorldY + offsetY;

      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaWorldX + offsetX;
          callout.y = y + deltaWorldY + offsetY;
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
      this.draggingElement.x = this.dragStartElementPos.x + deltaWorldX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaWorldY;

      if (this.dragStartCalloutsPositions) {
        this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
          callout.x = x + deltaWorldX;
          callout.y = y + deltaWorldY;
        });
      }

      this.draggingElement.updatePorts();
      this.renderer.setHighlightedPort(null);
    }

    this.draggingElement.updateCalloutText();
    this.updateSelectedElementReactive();
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
        } else {
          this.renderer.selectedElements = [clickedElement];
          this.renderer.draw();
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
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    // Подсветка портов
    if (this.options.showPorts.value && !this.isDragging && !this.draggingCallout && !this.isSelecting) {
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      this.renderer.setHighlightedPort(portUnderCursor);
      this.canvas.style.cursor = portUnderCursor ? 'pointer' : 'default';
    } else if (!this.isDragging && !this.draggingCallout && !this.isSelecting) {
      this.renderer.setHighlightedPort(null);
    }

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
    }
    // Перетаскивание элемента
    else if (this.isDragging && this.draggingElement) {
      // Вычисляем дельту в мировых координатах
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouseScreen.x, this.dragStartMouseScreen.y);
      const deltaWorldX = worldPos.x - startWorldPos.x;
      const deltaWorldY = worldPos.y - startWorldPos.y;

      if (this.draggingElement.type === 'group') {
        // Для группы: новая позиция = начальная позиция группы + дельта
        // Но начальная позиция группы - это dragStartElementPos, который мы сохранили при старте
        const newGroupX = this.dragStartElementPos.x + deltaWorldX;
        const newGroupY = this.dragStartElementPos.y + deltaWorldY;

        // Вычисляем разницу между новой и текущей позицией группы
        const currentGroupX = this.draggingElement.x;
        const currentGroupY = this.draggingElement.y;
        const moveDeltaX = newGroupX - currentGroupX;
        const moveDeltaY = newGroupY - currentGroupY;

        // Перемещаем группу на вычисленную дельту
        if (Math.abs(moveDeltaX) > 0.001 || Math.abs(moveDeltaY) > 0.001) {
          this.draggingElement.move(moveDeltaX, moveDeltaY);

          // Перемещаем выноски группы
          if (this.dragStartCalloutsPositions && this.dragStartCalloutsPositions.length > 0) {
            this.dragStartCalloutsPositions.forEach(({ callout, x, y }) => {
              if (callout) {
                callout.x = x + moveDeltaX;
                callout.y = y + moveDeltaY;
              }
            });
          }

          this.updateSelectedElementReactive();
          this.renderer.draw();
        }
      } else {
        this.applyPortSnapping(deltaWorldX, deltaWorldY);
        this.renderer.draw();
      }
    }
    // Панорамирование
    else if (this.isPanning) {
      this.options.panX.value = this.dragStartPan.x + (e.clientX - this.dragStartMouseScreen.x);
      this.options.panY.value = this.dragStartPan.y + (e.clientY - this.dragStartMouseScreen.y);
      this.renderer.draw();
    }
    // Выделение прямоугольником
    else if (this.isSelecting && this.selectionStart) {
      const currentScreenPos = {
        x: e.clientX - this.canvas.getBoundingClientRect().left,
        y: e.clientY - this.canvas.getBoundingClientRect().top
      };
      this.renderer.updateSelectionRect(currentScreenPos.x, currentScreenPos.y);
      this.renderer.draw();
    }
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
      if (this.options.snapToPorts && typeof this.options.snapToPorts === 'object' && this.options.snapToPorts.value === true) {
        try {
          if (this.draggingElement.updatePortsWorldCoordinates) {
            this.draggingElement.updatePortsWorldCoordinates();
          }

          if (this.elements && this.elements.value) {
            this.elements.value.forEach(element => {
              if (element !== this.draggingElement && element.updatePortsWorldCoordinates) {
                element.updatePortsWorldCoordinates();
              }
            });
          }

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

    if (this.draggingCallout) {
      this.draggingCallout = null;
      this.draggingCalloutElement = null;
      if (this.canvas) this.canvas.style.cursor = '';
      if (this.renderer) this.renderer.draw();
    }

    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = '';
      if (this.renderer) this.renderer.draw();
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
