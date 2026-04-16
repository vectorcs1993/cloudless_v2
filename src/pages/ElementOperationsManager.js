export class ElementOperationsManager {
  constructor(connectionManager, layerManager, autoUpdateConnections, snapDistance, zIndexManager, scheduleRender, showNotify) {
    this.connectionManager = connectionManager;
    this.layerManager = layerManager;
    this.autoUpdateConnections = autoUpdateConnections;
    this.snapDistance = snapDistance;
    this.zIndexManager = zIndexManager;
    this.scheduleRender = scheduleRender;
    this.showNotify = showNotify;
  }

  rotateElement(element, angleDeg) {
    if (!element) return;
    if (this.layerManager.isLayerLocked(element)) return;

    element.rotation = (element.rotation + angleDeg + 360) % 360;
    element.updatePorts?.();
    element.updateCalloutText?.();

    if (this.connectionManager && this.autoUpdateConnections.value) {
      this.connectionManager.updateAllPortsAndConnections(this.snapDistance.value, this.layerManager);
    }
    this.scheduleRender();
  }

  rotateLeft45(element) { this.rotateElement(element, -45); }
  rotateRight45(element) { this.rotateElement(element, 45); }
  rotateLeft90(element) { this.rotateElement(element, -90); }
  rotateRight90(element) { this.rotateElement(element, 90); }
  rotateLeft180(element) { this.rotateElement(element, -180); }
  rotateRight180(element) { this.rotateElement(element, 180); }

  moveToTop(element) {
    if (element) { this.zIndexManager?.moveToTop(element); this.scheduleRender(); }
  }
  moveToBottom(element) {
    if (element) { this.zIndexManager?.moveToBottom(element); this.scheduleRender(); }
  }
  moveUp(element) {
    if (element) { this.zIndexManager?.moveUp(element); this.scheduleRender(); }
  }
  moveDown(element) {
    if (element) { this.zIndexManager?.moveDown(element); this.scheduleRender(); }
  }

  deleteSelected(selectedElements) {
    if (!selectedElements.length) return;
    const ids = selectedElements.map(el => el.id);
    for (const el of selectedElements) {
      this.connectionManager?.disconnectElement(el);
    }
    this.layerManager.removeElementsByIds(ids);
    if (this.autoUpdateConnections.value) {
      this.connectionManager.updateAllPortsAndConnections(this.snapDistance.value, this.layerManager);
    }
    this.scheduleRender();
    return []; // новый пустой массив для обновления выделения
  }
}
