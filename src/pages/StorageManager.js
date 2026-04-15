// ========== КЛАСС МЕНЕДЖЕРА ХРАНЕНИЯ ==========
export class StorageManager {
  constructor(key) {
    this.key = key;
  }

  saveFullState(state) {
    const data = {
      layers: state.layers.map(layer => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        elements: layer.elements.map(el => el.toJSON())
      })),
      activeLayerId: state.activeLayerId,
      nextElementId: state.nextElementId,
      nextPortId: state.nextPortId,
      panX: state.panX,
      panY: state.panY,
      scale: state.scale,
      showColors: state.showColors,
      showElementAxes: state.showElementAxes,
      isDarkTheme: state.isDarkTheme,
      showGrid: state.showGrid,
      showPorts: state.showPorts,
      snapToPorts: state.snapToPorts,
      autoUpdateConnections: state.autoUpdateConnections,
      showCallouts: state.showCallouts,
      gridStepM: state.gridStepM,
      mmPerPx: state.mmPerPx,
      version: '2.0',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  loadFullState() {
    const savedData = localStorage.getItem(this.key);
    if (!savedData) return null;
    try {
      return JSON.parse(savedData);
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  }

  resetToDefault(defaultState) {
    this.saveFullState(defaultState);
    return defaultState;
  }
}
