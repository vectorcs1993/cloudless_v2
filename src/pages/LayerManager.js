// ========== КЛАСС УПРАВЛЕНИЯ СЛОЯМИ ==========
export class LayerManager {
  constructor(elements, renderer) {
    this.elements = elements;
    this.renderer = renderer;
  }

  moveToTop(element) {
    const index = this.elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      const el = this.elements.value.splice(index, 1)[0];
      this.elements.value.push(el);
      this.renderer.draw();
    }
  }

  moveToBottom(element) {
    const index = this.elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      const el = this.elements.value.splice(index, 1)[0];
      this.elements.value.unshift(el);
      this.renderer.draw();
    }
  }

  moveUp(element) {
    const index = this.elements.value.findIndex(el => el.id === element.id);
    if (index !== -1 && index < this.elements.value.length - 1) {
      [this.elements.value[index], this.elements.value[index + 1]] =
        [this.elements.value[index + 1], this.elements.value[index]];
      this.renderer.draw();
    }
  }

  moveDown(element) {
    const index = this.elements.value.findIndex(el => el.id === element.id);
    if (index !== -1 && index > 0) {
      [this.elements.value[index], this.elements.value[index - 1]] =
        [this.elements.value[index - 1], this.elements.value[index]];
      this.renderer.draw();
    }
  }
}
