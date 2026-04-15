export class LayerManager {
  constructor(layers, activeLayerId = null) {
    this.layers = layers; // reactive ref to layers array
    this.activeLayerId = activeLayerId; // reactive ref to active layer id
    this.zIndexManager = null; // будет установлен позже


    // Глобальные счетчики ID
    this.nextElementId = 1;
    this.nextPortId = 1000;
  }

  // Установка менеджера z-index
  setZIndexManager(zIndexManager) {
    this.zIndexManager = zIndexManager;
  }

  // Получение всех элементов из всех слоёв
  getAllElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer => layer.elements);
  }

  // Получение видимых элементов
  getVisibleElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer =>
      layer.visible ? layer.elements : []
    );
  }

  // Получение интерактивных элементов (не заблокированных)
  getInteractiveElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer =>
      !layer.locked ? layer.elements : []
    );
  }

  // Проверка, заблокирован ли слой элемента
  isLayerLocked(element) {
    if (!element) return false;

    // Находим слой, содержащий элемент
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer.locked;
      }
    }
    return false;
  }

  // Проверка, видим ли слой элемента
  isLayerVisible(element) {
    if (!this.layers.value) return true;
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer.visible;
      }
    }
    return true;
  }

  // Получение слоя элемента
  getElementLayer(element) {
    if (!this.layers.value) return null;
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer;
      }
    }
    return null;
  }

  // Получение активного слоя
  getActiveLayer() {
    if (!this.layers.value || !this.activeLayerId?.value) return this.layers.value?.[0];
    return this.layers.value.find(l => l.id === this.activeLayerId.value);
  }

  // Добавление элемента в активный слой
  addElementToActiveLayer(element) {
    const activeLayer = this.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      activeLayer.elements.push(element);
      return true;
    }
    return false;
  }

  // Добавление элемента в указанный слой
  addElementToLayer(element, layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer && !layer.locked) {
      layer.elements.push(element);
      return true;
    }
    return false;
  }

  // Удаление элемента из всех слоёв
  removeElement(element) {
    for (const layer of this.layers.value) {
      const index = layer.elements.findIndex(el => el.id === element.id);
      if (index !== -1) {
        layer.elements.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  // Перемещение элемента между слоями
  moveElementToLayer(elementId, targetLayerId, position = 'bottom') {
    let element = null;
    let sourceLayer = null;
    let sourceIndex = -1;

    // Находим элемент и его текущий слой
    for (const layer of this.layers.value) {
      const index = layer.elements.findIndex(el => el.id === elementId);
      if (index !== -1) {
        element = layer.elements[index];
        sourceLayer = layer;
        sourceIndex = index;
        break;
      }
    }

    if (!element || !sourceLayer) return false;

    // Нельзя перемещать на заблокированный слой
    const targetLayer = this.layers.value.find(l => l.id === targetLayerId);
    if (!targetLayer || targetLayer.locked) return false;

    // Удаляем из исходного слоя
    sourceLayer.elements.splice(sourceIndex, 1);

    // Добавляем в целевой слой
    if (position === 'top') {
      targetLayer.elements.push(element);
    } else {
      targetLayer.elements.unshift(element);
    }

    return true;
  }

  // Создание нового слоя
  addLayer(name = null) {
    const newLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name || `Слой ${this.layers.value.length + 1}`,
      visible: true,
      locked: false,
      elements: []
    };
    this.layers.value.push(newLayer);
    return newLayer;
  }

  // Удаление слоя
  removeLayer(layerId, moveElementsToLayerId = null) {
    const index = this.layers.value.findIndex(l => l.id === layerId);
    if (index === -1) return false;

    const layer = this.layers.value[index];

    // Если нужно переместить элементы в другой слой
    if (moveElementsToLayerId && layer.elements.length > 0) {
      const targetLayer = this.layers.value.find(l => l.id === moveElementsToLayerId);
      if (targetLayer && !targetLayer.locked) {
        targetLayer.elements.push(...layer.elements);
      }
    }

    // Удаляем слой
    this.layers.value.splice(index, 1);

    // Если удалили активный слой, выбираем первый доступный
    if (this.activeLayerId?.value === layerId) {
      this.activeLayerId.value = this.layers.value[0]?.id || null;
    }

    return true;
  }

  // Переключение видимости слоя
  toggleLayerVisibility(layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      return true;
    }
    return false;
  }

  // Переключение блокировки слоя
  toggleLayerLock(layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.locked = !layer.locked;
      return true;
    }
    return false;
  }

  // Изменение порядка слоёв (перемещение вверх/вниз)
  moveLayerUp(layerId) {
    const index = this.layers.value.findIndex(l => l.id === layerId);
    if (index !== -1 && index < this.layers.value.length - 1) {
      [this.layers.value[index], this.layers.value[index + 1]] =
        [this.layers.value[index + 1], this.layers.value[index]];
      return true;
    }
    return false;
  }

  moveLayerDown(layerId) {
    const index = this.layers.value.findIndex(l => l.id === layerId);
    if (index !== -1 && index > 0) {
      [this.layers.value[index], this.layers.value[index - 1]] =
        [this.layers.value[index - 1], this.layers.value[index]];
      return true;
    }
    return false;
  }

  // Переименование слоя
  renameLayer(layerId, newName) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.name = newName;
      return true;
    }
    return false;
  }

  // Получение статистики по слоям
  getLayersStats() {
    return this.layers.value.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      elementsCount: layer.elements.length,
      elements: [...layer.elements]
    }));
  }

  // Очистка всех слоёв (удаление всех элементов)
  clearAllLayers() {
    for (const layer of this.layers.value) {
      layer.elements = [];
    }
  }

  // Получение следующего ID элемента
  getNextElementId() {
    this.nextElementId++;
    return this.nextElementId;
  }

  // Получение следующего ID порта
  getNextPortId() {
    this.nextPortId++;
    return this.nextPortId;
  }

  // Установка счетчиков из сохраненных данных
  setCounters(elementId, portId) {
    this.nextElementId = Math.max(this.nextElementId, elementId || 1);
    this.nextPortId = Math.max(this.nextPortId, portId || 1000);
  }

  // Получение текущих значений (для сохранения)
  getCounters() {
    return {
      nextElementId: this.nextElementId,
      nextPortId: this.nextPortId
    };
  }
}
