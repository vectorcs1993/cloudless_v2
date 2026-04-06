export class ZIndexManager {
  constructor(layers) {
    this.layers = layers; // reactive ref to layers array
    this.renderer = null;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  // Поиск слоя и индекса элемента
  findElementLayer(element) {
    if (!this.layers.value) return { layer: null, index: -1 };

    for (const layer of this.layers.value) {
      const index = layer.elements.findIndex(el => el.id === element.id);
      if (index !== -1) {
        return { layer, index };
      }
    }
    return { layer: null, index: -1 };
  }

  // Перемещение элемента на самый верх (внутри его слоя)
  moveToTop(element) {
    const { layer, index } = this.findElementLayer(element);
    if (layer && index !== -1 && layer.elements.length > 1) {
      const el = layer.elements.splice(index, 1)[0];
      layer.elements.push(el);
      this.renderer?.draw();
      return true;
    }
    return false;
  }

  // Перемещение элемента в самый низ (внутри его слоя)
  moveToBottom(element) {
    const { layer, index } = this.findElementLayer(element);
    if (layer && index !== -1 && layer.elements.length > 1) {
      const el = layer.elements.splice(index, 1)[0];
      layer.elements.unshift(el);
      this.renderer?.draw();
      return true;
    }
    return false;
  }

  // Перемещение элемента на один уровень вверх
  moveUp(element) {
    const { layer, index } = this.findElementLayer(element);
    if (layer && index !== -1 && index < layer.elements.length - 1) {
      [layer.elements[index], layer.elements[index + 1]] =
        [layer.elements[index + 1], layer.elements[index]];
      this.renderer?.draw();
      return true;
    }
    return false;
  }

  // Перемещение элемента на один уровень вниз
  moveDown(element) {
    const { layer, index } = this.findElementLayer(element);
    if (layer && index !== -1 && index > 0) {
      [layer.elements[index], layer.elements[index - 1]] =
        [layer.elements[index - 1], layer.elements[index]];
      this.renderer?.draw();
      return true;
    }
    return false;
  }

  // Перемещение элемента в указанную позицию внутри слоя
  moveToPosition(element, targetIndex) {
    const { layer, index } = this.findElementLayer(element);
    if (layer && index !== -1 && targetIndex >= 0 && targetIndex < layer.elements.length) {
      const el = layer.elements.splice(index, 1)[0];
      layer.elements.splice(targetIndex, 0, el);
      this.renderer?.draw();
      return true;
    }
    return false;
  }

  // Получение порядка элементов в слое (для отладки)
  getLayerOrder(layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      return layer.elements.map(el => ({ id: el.id, name: el.name, type: el.type }));
    }
    return [];
  }

  // Сортировка элементов в слое по заданному критерию
  sortLayer(layerId, comparator) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer && typeof comparator === 'function') {
      layer.elements.sort(comparator);
      this.renderer?.draw();
      return true;
    }
    return false;
  }
}
