export class SelectionManager {
  constructor(elements, renderer, layerManager = null) {
    this.elements = elements;
    this.renderer = renderer;
    this.layerManager = layerManager;
    this.selectedElements = [];
    this.selectionRect = null;
  }

  getAllElements() {
    if (!this.elements) return [];

    if (this.elements.value && Array.isArray(this.elements.value) && this.elements.value[0]?.elements !== undefined) {
      const result = [];
      for (const layer of this.elements.value) {
        if (layer.visible && !layer.locked) {
          result.push(...layer.elements);
        }
      }
      return result;
    }

    return this.elements.value || this.elements || [];
  }

  setSelectedElements(elements) {
    this.selectedElements = Array.isArray(elements) ? [...elements] : (elements ? [elements] : []);
    if (this.renderer) this.renderer.setSelectedElements(this.selectedElements);
  }

  startSelectionRect(x, y) {
    this.selectionRect = { startX: x, startY: y, endX: x, endY: y };
    if (this.renderer) this.renderer.startSelectionRect(x, y);
  }

  updateSelectionRect(x, y) {
    if (this.selectionRect) {
      this.selectionRect.endX = x;
      this.selectionRect.endY = y;
      if (this.renderer) this.renderer.updateSelectionRect(x, y);
    }
  }

  // Проверка пересечения линии с прямоугольником
  lineIntersectsRect(x1, y1, x2, y2, rect, lineWidth) {
    const tolerance = lineWidth / 2;

    // Расширенный прямоугольник
    const expandedRect = {
      minX: rect.minX - tolerance,
      minY: rect.minY - tolerance,
      maxX: rect.maxX + tolerance,
      maxY: rect.maxY + tolerance
    };

    // Проверка точек на линии
    const pointInRect = (px, py) => {
      return px >= expandedRect.minX && px <= expandedRect.maxX &&
        py >= expandedRect.minY && py <= expandedRect.maxY;
    };

    if (pointInRect(x1, y1) || pointInRect(x2, y2)) return true;

    // Проверка пересечения отрезка с прямоугольником
    const segmentsIntersect = (a1, a2, b1, b2) => {
      const orient = (p, q, r) => {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        return Math.sign(val);
      };

      const o1 = orient(a1, a2, b1);
      const o2 = orient(a1, a2, b2);
      const o3 = orient(b1, b2, a1);
      const o4 = orient(b1, b2, a2);

      if (o1 === 0 && this.pointOnSegment(b1, a1, a2)) return true;
      if (o2 === 0 && this.pointOnSegment(b2, a1, a2)) return true;
      if (o3 === 0 && this.pointOnSegment(a1, b1, b2)) return true;
      if (o4 === 0 && this.pointOnSegment(a2, b1, b2)) return true;

      return o1 !== o2 && o3 !== o4;
    };

    const edges = [
      { x1: expandedRect.minX, y1: expandedRect.minY, x2: expandedRect.minX, y2: expandedRect.maxY },
      { x1: expandedRect.maxX, y1: expandedRect.minY, x2: expandedRect.maxX, y2: expandedRect.maxY },
      { x1: expandedRect.minX, y1: expandedRect.minY, x2: expandedRect.maxX, y2: expandedRect.minY },
      { x1: expandedRect.minX, y1: expandedRect.maxY, x2: expandedRect.maxX, y2: expandedRect.maxY }
    ];

    for (const edge of edges) {
      if (segmentsIntersect(
        { x: x1, y: y1 }, { x: x2, y: y2 },
        { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 }
      )) {
        return true;
      }
    }

    return false;
  }

