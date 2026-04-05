// ========== КЛАСС МЕНЕДЖЕРА ХРАНЕНИЯ ==========
export class StorageManager {
  constructor(key) {
    this.key = key;
  }

  save(elements, nextElementId, nextPortId, nextGroupId, render) {
    const data = {
      elements: elements.map((el) => el.toJSON()),
      nextElementId,
      nextPortId,
      nextGroupId,
      panX: render.panX.value,
      panY: render.panY.value,
      scale: render.scale.value,
      showColors: render.showColors.value,
      showElementAxes: render.showElementAxes.value,
      showGrid: render.showGrid.value,
      showPorts: render.showPorts.value,
      snapToPorts: render.snapToPorts.value,
      autoUpdateConnections: render.autoUpdateConnections.value,
      showCallouts: render.showCallouts.value,
      isDarkTheme: render.isDarkTheme.value,
      gridStepM: render.gridStepM.value,
      mmPerPx: render.mmPerPx.value,
      version: '1.0',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  load() {
    const savedData = localStorage.getItem(this.key);
    if (!savedData) return null;
    try {
      return JSON.parse(savedData);
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  }
}
