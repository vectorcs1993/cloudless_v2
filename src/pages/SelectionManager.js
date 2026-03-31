export class SelectionManager {
  constructor(elements, renderer) {
    this.elements = elements;
    this.renderer = renderer;
    this.selectedElements = [];
    this.selectionRect = null;
    this.tempCanvas = null;
    this.tempCtx = null;
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? elements : [elements];
    if (this.renderer) {
      this.renderer.setSelectedElements(this.selectedElements);
    }
  }

  getSelectedElements() {
    return this.selectedElements;
  }

  clearSelection() {
    this.selectedElements = [];
    if (this.renderer) {
      this.renderer.setSelectedElements([]);
    }
  }

  startSelectionRect(x, y) {
    this.selectionRect = { startX: x, startY: y, endX: x, endY: y };
    if (this.renderer) {
      this.renderer.startSelectionRect(x, y);
    }
  }

  updateSelectionRect(x, y) {
    if (this.selectionRect) {
      this.selectionRect.endX = x;
      this.selectionRect.endY = y;
      if (this.renderer) {
        this.renderer.updateSelectionRect(x, y);
      }
    }
  }

  // Получение временного canvas для отрисовки
  getTempContext() {
    if (!this.tempCanvas) {
      this.tempCanvas = document.createElement('canvas');
      this.tempCanvas.width = 2000;
      this.tempCanvas.height = 2000;
      this.tempCtx = this.tempCanvas.getContext('2d');
    }
    return this.tempCtx;
  }

  // Точная проверка пересечения элемента с областью выделения
  isElementIntersectsRect(element, worldRect, scale) {
    // Для групп используем рекурсивную проверку
    if (element.type === 'group') {
      if (!element.elements || element.elements.length === 0) return false;

      for (const childElement of element.elements) {
        if (this.isElementIntersectsRect(childElement, worldRect, scale)) {
          return true;
        }
      }
      return false;
    }

    const ctx = this.getTempContext();
    if (!ctx) return false;

    // Очищаем временный canvas
    ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

    ctx.save();

    try {
      // Рисуем контур элемента
      if (element.createPath) {
        element.createPath(ctx);
      } else {
        const width = element.getWidth();
        const height = element.getHeight();
        const topLeft = element.getTopLeft();

        const rotation = element.rotation || 0;
        if (rotation !== 0) {
          ctx.translate(element.x, element.y);
          ctx.rotate(rotation * Math.PI / 180);
          ctx.translate(-element.x, -element.y);
        }

        ctx.beginPath();
        ctx.rect(topLeft.x, topLeft.y, width, height);

        if (rotation !== 0) {
          ctx.restore();
          ctx.save();
        }
      }

      // ========== УЛУЧШЕННАЯ ЛОГИКА ПРОВЕРКИ ==========

      // 1. Проверяем, пересекается ли ограничивающий прямоугольник элемента с областью выделения
      // Это быстрая предварительная проверка
      const elementBounds = this.getElementBounds(element);
      const rectBounds = worldRect;

      const boundsIntersect = !(elementBounds.maxX < rectBounds.minX ||
        elementBounds.minX > rectBounds.maxX ||
        elementBounds.maxY < rectBounds.minY ||
        elementBounds.minY > rectBounds.maxY);

      if (!boundsIntersect) {
        ctx.restore();
        return false; // Быстрый выход, если даже bounding boxes не пересекаются
      }

      // 2. Проверяем, находится ли хотя бы одна вершина элемента внутри области выделения
      const corners = this.getElementCorners(element);
      for (const corner of corners) {
        if (corner.x >= worldRect.minX && corner.x <= worldRect.maxX &&
          corner.y >= worldRect.minY && corner.y <= worldRect.maxY) {
          if (ctx.isPointInPath(corner.x, corner.y)) {
            ctx.restore();
            return true;
          }
        }
      }

      // 3. Проверяем, находится ли область выделения полностью внутри элемента
      // Для этого проверяем, все ли углы области выделения внутри элемента
      const selectionCorners = [
        { x: worldRect.minX, y: worldRect.minY },
        { x: worldRect.maxX, y: worldRect.minY },
        { x: worldRect.maxX, y: worldRect.maxY },
        { x: worldRect.minX, y: worldRect.maxY }
      ];

      let allCornersInside = true;
      for (const corner of selectionCorners) {
        if (!ctx.isPointInPath(corner.x, corner.y)) {
          allCornersInside = false;
          break;
        }
      }

      if (allCornersInside) {
        ctx.restore();
        return true; // Вся область выделения внутри элемента
      }

      // 4. Проверяем пересечение границ элемента с областью выделения
      // Получаем все точки, где граница элемента пересекает область выделения
      const intersections = this.findIntersections(element, worldRect, ctx);
      if (intersections.length > 0) {
        ctx.restore();
        return true;
      }

      // 5. Дополнительная проверка: берем несколько случайных точек внутри области выделения
      // и проверяем их на принадлежность элементу
      const numSamples = 20; // Количество случайных точек
      for (let i = 0; i < numSamples; i++) {
        const sampleX = worldRect.minX + Math.random() * (worldRect.maxX - worldRect.minX);
        const sampleY = worldRect.minY + Math.random() * (worldRect.maxY - worldRect.minY);
        if (ctx.isPointInPath(sampleX, sampleY)) {
          ctx.restore();
          return true;
        }
      }

      ctx.restore();
      return false;

    } catch (error) {
      console.warn('Error in isElementIntersectsRect:', error);
      ctx.restore();
      return this.isElementInSelectionRectApproximate(element, worldRect);
    }
  }

  // Получение ограничивающего прямоугольника элемента
  getElementBounds(element) {
    const width = element.getWidth();
    const height = element.getHeight();
    const topLeft = element.getTopLeft();

    // Учитываем поворот для bounding box
    const rotation = element.rotation || 0;
    if (rotation !== 0) {
      const corners = [
        { x: topLeft.x, y: topLeft.y },
        { x: topLeft.x + width, y: topLeft.y },
        { x: topLeft.x + width, y: topLeft.y + height },
        { x: topLeft.x, y: topLeft.y + height }
      ];

      const angleRad = rotation * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const centerX = element.x;
      const centerY = element.y;

      const rotatedCorners = corners.map(corner => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        };
      });

      const minX = Math.min(...rotatedCorners.map(c => c.x));
      const minY = Math.min(...rotatedCorners.map(c => c.y));
      const maxX = Math.max(...rotatedCorners.map(c => c.x));
      const maxY = Math.max(...rotatedCorners.map(c => c.y));

      return { minX, minY, maxX, maxY };
    }

    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: topLeft.x + width,
      maxY: topLeft.y + height
    };
  }

  // Получение углов элемента (с учетом поворота)
  getElementCorners(element) {
    const width = element.getWidth();
    const height = element.getHeight();
    const topLeft = element.getTopLeft();

    const corners = [
      { x: topLeft.x, y: topLeft.y },
      { x: topLeft.x + width, y: topLeft.y },
      { x: topLeft.x + width, y: topLeft.y + height },
      { x: topLeft.x, y: topLeft.y + height }
    ];

    const rotation = element.rotation || 0;
    if (rotation !== 0) {
      const angleRad = rotation * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const centerX = element.x;
      const centerY = element.y;

      return corners.map(corner => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        };
      });
    }

    return corners;
  }

  // Поиск пересечений границ элемента с областью выделения
  findIntersections(element, worldRect, ctx) {
    const intersections = [];

    // Получаем точки на контуре элемента
    const bounds = this.getElementBounds(element);
    const step = 5; // Шаг проверки в пикселях

    // Проверяем границы элемента
    const edges = [
      // Верхняя граница
      { y: bounds.minY, minX: bounds.minX, maxX: bounds.maxX, isHorizontal: true },
      // Нижняя граница
      { y: bounds.maxY, minX: bounds.minX, maxX: bounds.maxX, isHorizontal: true },
      // Левая граница
      { x: bounds.minX, minY: bounds.minY, maxY: bounds.maxY, isHorizontal: false },
      // Правая граница
      { x: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY, isHorizontal: false }
    ];

    for (const edge of edges) {
      if (edge.isHorizontal) {
        for (let x = edge.minX; x <= edge.maxX; x += step) {
          if (x >= worldRect.minX && x <= worldRect.maxX &&
            edge.y >= worldRect.minY && edge.y <= worldRect.maxY) {
            if (ctx.isPointInPath(x, edge.y)) {
              intersections.push({ x, y: edge.y });
            }
          }
        }
      } else {
        for (let y = edge.minY; y <= edge.maxY; y += step) {
          if (edge.x >= worldRect.minX && edge.x <= worldRect.maxX &&
            y >= worldRect.minY && y <= worldRect.maxY) {
            if (ctx.isPointInPath(edge.x, y)) {
              intersections.push({ x: edge.x, y });
            }
          }
        }
      }
    }

    return intersections;
  }

  // Запасной приблизительный метод
  isElementInSelectionRectApproximate(element, worldRect) {
    const bounds = this.getElementBounds(element);

    // Проверка на пересечение прямоугольников
    const intersects = !(bounds.maxX < worldRect.minX ||
      bounds.minX > worldRect.maxX ||
      bounds.maxY < worldRect.minY ||
      bounds.minY > worldRect.maxY);

    return intersects;
  }

  endSelectionRect(panX, panY, scale) {
    if (!this.selectionRect) return [];

    const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
    const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);

    const minSelectionSize = 5;
    if (width < minSelectionSize && height < minSelectionSize) {
      this.selectionRect = null;
      if (this.renderer) {
        this.renderer.endSelectionRect();
      }
      return [];
    }

    const rect = {
      minX: Math.min(this.selectionRect.startX, this.selectionRect.endX),
      minY: Math.min(this.selectionRect.startY, this.selectionRect.endY),
      maxX: Math.max(this.selectionRect.startX, this.selectionRect.endX),
      maxY: Math.max(this.selectionRect.startY, this.selectionRect.endY)
    };

    // Конвертируем координаты выделения из экранных в мировые
    const worldRect = {
      minX: (rect.minX - panX) / scale,
      minY: (rect.minY - panY) / scale,
      maxX: (rect.maxX - panX) / scale,
      maxY: (rect.maxY - panY) / scale
    };

    const selected = [];

    for (const element of this.elements.value) {
      try {
        if (this.isElementIntersectsRect(element, worldRect, scale)) {
          selected.push(element);
        }
      } catch (error) {
        console.warn('Error checking element intersection:', error);
        if (this.isElementInSelectionRectApproximate(element, worldRect)) {
          selected.push(element);
        }
      }
    }

    this.selectedElements = selected;
    if (this.renderer) {
      this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
    }

    this.selectionRect = null;
    return selected;
  }

  cleanup() {
    if (this.tempCanvas) {
      this.tempCanvas = null;
      this.tempCtx = null;
    }
  }
}
