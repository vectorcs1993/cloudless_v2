// LayerManager.js

export class LayerManager {
  constructor(layers, activeLayerId = null) {
    this.layers = layers; // reactive ref to layers array
    this.activeLayerId = activeLayerId; // reactive ref to active layer id
    this.zIndexManager = null;

    // Глобальные счетчики ID
    this._nextElementId = 1;
    this._nextPortId = 1000;
  }

  // ========== УПРАВЛЕНИЕ СЧЕТЧИКАМИ ==========

  getNextElementId() {
    this._nextElementId++;
    return this._nextElementId;
  }

  getNextPortId() {
    this._nextPortId++;
    return this._nextPortId;
  }

  getCurrentElementId() {
    return this._nextElementId;
  }

  getCurrentPortId() {
    return this._nextPortId;
  }

  setCounters(elementId, portId) {
    this._nextElementId = Math.max(this._nextElementId, elementId || 1);
    this._nextPortId = Math.max(this._nextPortId, portId || 1000);
  }

  getCounters() {
    return {
      nextElementId: this._nextElementId,
      nextPortId: this._nextPortId
    };
  }

  // ========== УПРАВЛЕНИЕ ЭЛЕМЕНТАМИ ==========

  getAllElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer => layer.elements);
  }

  getVisibleElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer =>
      layer.visible ? layer.elements : []
    );
  }

  getInteractiveElements() {
    if (!this.layers.value) return [];
    return this.layers.value.flatMap(layer =>
      !layer.locked ? layer.elements : []
    );
  }

  isLayerLocked(element) {
    if (!element) return false;
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer.locked;
      }
    }
    return false;
  }

  isLayerVisible(element) {
    if (!this.layers.value) return true;
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer.visible;
      }
    }
    return true;
  }

  getElementLayer(element) {
    if (!this.layers.value) return null;
    for (const layer of this.layers.value) {
      if (layer.elements.includes(element)) {
        return layer;
      }
    }
    return null;
  }

  getActiveLayer() {
    if (!this.layers.value || !this.activeLayerId?.value) return this.layers.value?.[0];
    return this.layers.value.find(l => l.id === this.activeLayerId.value);
  }

  addElementToActiveLayer(element) {
    const activeLayer = this.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      activeLayer.elements.push(element);
      return true;
    }
    return false;
  }

  addElementToLayer(element, layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer && !layer.locked) {
      layer.elements.push(element);
      return true;
    }
    return false;
  }

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

  moveElementToLayer(elementId, targetLayerId, position = 'bottom') {
    let element = null;
    let sourceLayer = null;
    let sourceIndex = -1;

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

    const targetLayer = this.layers.value.find(l => l.id === targetLayerId);
    if (!targetLayer || targetLayer.locked) return false;

    sourceLayer.elements.splice(sourceIndex, 1);

    if (position === 'top') {
      targetLayer.elements.push(element);
    } else {
      targetLayer.elements.unshift(element);
    }

    return true;
  }

  // ========== УПРАВЛЕНИЕ СЛОЯМИ ==========

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

  removeLayer(layerId, moveElementsToLayerId = null) {
    const index = this.layers.value.findIndex(l => l.id === layerId);
    if (index === -1) return false;

    const layer = this.layers.value[index];

    if (moveElementsToLayerId && layer.elements.length > 0) {
      const targetLayer = this.layers.value.find(l => l.id === moveElementsToLayerId);
      if (targetLayer && !targetLayer.locked) {
        targetLayer.elements.push(...layer.elements);
      }
    }

    this.layers.value.splice(index, 1);

    if (this.activeLayerId?.value === layerId) {
      this.activeLayerId.value = this.layers.value[0]?.id || null;
    }

    return true;
  }

  toggleLayerVisibility(layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      return true;
    }
    return false;
  }

  toggleLayerLock(layerId) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.locked = !layer.locked;
      return true;
    }
    return false;
  }

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

  renameLayer(layerId, newName) {
    const layer = this.layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.name = newName;
      return true;
    }
    return false;
  }

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

  clearAllLayers() {
    for (const layer of this.layers.value) {
      layer.elements = [];
    }
  }

  setZIndexManager(zIndexManager) {
    this.zIndexManager = zIndexManager;
  }
}
