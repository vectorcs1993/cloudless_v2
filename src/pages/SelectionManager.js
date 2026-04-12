export class SelectionManager {
  constructor(elements, renderer, layerManager = null) {
    this.elements = elements;
    this.renderer = renderer;
    this.layerManager = layerManager;
    this.selectedElements = [];
    this.selectionRect = null;
  }

  // Получение плоского массива всех элементов
  getAllElements() {
    if (!this.elements) return [];

    // Если это ref с layers
    if (this.elements.value && Array.isArray(this.elements.value) && this.elements.value[0]?.elements !== undefined) {
      return this.elements.value.flatMap(layer => layer.elements || []);
    }

    // Если это ref с массивом элементов
    if (this.elements.value && Array.isArray(this.elements.value)) {
      return this.elements.value;
    }

    // Если это прямой массив
    if (Array.isArray(this.elements)) {
      return this.elements;
    }

    return [];
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? [...elements] : (elements ? [elements] : []);
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

  // ГЛАВНЫЙ МЕТОД - выделение через hitTest элементов
  endSelectionRect(panX, panY, scale, layerManager = null) {
    if (!this.selectionRect || !this.renderer || !this.renderer.canvas) return [];

    const startX = this.selectionRect.startX;
    const startY = this.selectionRect.startY;
    const endX = this.selectionRect.endX;
    const endY = this.selectionRect.endY;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Слишком маленькое выделение - игнорируем (это был клик)
    if (width < 5 && height < 5) {
      this.selectionRect = null;
      if (this.renderer) this.renderer.endSelectionRect();
      return [];
    }

    // Прямоугольник выделения в МИРОВЫХ координатах
    const worldRect = {
      minX: (Math.min(startX, endX) - panX) / scale,
      minY: (Math.min(startY, endY) - panY) / scale,
      maxX: (Math.max(startX, endX) - panX) / scale,
      maxY: (Math.max(startY, endY) - panY) / scale
    };

    const allElements = this.getAllElements();
    const selected = [];
    const lm = layerManager || this.layerManager;

    // Получаем canvas контекст для hit testing
    const canvas = this.renderer.canvas;
    const ctx = canvas.getContext('2d');

    // Сохраняем и применяем трансформации как при рисовании
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    // Шаг проверки зависит от масштаба (чем больше зум, тем мельче шаг)
    const step = Math.max(5, 15 / scale);

    for (const element of allElements) {
      // Пропускаем заблокированные элементы
      if (lm && lm.isLayerLocked && lm.isLayerLocked(element)) {
        continue;
      }

      // Быстрая проверка по bounding box
      const elementBounds = this.getElementBounds(element);
      if (elementBounds.maxX < worldRect.minX ||
        elementBounds.minX > worldRect.maxX ||
        elementBounds.maxY < worldRect.minY ||
        elementBounds.minY > worldRect.maxY) {
        continue;
      }

      // Точная проверка через hitTest
      let hit = false;

      // Проверяем точки внутри прямоугольника выделения
      for (let x = worldRect.minX; x <= worldRect.maxX && !hit; x += step) {
        for (let y = worldRect.minY; y <= worldRect.maxY && !hit; y += step) {
          if (element.hitTest && element.hitTest(x, y, ctx)) {
            hit = true;
            break;
          }
        }
      }

      // Дополнительно проверяем границы прямоугольника
      if (!hit) {
        const edges = [
          // Верхняя граница
          ...this.generatePointsOnLine(worldRect.minX, worldRect.minY, worldRect.maxX, worldRect.minY, step),
          // Нижняя граница
          ...this.generatePointsOnLine(worldRect.minX, worldRect.maxY, worldRect.maxX, worldRect.maxY, step),
          // Левая граница
          ...this.generatePointsOnLine(worldRect.minX, worldRect.minY, worldRect.minX, worldRect.maxY, step),
          // Правая граница
          ...this.generatePointsOnLine(worldRect.maxX, worldRect.minY, worldRect.maxX, worldRect.maxY, step)
        ];

        for (const point of edges) {
          if (element.hitTest && element.hitTest(point.x, point.y, ctx)) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        selected.push(element);
      }
    }

    ctx.restore();

    // Обновляем выделение
    this.selectedElements = selected;
    if (this.renderer) {
      this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
    }

    this.selectionRect = null;
    return selected;
  }

  // Генерация точек на линии
  generatePointsOnLine(x1, y1, x2, y2, step) {
    const points = [];
    const length = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(length / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t
      });
    }
    return points;
  }

  // Получение bounding box элемента
  getElementBounds(element) {
    const width = element.getWidth();
    const height = element.getHeight();
    const topLeft = element.getTopLeft();

    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: topLeft.x + width,
      maxY: topLeft.y + height
    };
  }

  cleanup() {
    this.selectionRect = null;
    this.selectedElements = [];
  }
}
