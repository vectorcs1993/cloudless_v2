export class SelectionManager {
  constructor(elements, renderer, layerManager = null) {
    this.elements = elements; // reactive ref to elements
    this.renderer = renderer;
    this.layerManager = layerManager;
    this.selectedElements = [];
    this.selectionRect = null;
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? elements : (elements ? [elements] : []);
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

  isElementSelectable(element) {
    if (!this.layerManager) return true;
    return !this.layerManager.isLayerLocked(element);
  }

  getElementBounds(element) {
    const width = element.getWidth();
    const height = element.getHeight();
    const topLeft = element.getTopLeft();
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

  isElementIntersectsRect(element, worldRect) {
    const bounds = this.getElementBounds(element);

    return !(bounds.maxX < worldRect.minX ||
      bounds.minX > worldRect.maxX ||
      bounds.maxY < worldRect.minY ||
      bounds.minY > worldRect.maxY);
  }

  endSelectionRect(panX, panY, scale, layerManager = null) {
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
    // ПОЛУЧАЕМ ЭЛЕМЕНТЫ ПРАВИЛЬНО
    const allElements = this.elements.value || [];

    console.log('Selection rect:', rect, 'World rect:', worldRect);
    console.log('Total elements:', allElements.length);

    for (const element of allElements) {
      try {
        // Проверяем, можно ли выделить элемент
        const currentLayerManager = layerManager || this.layerManager;
        if (currentLayerManager && currentLayerManager.isLayerLocked(element)) {
          continue;
        }

        if (this.isElementIntersectsRect(element, worldRect)) {
          console.log('Element selected:', element.id, element.name);
          selected.push(element);
        }
      } catch (error) {
        console.warn('Error checking element intersection:', error);
      }
    }

    console.log('Selected count:', selected.length);

    this.selectedElements = selected;
    if (this.renderer) {
      this.renderer.setSelectedElements(selected);
      this.renderer.endSelectionRect();
    }

    this.selectionRect = null;
    return selected;
  }

  cleanup() {
    // nothing to clean
  }
}
