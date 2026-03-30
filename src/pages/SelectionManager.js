export class SelectionManager {
  constructor(elements, renderer) {
    this.elements = elements;
    this.renderer = renderer;
    this.selectedElements = [];
    this.selectionRect = null;
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

  // Проверка пересечения повернутого прямоугольника с областью выделения
  isElementInSelectionRect(element, worldRect) {
    const width = element.getWidth();
    const height = element.getHeight();
    const centerX = element.x + width / 2;
    const centerY = element.y + height / 2;
    const rotation = element.rotation || 0;

    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 }
    ];

    const angleRad = rotation * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const worldCorners = corners.map(corner => ({
      x: centerX + corner.x * cos - corner.y * sin,
      y: centerY + corner.x * sin + corner.y * cos
    }));

    let anyCornerInside = false;
    let allCornersInside = true;

    for (const corner of worldCorners) {
      const isInside = corner.x >= worldRect.minX && corner.x <= worldRect.maxX &&
        corner.y >= worldRect.minY && corner.y <= worldRect.maxY;
      if (isInside) anyCornerInside = true;
      else allCornersInside = false;
    }

    if (allCornersInside || anyCornerInside) return true;

    for (let i = 0; i < worldCorners.length; i++) {
      const p1 = worldCorners[i];
      const p2 = worldCorners[(i + 1) % worldCorners.length];
      if (this.lineIntersectsRect(p1, p2, worldRect)) {
        return true;
      }
    }

    return false;
  }

  lineIntersectsRect(p1, p2, rect) {
    const rectEdges = [
      { p1: { x: rect.minX, y: rect.minY }, p2: { x: rect.maxX, y: rect.minY } },
      { p1: { x: rect.maxX, y: rect.minY }, p2: { x: rect.maxX, y: rect.maxY } },
      { p1: { x: rect.maxX, y: rect.maxY }, p2: { x: rect.minX, y: rect.maxY } },
      { p1: { x: rect.minX, y: rect.maxY }, p2: { x: rect.minX, y: rect.minY } }
    ];

    for (const edge of rectEdges) {
      if (this.segmentsIntersect(p1, p2, edge.p1, edge.p2)) {
        return true;
      }
    }

    return false;
  }

  segmentsIntersect(a, b, c, d) {
    const orientation = (p, q, r) => {
      const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
      if (val === 0) return 0;
      return val > 0 ? 1 : 2;
    };

    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && this.onSegment(a, c, b)) return true;
    if (o2 === 0 && this.onSegment(a, d, b)) return true;
    if (o3 === 0 && this.onSegment(c, a, d)) return true;
    if (o4 === 0 && this.onSegment(c, b, d)) return true;

    return false;
  }

  onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
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

    const worldRect = {
      minX: (rect.minX - panX) / scale,
      minY: (rect.minY - panY) / scale,
      maxX: (rect.maxX - panX) / scale,
      maxY: (rect.maxY - panY) / scale
    };

    const selected = [];

    for (const element of this.elements.value) {
      if (element.type === 'group') {
        const elementBounds = {
          minX: element.x,
          minY: element.y,
          maxX: element.x + element.getWidth(),
          maxY: element.y + element.getHeight()
        };
        const intersects = !(elementBounds.maxX < worldRect.minX ||
          elementBounds.minX > worldRect.maxX ||
          elementBounds.maxY < worldRect.minY ||
          elementBounds.minY > worldRect.maxY);

        if (intersects) {
          selected.push(element);
        }
      } else {
        if (this.isElementInSelectionRect(element, worldRect)) {
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
}
