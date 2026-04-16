// StorageManager.js

export class StorageManager {
  constructor(key) {
    this.key = key; // для проекта
    this.settingsKey = 'hvac_editor_settings'; // отдельный ключ для настроек
  }

  // ========== РАБОТА С ПРОЕКТОМ ==========

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

  // ========== РАБОТА С НАСТРОЙКАМИ РЕДАКТОРА ==========

  saveSettings(settings) {
    const settingsData = {
      showColors: settings.showColors,
      showElementAxes: settings.showElementAxes,
      isDarkTheme: settings.isDarkTheme,
      showGrid: settings.showGrid,
      showPorts: settings.showPorts,
      snapToPorts: settings.snapToPorts,
      autoUpdateConnections: settings.autoUpdateConnections,
      showCallouts: settings.showCallouts,
      mmPerPx: settings.mmPerPx,
      gridStepM: settings.gridStepM,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(this.settingsKey, JSON.stringify(settingsData));
  }

  loadSettings() {
    const savedSettings = localStorage.getItem(this.settingsKey);
    if (!savedSettings) return null;
    try {
      return JSON.parse(savedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  }

  resetToDefault(defaultState) {
    this.saveFullState(defaultState);
    return defaultState;
  }

  // Очистка только настроек
  clearSettings() {
    localStorage.removeItem(this.settingsKey);
  }

  // Очистка всего
  clearAll() {
    localStorage.removeItem(this.key);
    localStorage.removeItem(this.settingsKey);
  }
}
