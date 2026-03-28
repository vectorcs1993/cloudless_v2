// ========== КЛАСС МЕНЕДЖЕРА ХРАНЕНИЯ ==========
export class StorageManager {
  constructor(key) {
    this.key = key;
  }

  save(elements, nextElementId, nextPortId, nextGroupId, render) {
    const data = {
      elements: elements.map(el => el.toJSON()),
      nextElementId,
      nextPortId,
      nextGroupId,
      panX: render.panX.value,
      panY: render.panY.value,
      scale: render.scale.value,
      version: '2.0',
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
