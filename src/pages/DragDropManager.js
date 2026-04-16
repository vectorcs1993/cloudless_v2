import { ElementFactory } from './ElementFactory.js';

export class DragDropManager {
  constructor(renderer, layerManager, updateSelectionCallback, scheduleRender, showNotify) {
    this.renderer = renderer;
    this.layerManager = layerManager;
    this.updateSelectionCallback = updateSelectionCallback;
    this.scheduleRender = scheduleRender;
    this.showNotify = showNotify;

    this.dragType = null;
    this.ghostElement = null;
  }

  onDragStart(e, item) {
    this.dragType = item.type;
    const worldPos = this.renderer?.screenToWorld(e.clientX, e.clientY);
    if (worldPos) {
      this.ghostElement = ElementFactory.createGhostElement(this.dragType, worldPos.x, worldPos.y);
      this.renderer?.setGhostElement(this.ghostElement);
      this.scheduleRender();
    }
    e.dataTransfer.setData('text/plain', item.type);
    e.dataTransfer.effectAllowed = 'copy';
    const dragIcon = document.createElement('div');
    dragIcon.style.opacity = '0';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 0, 0);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  }

  onDragEnd() {
    this.dragType = null;
    this.ghostElement = null;
    this.renderer?.clearGhostElement();
    this.scheduleRender();
  }

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (this.ghostElement && this.renderer) {
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      if (worldPos) {
        this.ghostElement.x = worldPos.x;
        this.ghostElement.y = worldPos.y;
        this.renderer.setGhostElement(this.ghostElement);
        this.scheduleRender();
      }
    }
  }

  onDrop(e, creatorsMap) {
    e.preventDefault();
    if (!this.dragType) return;

    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer) {
      this.showNotify({ type: 'warning', message: 'Нет активного слоя для добавления элементов', timeout: 2000 });
      return;
    }
    if (activeLayer.locked) {
      this.showNotify({ type: 'warning', message: 'Активный слой заблокирован!', timeout: 2000 });
      return;
    }

    const worldPos = this.renderer?.screenToWorld(e.clientX, e.clientY);
    if (worldPos) {
      const newId = this.layerManager.getNextElementId();
      const creator = creatorsMap[this.dragType];
      if (!creator) return;

      const el = creator(newId, worldPos.x, worldPos.y);
      el.updatePorts?.();
      el.updateCalloutText?.();

      if (el.showCallout !== false) {
        const topLeft = el.getTopLeft();
        el.addCallout(el.x, topLeft.y - 50);
        el.updateCalloutText();
      }

      activeLayer.elements.push(el);
      this.updateSelectionCallback([el]);
      this.scheduleRender();
    }
    this.ghostElement = null;
    this.dragType = null;
    this.renderer?.clearGhostElement();
    this.scheduleRender();
  }
}