  pointOnSegment(p, a, b) {
    const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) > 1e-10) return false;

    const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
    if (dot < 0) return false;

    const squaredLen = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
    if (dot > squaredLen) return false;

    return true;
  }

  // Получение всех линий элемента
  getElementLines(element) {
    const lines = [];
    const width = element.getWidth();
    const height = element.getHeight();
    const topLeft = element.getTopLeft();
    const centerX = element.x;
    const centerY = element.y;

    // Сохраняем текущий rotation для restore
    const rotation = element.rotation || 0;

    // Вспомогательная функция для поворота точки
    const rotatePoint = (x, y) => {
      if (rotation === 0) return { x, y };
      const dx = x - centerX;
      const dy = y - centerY;
      const angleRad = rotation * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos
      };
    };

    // Горизонтальная линия через центр
    let p1 = rotatePoint(topLeft.x, centerY);
    let p2 = rotatePoint(topLeft.x + width, centerY);
    lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, lineWidth: element.lineWidth });

    // Вертикальная линия (для элементов с высотой)
    if (height > 0 && element.type !== 'duct' && element.type !== 'transition') {
      p1 = rotatePoint(centerX, topLeft.y);
      p2 = rotatePoint(centerX, topLeft.y + height);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, lineWidth: element.lineWidth });
    }

    // Для отвода - дополнительные линии
    if (element.type === 'elbow' && element.getPathPoints) {
      const { inlet, corner, outlet } = element.getPathPoints();
      p1 = rotatePoint(inlet.x, inlet.y);
      let pCorner = rotatePoint(corner.x, corner.y);
      p2 = rotatePoint(outlet.x, outlet.y);
      lines.push({ x1: p1.x, y1: p1.y, x2: pCorner.x, y2: pCorner.y, lineWidth: element.lineWidth });
      lines.push({ x1: pCorner.x, y1: pCorner.y, x2: p2.x, y2: p2.y, lineWidth: element.lineWidth });
    }

    // Для тройника - линия ветки
    if (element.type === 'tee' && element.getPorts) {
      const ports = element.getPorts();
      const branchPort = ports.find(p => p.direction === 'branch');
      if (branchPort && branchPort.worldX && branchPort.worldY) {
        lines.push({
          x1: centerX, y1: centerY,
          x2: branchPort.worldX, y2: branchPort.worldY,
          lineWidth: element.lineWidth
        });
      }
    }

    return lines;
  }

  endSelectionRect(panX, panY, scale, layerManager = null) {
    if (!this.selectionRect) return [];

    const startX = this.selectionRect.startX;
    const startY = this.selectionRect.startY;
    const endX = this.selectionRect.endX;
    const endY = this.selectionRect.endY;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Слишком маленькое выделение - игнорируем
    if (width < 5 && height < 5) {
      this.selectionRect = null;
      if (this.renderer) this.renderer.endSelectionRect();
      return [];
    }

    // Прямоугольник в МИРОВЫХ координатах
    const worldRect = {
      minX: (Math.min(startX, endX) - panX) / scale,
      minY: (Math.min(startY, endY) - panY) / scale,
      maxX: (Math.max(startX, endX) - panX) / scale,
      maxY: (Math.max(startY, endY) - panY) / scale
    };

    const allElements = this.getAllElements();
    const selected = [];
    const lm = layerManager || this.layerManager;

    for (const element of allElements) {
      if (lm && lm.isLayerLocked && lm.isLayerLocked(element)) continue;

      // Получаем все линии элемента
      const lines = this.getElementLines(element);
      let hit = false;

      // Проверяем каждую линию
      for (const line of lines) {
        if (this.lineIntersectsRect(line.x1, line.y1, line.x2, line.y2, worldRect, line.lineWidth)) {
          hit = true;
          break;
        }
      }

      // Если линии не найдены (прямоугольные элементы) - проверяем bounding box
      if (!hit && lines.length === 0) {
        const topLeft = element.getTopLeft();
        const elWidth = element.getWidth();
        const elHeight = element.getHeight();

        // Проверка пересечения прямоугольников
        if (!(topLeft.x + elWidth < worldRect.minX ||
          topLeft.x > worldRect.maxX ||
          topLeft.y + elHeight < worldRect.minY ||
          topLeft.y > worldRect.maxY)) {
          hit = true;
        }
      }

      if (hit) selected.push(element);
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
