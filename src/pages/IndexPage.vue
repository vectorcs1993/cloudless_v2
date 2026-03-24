<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <!-- Тулбар -->
    <div class="toolbar">
      <button class="theme-toggle" @click="toggleTheme">
        {{ isDarkTheme ? '☀️' : '🌙' }}
      </button>
      <h3>Редактор воздуховодов</h3>

      <div class="scale-settings">
        <label>Масштаб:
          <input type="number" v-model.number="pixelsPerMeter" step="10" min="20" max="200" />
          px/м
        </label>

        <div class="view-controls">
          <label><input type="checkbox" v-model="showGrid" /> Сетка</label>
          <label><input type="checkbox" v-model="showPorts" /> Показать порты</label>
          <label><input type="checkbox" v-model="snapToPorts" /> Привязка к портам</label>
        </div>
      </div>

      <!-- Панель добавления элементов -->
      <div class="add-element-panel">
        <button @click="addDuctDirect" class="add-btn">➕ Прямой воздуховод</button>
        <button @click="addFan" class="add-btn">🌀 Вентилятор</button>
        <button @click="addTee" class="add-btn">🔀 Тройник</button>
      </div>

      <!-- Кнопки управления сохранением -->
      <div class="save-controls">
        <button @click="saveToLocalStorage" class="save-btn">💾 Сохранить</button>
        <button @click="resetToDefault" class="reset-btn">↺ Сброс</button>
      </div>

      <!-- Информация о выбранном элементе -->
      <div v-if="selectedElement" class="selected-info">
        <h4>Выбран элемент:</h4>
        <p>{{ selectedElement.name }}</p>
        <p>Тип: {{ selectedElement.getTypeName() }}</p>
        <p>Позиция: ({{ Math.round(selectedElement.x) }}, {{ Math.round(selectedElement.y) }})</p>
        <p>Поворот: {{ selectedElement.rotation || 0 }}°</p>

        <div v-if="selectedElement.getParameters().length > 0" class="element-params">
          <div v-for="param in selectedElement.getParameters()" :key="param.name" class="param-field">
            <label>{{ param.label }}:
              <input :type="param.type" v-model.number="selectedElement[param.name]" :step="param.step" :min="param.min"
                @change="onParameterChange" />
              <span v-if="param.unit">{{ param.unit }}</span>
            </label>
          </div>
        </div>

        <div v-if="selectedElement.ports && selectedElement.ports.some(p => p.isConnected())">
          <h5>Связи:</h5>
          <div v-for="port in selectedElement.ports.filter(p => p.isConnected())" :key="port.id"
            class="connection-info">
            Порт {{ port.side }} ({{ port.getDirectionName() }}) → Элемент {{ getElementName(port.connectedElementId) }}
          </div>
        </div>

        <div class="rotation-controls">
          <button @click="rotateLeft" class="rotate-btn">↺ 90°</button>
          <button @click="rotateRight" class="rotate-btn">↻ 90°</button>
        </div>

        <div class="layer-controls">
          <button @click="moveToTop" class="layer-btn">⬆️ Вверх</button>
          <button @click="moveToBottom" class="layer-btn">⬇️ Вниз</button>
          <button @click="moveUp" class="layer-btn">⬆️ Выше</button>
          <button @click="moveDown" class="layer-btn">⬇️ Ниже</button>
        </div>

        <button @click="deleteSelected" class="delete-btn">Удалить</button>
      </div>
    </div>

    <canvas ref="mainCanvas" class="main-canvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp" @wheel.prevent="onWheel">
    </canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// ========== КЛАСС ПОРТА ==========
class Port {
  constructor(id, elementId, direction, side, localX, localY, worldX, worldY) {
    this.id = id;
    this.elementId = elementId;
    this.direction = direction;
    this.side = side;
    this.localX = localX;
    this.localY = localY;
    this.worldX = worldX;
    this.worldY = worldY;
    this.connectedElementId = null;
    this.connectedPortId = null;
  }

  isConnected() {
    return this.connectedElementId !== null;
  }

  disconnect() {
    this.connectedElementId = null;
    this.connectedPortId = null;
  }

  connectTo(port) {
    this.connectedElementId = port.elementId;
    this.connectedPortId = port.id;
  }

  getDirectionName() {
    const directions = { 'inlet': 'Вход', 'outlet': 'Выход', 'branch': 'Ответвление' };
    return directions[this.direction] || this.direction;
  }

  updateWorldPosition(centerX, centerY, rotation, pointX, pointY) {
    const angleRad = rotation * Math.PI / 180;
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    this.worldX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX;
    this.worldY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY;
  }

  toJSON() {
    return {
      id: this.id,
      elementId: this.elementId,
      direction: this.direction,
      side: this.side,
      localX: this.localX,
      localY: this.localY,
      worldX: this.worldX,
      worldY: this.worldY,
      connectedElementId: this.connectedElementId,
      connectedPortId: this.connectedPortId
    };
  }
}

// ========== БАЗОВЫЙ КЛАСС ЭЛЕМЕНТА ==========
class BaseElement {
  constructor(id, type, x, y, name, color) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.name = name;
    this.color = color;
    this.rotation = 0;
    this.ports = [];
  }

  static getAvailableTypes() {
    return { 'duct': 'Прямой воздуховод', 'fan': 'Вентилятор', 'tee': 'Тройник' };
  }

  getTypeName() {
    const types = BaseElement.getAvailableTypes();
    return types[this.type] || this.type;
  }

  getPorts() { throw new Error('Метод getPorts должен быть переопределен'); }
  draw(ctx, scale, isSelected) { throw new Error('Метод draw должен быть переопределен'); }
  hitTest(worldX, worldY) { throw new Error('Метод hitTest должен быть переопределен'); }
  getParameters() { return []; }

  updatePorts() {
    const oldPorts = this.ports;
    const newPorts = this.getPorts();
    newPorts.forEach(newPort => {
      const oldPort = oldPorts.find(p => p.direction === newPort.direction);
      if (oldPort) {
        newPort.id = oldPort.id;
        newPort.connectedElementId = oldPort.connectedElementId;
        newPort.connectedPortId = oldPort.connectedPortId;
      }
    });
    this.ports = newPorts;
  }

  toJSON() {
    return {
      id: this.id, type: this.type, x: this.x, y: this.y, name: this.name,
      color: this.color, rotation: this.rotation, ports: this.ports.map(p => p.toJSON())
    };
  }

  rotatePoint(x, y, centerX, centerY, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX,
      y: dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY
    };
  }
}

// ========== КЛАСС ВОЗДУХОВОДА ==========
class DuctDirect extends BaseElement {
  constructor(id, x, y, length = 200, width = 100) {
    super(id, 'duct', x, y, `Воздуховод ${id}`, '#2196f3');
    this.length = length;
    this.width = width;
  }

  getParameters() {
    return [
      { name: 'length', label: 'Длина', type: 'number', step: 50, min: 100, value: this.length },
      { name: 'width', label: 'Ширина', type: 'number', step: 50, min: 50, value: this.width }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.width / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this.length, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.length, this.width / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    if (isSelected) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(this.x, this.y, this.length, this.width);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.strokeRect(this.x, this.y, this.length, this.width);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.length, this.width);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(this.x, this.y, this.length, this.width);
    }

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, 14 / scale)}px Arial`;
    ctx.fillText('→', this.x + this.length / 2 - 5 / scale, centerY + 5 / scale);
    ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
    ctx.font = `${Math.max(8, 12 / scale)}px Arial`;
    ctx.fillText(this.name, this.x + 5, this.y + 20 / scale);
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const rotation = this.rotation || 0;
    if (rotation === 0 || rotation === 180) {
      return worldX >= this.x && worldX <= this.x + this.length &&
        worldY >= this.y && worldY <= this.y + this.width;
    }
    const centerX = this.x + this.length / 2;
    const centerY = this.y + this.width / 2;
    let dx = worldX - centerX;
    let dy = worldY - centerY;
    const angle = -rotation * Math.PI / 180;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + centerX;
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + centerY;
    return localX >= this.x && localX <= this.x + this.length &&
      localY >= this.y && localY <= this.y + this.width;
  }

  toJSON() {
    return { ...super.toJSON(), length: this.length, width: this.width };
  }
}

// ========== КЛАСС ВЕНТИЛЯТОРА ==========
class Fan extends BaseElement {
  constructor(id, x, y, diameter = 120) {
    super(id, 'fan', x, y, `Вентилятор ${id}`, '#ff9800');
    this.diameter = diameter;
    this.flow = 1000;
  }

  getParameters() {
    return [
      { name: 'diameter', label: 'Диаметр', type: 'number', step: 50, min: 100, value: this.diameter },
      { name: 'flow', label: 'Производительность', type: 'number', step: 100, value: this.flow, unit: 'м³/ч' }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.diameter / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this.diameter, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.diameter, this.diameter / 2, outletPos.x, outletPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;
    const radius = this.diameter / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    if (isSelected) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }

    for (let i = 0; i < 3; i++) {
      const angle = (i * 120) * Math.PI / 180;
      const x1 = centerX + Math.cos(angle) * radius * 0.3;
      const y1 = centerY + Math.sin(angle) * radius * 0.3;
      const x2 = centerX + Math.cos(angle + 0.5) * radius;
      const y2 = centerY + Math.sin(angle + 0.5) * radius;
      const x3 = centerX + Math.cos(angle - 0.5) * radius;
      const y3 = centerY + Math.sin(angle - 0.5) * radius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
    ctx.font = `${Math.max(8, 12 / scale)}px Arial`;
    ctx.fillText(this.name, this.x + 5, this.y + 20 / scale);
    ctx.font = `${Math.max(6, 10 / scale)}px Arial`;
    ctx.fillText(`${this.flow} м³/ч`, this.x + 5, this.y + 35 / scale);
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const centerX = this.x + this.diameter / 2;
    const centerY = this.y + this.diameter / 2;
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.diameter / 2;
  }

  toJSON() {
    return { ...super.toJSON(), diameter: this.diameter, flow: this.flow };
  }
}

// ========== КЛАСС ТРОЙНИКА ==========
class Tee extends BaseElement {
  constructor(id, x, y, width = 150, height = 150) {
    super(id, 'tee', x, y, `Тройник ${id}`, '#9c27b0');
    this.width = width;
    this.height = height;
  }

  getParameters() {
    return [
      { name: 'width', label: 'Ширина', type: 'number', step: 50, min: 100, value: this.width },
      { name: 'height', label: 'Высота', type: 'number', step: 50, min: 100, value: this.height }
    ];
  }

  getPorts() {
    const ports = [];
    const rotation = this.rotation || 0;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    const inletPos = this.rotatePoint(this.x, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'inlet')?.id || Date.now() + Math.random(),
      this.id, 'inlet', 'left', 0, this.height / 2, inletPos.x, inletPos.y
    ));

    const outletPos = this.rotatePoint(this.x + this.width, centerY, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'outlet')?.id || Date.now() + Math.random(),
      this.id, 'outlet', 'right', this.width, this.height / 2, outletPos.x, outletPos.y
    ));

    const branchPos = this.rotatePoint(this.x + this.width / 2, this.y + this.height, centerX, centerY, rotation);
    ports.push(new Port(
      this.ports.find(p => p.direction === 'branch')?.id || Date.now() + Math.random(),
      this.id, 'branch', 'bottom', this.width / 2, this.height, branchPos.x, branchPos.y
    ));

    return ports;
  }

  draw(ctx, scale, isSelected) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const pipeWidth = Math.min(this.width / 3, this.height / 3);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.beginPath();
    ctx.rect(this.x, centerY - pipeWidth / 2, this.width, pipeWidth);
    ctx.rect(centerX - pipeWidth / 2, this.y + this.height / 2, pipeWidth, this.height / 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff0000' : '#666';
    ctx.lineWidth = isSelected ? Math.max(1, 2 / scale) : (1 / scale);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(12, 16 / scale)}px Arial`;
    ctx.fillText('T', centerX - 4 / scale, centerY + 4 / scale);
    ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
    ctx.font = `${Math.max(8, 12 / scale)}px Arial`;
    ctx.fillText(this.name, this.x + 5, this.y + 20 / scale);
    ctx.restore();
  }

  hitTest(worldX, worldY) {
    const rotation = this.rotation || 0;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const pipeWidth = Math.min(this.width / 3, this.height / 3);

    if (rotation === 0 || rotation === 180) {
      const inHorizontal = worldX >= this.x && worldX <= this.x + this.width &&
        worldY >= centerY - pipeWidth / 2 && worldY <= centerY + pipeWidth / 2;
      const inVertical = worldX >= centerX - pipeWidth / 2 && worldX <= centerX + pipeWidth / 2 &&
        worldY >= this.y + this.height / 2 && worldY <= this.y + this.height;
      return inHorizontal || inVertical;
    }

    let dx = worldX - centerX;
    let dy = worldY - centerY;
    const angle = -rotation * Math.PI / 180;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + centerX;
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + centerY;
    const inHorizontal = localX >= this.x && localX <= this.x + this.width &&
      localY >= centerY - pipeWidth / 2 && localY <= centerY + pipeWidth / 2;
    const inVertical = localX >= centerX - pipeWidth / 2 && localX <= centerX + pipeWidth / 2 &&
      localY >= this.y + this.height / 2 && localY <= this.y + this.height;
    return inHorizontal || inVertical;
  }

  toJSON() {
    return { ...super.toJSON(), width: this.width, height: this.height };
  }
}

// ========== КЛАСС МЕНЕДЖЕРА СОЕДИНЕНИЙ ==========
class ConnectionManager {
  constructor(elements) {
    this.elements = elements;
  }

  connectPorts(port1, port2) {
    if (!port1 || !port2) return false;
    port1.connectTo(port2);
    port2.connectTo(port1);
    return true;
  }

  disconnectPorts(port1, port2) {
    if (port1) port1.disconnect();
    if (port2) port2.disconnect();
  }

  disconnectElement(element) {
    if (!element.ports) return;
    element.ports.forEach(port => {
      if (port.isConnected()) {
        const connectedElement = this.elements.value.find(el => el.id === port.connectedElementId);
        if (connectedElement?.ports) {
          const connectedPort = connectedElement.ports.find(p => p.id === port.connectedPortId);
          if (connectedPort) connectedPort.disconnect();
        }
        port.disconnect();
      }
    });
  }

  findClosestPorts(movingElement, maxDistance = 40) {
    if (typeof movingElement.getPorts !== 'function') return null;
    const movingPorts = movingElement.getPorts();
    const allPorts = this.getAllPorts().filter(p => p.elementId !== movingElement.id);

    let bestMatch = null;
    let minDistance = maxDistance;

    movingPorts.forEach(movingPort => {
      allPorts.forEach(targetPort => {
        const distance = Math.hypot(movingPort.worldX - targetPort.worldX, movingPort.worldY - targetPort.worldY);
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = { movingPort, targetPort, distance };
        }
      });
    });
    return bestMatch;
  }

  getAllPorts() {
    const ports = [];
    this.elements.value.forEach(element => {
      if (element.ports) ports.push(...element.ports);
    });
    return ports;
  }
}

// ========== КЛАСС РЕНДЕРЕРА ==========
class CanvasRenderer {
  constructor(canvas, elements, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.elements = elements;
    this.options = options;
    this.selectedElement = null;
    this.highlightedPort = null;
  }

  setSelectedElement(element) {
    this.selectedElement = element;
  }

  setHighlightedPort(port) {
    this.highlightedPort = port;
  }

  draw() {
    if (!this.ctx) return;
    this.updateCanvasSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.options.panX.value, this.options.panY.value);
    this.ctx.scale(this.options.scale.value, this.options.scale.value);

    this.drawGrid();
    this.drawAxes();
    this.drawElements();
    this.drawPorts();

    this.ctx.restore();
    this.drawInfo();
  }

  updateCanvasSize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  drawGrid() {
    if (!this.options.showGrid.value) return;
    const step = this.options.gridStepM.value * this.options.pixelsPerMeter.value;
    if (step <= 5) return;
    const startX = Math.floor(-this.options.panX.value / this.options.scale.value / step) * step;
    const startY = Math.floor(-this.options.panY.value / this.options.scale.value / step) * step;
    const endX = startX + this.canvas.width / this.options.scale.value + step;
    const endY = startY + this.canvas.height / this.options.scale.value + step;

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.isDarkTheme.value ? '#444' : '#ddd';
    this.ctx.lineWidth = 0.5 / this.options.scale.value;
    for (let x = startX; x < endX; x += step) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += step) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
  }

  drawAxes() {
    const startX = -this.options.panX.value / this.options.scale.value;
    const startY = -this.options.panY.value / this.options.scale.value;
    const endX = startX + this.canvas.width / this.options.scale.value;
    const endY = startY + this.canvas.height / this.options.scale.value;

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.lineWidth = Math.max(1, 1.5 / this.options.scale.value);
    this.ctx.moveTo(startX, 0);
    this.ctx.lineTo(endX, 0);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(0, startY);
    this.ctx.lineTo(0, endY);
    this.ctx.stroke();

    const arrowSize = 8 / this.options.scale.value;
    this.ctx.beginPath();
    this.ctx.moveTo(endX, 0);
    this.ctx.lineTo(endX - arrowSize, -arrowSize / 2);
    this.ctx.lineTo(endX - arrowSize, arrowSize / 2);
    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(0, endY);
    this.ctx.lineTo(-arrowSize / 2, endY - arrowSize);
    this.ctx.lineTo(arrowSize / 2, endY - arrowSize);
    this.ctx.fill();

    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#888' : '#666';
    this.ctx.font = `${Math.max(10, 12 / this.options.scale.value)}px Arial`;
    this.ctx.fillText('X', endX - 15 / this.options.scale.value, -5 / this.options.scale.value);
    this.ctx.fillText('Y', 5 / this.options.scale.value, endY - 5 / this.options.scale.value);
  }

  drawElements() {
    this.elements.value.forEach(element => {
      element.draw(this.ctx, this.options.scale.value, this.selectedElement?.id === element.id);
    });
  }

  drawPorts() {
    if (!this.options.showPorts.value) return;
    const allPorts = [];
    this.elements.value.forEach(el => { if (el.ports) allPorts.push(...el.ports); });

    allPorts.forEach(port => {
      const isHighlighted = this.highlightedPort?.id === port.id;
      const isConnected = port.isConnected();

      this.ctx.save();
      if (isHighlighted) {
        this.ctx.fillStyle = '#ff6600';
        this.ctx.shadowBlur = 12 / this.options.scale.value;
        this.ctx.shadowColor = '#ff6600';
      } else if (isConnected) {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.shadowBlur = 8 / this.options.scale.value;
        this.ctx.shadowColor = '#ffaa00';
      } else {
        this.ctx.fillStyle = '#00ff00';
        this.ctx.shadowBlur = 0;
      }
      const portSize = 5 / this.options.scale.value;
      this.ctx.beginPath();
      this.ctx.arc(port.worldX, port.worldY, portSize, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1 / this.options.scale.value;
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  drawInfo() {
    this.ctx.fillStyle = this.options.isDarkTheme.value ? '#fff' : '#000';
    this.ctx.font = '14px Arial';
    this.ctx.fillText('Масштаб: ' + this.options.scale.value.toFixed(2) + 'x', 50, 50);
    if (this.options.mouseWorldPos?.value) {
      this.ctx.fillText('X, Y: ' + this.options.mouseWorldPos.value.x.toFixed(2) + ', ' +
        this.options.mouseWorldPos.value.y.toFixed(2), 50, 70);
    }
    if (this.highlightedPort) {
      this.ctx.fillStyle = '#00ff00';
      this.ctx.fillText('Порт: ' + this.highlightedPort.side + ' (' +
        this.highlightedPort.getDirectionName() + ')', 50, 110);
    }
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.options.panX.value) / this.options.scale.value,
      y: (screenY - rect.top - this.options.panY.value) / this.options.scale.value
    };
  }
}

// ========== КЛАСС МЕНЕДЖЕРА ВЗАИМОДЕЙСТВИЙ ==========
class InteractionManager {
  constructor(canvas, elements, renderer, connectionManager, options) {
    this.canvas = canvas;
    this.elements = elements;
    this.renderer = renderer;
    this.connectionManager = connectionManager;
    this.options = options;

    this.isDragging = false;
    this.isPanning = false;
    this.draggingElement = null;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartPan = { x: 0, y: 0 };
    this.dragStartElementPos = { x: 0, y: 0 };
    this.wasSnapped = false;
    this.currentSnappedPorts = null;
  }

  findElementAt(x, y) {
    for (let i = this.elements.value.length - 1; i >= 0; i--) {
      if (this.elements.value[i].hitTest(x, y)) {
        return this.elements.value[i];
      }
    }
    return null;
  }

  onMouseDown(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (e.button === 0) {
      const clickedElement = this.findElementAt(worldPos.x, worldPos.y);
      if (clickedElement) {
        this.startDrag(clickedElement, e);
      } else {
        this.renderer.setSelectedElement(null);
        this.renderer.draw();
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.startPan(e);
    }
  }

  startDrag(element, e) {
    this.isDragging = true;
    this.draggingElement = element;
    this.renderer.setSelectedElement(element); // Добавьте эту строку
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragStartElementPos = { x: element.x, y: element.y };
    this.wasSnapped = element.ports?.some(p => p.isConnected()) || false;

    if (this.wasSnapped) {
      const connectedPort = element.ports.find(p => p.isConnected());
      if (connectedPort) {
        const targetElement = this.elements.value.find(el => el.id === connectedPort.connectedElementId);
        if (targetElement) {
          const targetPort = targetElement.ports.find(p => p.id === connectedPort.connectedPortId);
          if (targetPort) {
            this.currentSnappedPorts = { movingPort: connectedPort, targetPort };
          }
        }
      }
    }
    this.canvas.style.cursor = 'grabbing';
    this.renderer.draw();
  }

  startPan(e) {
    this.isPanning = true;
    this.dragStartMouse = { x: e.clientX, y: e.clientY };
    this.dragStartPan = { x: this.options.panX.value, y: this.options.panY.value };
    this.canvas.style.cursor = 'grabbing';
  }

  onMouseMove(e) {
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (this.options.showPorts.value && !this.isDragging) {
      const portUnderCursor = this.findPortAtPosition(worldPos.x, worldPos.y);
      this.renderer.setHighlightedPort(portUnderCursor);
      this.canvas.style.cursor = portUnderCursor ? 'pointer' : 'default';
    } else if (!this.isDragging) {
      this.renderer.setHighlightedPort(null);
    }

    if (this.isDragging && this.draggingElement) {
      const startWorldPos = this.renderer.screenToWorld(this.dragStartMouse.x, this.dragStartMouse.y);
      const deltaX = worldPos.x - startWorldPos.x;
      const deltaY = worldPos.y - startWorldPos.y;
      this.applyPortSnapping(deltaX, deltaY);
      this.renderer.draw();
    } else if (this.isPanning) {
      this.options.panX.value = this.dragStartPan.x + (e.clientX - this.dragStartMouse.x);
      this.options.panY.value = this.dragStartPan.y + (e.clientY - this.dragStartMouse.y);
      this.renderer.draw();
    }
  }

  applyPortSnapping(deltaX, deltaY) {
    if (!this.options.snapToPorts.value) {
      this.draggingElement.x = this.dragStartElementPos.x + deltaX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY;
      return;
    }

    const tempX = this.dragStartElementPos.x + deltaX;
    const tempY = this.dragStartElementPos.y + deltaY;
    let tempElement;

    switch (this.draggingElement.type) {
      case 'duct':
        tempElement = new DuctDirect(this.draggingElement.id, tempX, tempY,
          this.draggingElement.length, this.draggingElement.width);
        break;
      case 'fan':
        tempElement = new Fan(this.draggingElement.id, tempX, tempY, this.draggingElement.diameter);
        tempElement.flow = this.draggingElement.flow;
        break;
      case 'tee':
        tempElement = new Tee(this.draggingElement.id, tempX, tempY,
          this.draggingElement.width, this.draggingElement.height);
        break;
      default:
        tempElement = { ...this.draggingElement, x: tempX, y: tempY };
    }
    tempElement.rotation = this.draggingElement.rotation || 0;

    const closestPortsPair = this.connectionManager.findClosestPorts(tempElement, 40);

    if (closestPortsPair && closestPortsPair.distance < 40) {
      if (this.wasSnapped && this.currentSnappedPorts) {
        this.connectionManager.disconnectPorts(this.currentSnappedPorts.movingPort, this.currentSnappedPorts.targetPort);
        this.wasSnapped = false;
        this.currentSnappedPorts = null;
      }

      const offsetX = closestPortsPair.targetPort.worldX - closestPortsPair.movingPort.worldX;
      const offsetY = closestPortsPair.targetPort.worldY - closestPortsPair.movingPort.worldY;
      this.draggingElement.x = this.dragStartElementPos.x + deltaX + offsetX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY + offsetY;
      this.draggingElement.updatePorts();

      const updatedMovingPort = this.draggingElement.ports.find(p => p.direction === closestPortsPair.movingPort.direction);
      const updatedTargetPort = this.elements.value
        .find(el => el.id === closestPortsPair.targetPort.elementId)
        ?.ports.find(p => p.id === closestPortsPair.targetPort.id);

      if (updatedMovingPort && updatedTargetPort) {
        this.connectionManager.connectPorts(updatedMovingPort, updatedTargetPort);
        this.currentSnappedPorts = { movingPort: updatedMovingPort, targetPort: updatedTargetPort };
        this.wasSnapped = true;
      }
      this.renderer.setHighlightedPort(updatedTargetPort);
    } else {
      if (this.wasSnapped && this.currentSnappedPorts) {
        this.connectionManager.disconnectPorts(this.currentSnappedPorts.movingPort, this.currentSnappedPorts.targetPort);
        this.wasSnapped = false;
        this.currentSnappedPorts = null;
      }
      this.draggingElement.x = this.dragStartElementPos.x + deltaX;
      this.draggingElement.y = this.dragStartElementPos.y + deltaY;
      this.draggingElement.updatePorts();
      this.renderer.setHighlightedPort(null);
    }
  }

  findPortAtPosition(worldX, worldY, maxDistance = 15) {
    const allPorts = this.connectionManager.getAllPorts();
    for (const port of allPorts) {
      const distance = Math.hypot(port.worldX - worldX, port.worldY - worldY);
      if (distance < maxDistance) return port;
    }
    return null;
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggingElement = null;
      this.wasSnapped = false;
      this.currentSnappedPorts = null;
      this.canvas.style.cursor = '';
      this.renderer.draw();
    }
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = '';
      this.renderer.draw();
    }
    setTimeout(() => {
      if (!this.isDragging) this.renderer.setHighlightedPort(null);
      this.renderer.draw();
    }, 100);
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    const worldBefore = this.renderer.screenToWorld(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(this.options.scale.value * delta, 0.2), 5);

    if (newScale !== this.options.scale.value) {
      this.options.scale.value = newScale;
      const worldAfter = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.options.panX.value += (worldAfter.x - worldBefore.x) * this.options.scale.value;
      this.options.panY.value += (worldAfter.y - worldBefore.y) * this.options.scale.value;
      this.renderer.draw();
    }
  }
}

// ========== КЛАСС ФАБРИКИ ЭЛЕМЕНТОВ ==========
class ElementFactory {
  static createElement(type, id, x, y, params = {}) {
    switch (type) {
      case 'duct': return new DuctDirect(id, x, y, params.length || 200, params.width || 100);
      case 'fan': return new Fan(id, x, y, params.diameter || 120);
      case 'tee': return new Tee(id, x, y, params.width || 150, params.height || 150);
      default: throw new Error(`Unknown element type: ${type}`);
    }
  }

  static createFromJSON(jsonData) {
    const element = this.createElement(jsonData.type, jsonData.id, jsonData.x, jsonData.y, jsonData);
    element.name = jsonData.name;
    element.color = jsonData.color;
    element.rotation = jsonData.rotation || 0;
    element.ports = jsonData.ports?.map(p => new Port(
      p.id, p.elementId, p.direction, p.side, p.localX, p.localY, p.worldX, p.worldY
    )) || [];
    element.ports.forEach(port => {
      port.connectedElementId = jsonData.ports?.find(op => op.id === port.id)?.connectedElementId || null;
      port.connectedPortId = jsonData.ports?.find(op => op.id === port.id)?.connectedPortId || null;
    });
    return element;
  }
}

// ========== КЛАСС МЕНЕДЖЕРА ХРАНЕНИЯ ==========
class StorageManager {
  constructor(key) {
    this.key = key;
  }

  save(elements, nextElementId, nextPortId) {
    const data = {
      elements: elements.map(el => el.toJSON()),
      nextElementId,
      nextPortId,
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

// ========== КЛАСС УПРАВЛЕНИЯ СЛОЯМИ ==========
class LayerManager {
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

// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
// Состояние
const isDarkTheme = ref(false);
const pixelsPerMeter = ref(50);
const showGrid = ref(true);
const showPorts = ref(true);
const snapToPorts = ref(true);
const gridStepM = ref(1);

// Canvas
const mainCanvas = ref(null);
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let layerManager = null;
let storageManager = null;

// Данные
const elements = ref([]);
const selectedElement = ref(null);
const mouseWorldPos = ref(null);
let nextElementId = 100;
let nextPortId = 1000;

// Параметры для рендерера
const renderOptions = {
  scale: ref(1),
  panX: ref(0),
  panY: ref(0),
  showGrid,
  showPorts,
  pixelsPerMeter,
  gridStepM,
  isDarkTheme,
  mouseWorldPos
};

// Стандартные элементы
const defaultElements = [
  new DuctDirect(1, 200, 200, 200, 100),
  new Fan(2, 500, 250, 120),
  new Tee(3, 350, 450, 150, 150)
];

// ========== Функции ==========
const saveToLocalStorage = () => {
  storageManager.save(elements.value, nextElementId, nextPortId);
  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Сохранено!';
    setTimeout(() => { if (saveBtn) saveBtn.textContent = originalText; }, 1000);
  }
};

const loadFromLocalStorage = () => {
  const data = storageManager.load();
  if (!data) {
    resetToDefault();
    return;
  }
  try {
    elements.value = data.elements.map(json => ElementFactory.createFromJSON(json));
    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;
    elements.value.forEach(el => el.updatePorts());
    selectedElement.value = null;
    renderer?.setSelectedElement(null);
    renderer?.draw();
  } catch (error) {
    console.error('Error loading data:', error);
    resetToDefault();
  }
};

const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    elements.value = defaultElements.map(el => {
      if (el.type === 'duct') return new DuctDirect(el.id, el.x, el.y, el.length, el.width);
      if (el.type === 'fan') return new Fan(el.id, el.x, el.y, el.diameter);
      return new Tee(el.id, el.x, el.y, el.width, el.height);
    });
    nextElementId = 100;
    nextPortId = 1000;
    selectedElement.value = null;
    renderer?.setSelectedElement(null); // Добавьте эту строку
    elements.value.forEach(el => el.updatePorts());
    renderer?.draw();
  }
};

const addElement = (ElementClass, params = {}) => {
  const newId = ++nextElementId;
  const newElement = new ElementClass(newId, 100, 100, ...Object.values(params));
  elements.value.push(newElement);
  newElement.updatePorts();
  selectedElement.value = newElement;
  renderer?.setSelectedElement(newElement); // Добавьте эту строку
  renderer?.draw();
};

const addDuctDirect = () => addElement(DuctDirect, [200, 100]);
const addFan = () => addElement(Fan, [120]);
const addTee = () => addElement(Tee, [150, 150]);

const onParameterChange = () => {
  if (selectedElement.value) {
    selectedElement.value.updatePorts();
    renderer?.draw();
  }
};

const rotateLeft = () => {
  if (!selectedElement.value) return;
  connectionManager.disconnectElement(selectedElement.value);
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) - 90 + 360) % 360;
  selectedElement.value.updatePorts();
  renderer?.draw();
};

const rotateRight = () => {
  if (!selectedElement.value) return;
  connectionManager.disconnectElement(selectedElement.value);
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) + 90) % 360;
  selectedElement.value.updatePorts();
  renderer?.draw();
};

const moveToTop = () => layerManager?.moveToTop(selectedElement.value);
const moveToBottom = () => layerManager?.moveToBottom(selectedElement.value);
const moveUp = () => layerManager?.moveUp(selectedElement.value);
const moveDown = () => layerManager?.moveDown(selectedElement.value);

const deleteSelected = () => {
  if (selectedElement.value) {
    connectionManager.disconnectElement(selectedElement.value);
    const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
      selectedElement.value = null;
      renderer?.setSelectedElement(null); // Добавьте эту строку
      renderer?.draw();
    }
  }
};

const getElementName = (elementId) => {
  const element = elements.value.find(el => el.id === elementId);
  return element ? element.name : `ID:${elementId}`;
};

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('theme', isDarkTheme.value ? 'dark' : 'light');
  renderer?.draw();
};

// Обработчики событий canvas
const onCanvasMouseDown = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);

  if (e.button === 0) {
    const clickedElement = interactionManager?.findElementAt(worldPos.x, worldPos.y);
    if (clickedElement) {
      selectedElement.value = clickedElement;
      renderer?.setSelectedElement(clickedElement); // Добавьте эту строку
      interactionManager?.onMouseDown(e);
    } else {
      selectedElement.value = null;
      renderer?.setSelectedElement(null); // Добавьте эту строку
      renderer?.draw();
    }
  } else {
    interactionManager?.onMouseDown(e);
  }
};
const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;
  interactionManager?.onMouseMove(e);
};
const onCanvasMouseUp = (e) => interactionManager?.onMouseUp(e);
const onWheel = (e) => interactionManager?.onWheel(e);

// Инициализация
onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') isDarkTheme.value = true;

  storageManager = new StorageManager('hvac_editor_data');
  connectionManager = new ConnectionManager(elements);
  renderer = new CanvasRenderer(mainCanvas.value, elements, renderOptions);
  interactionManager = new InteractionManager(mainCanvas.value, elements, renderer, connectionManager, {
    snapToPorts, showPorts, panX: renderOptions.panX, panY: renderOptions.panY, scale: renderOptions.scale
  });
  layerManager = new LayerManager(elements, renderer);

  loadFromLocalStorage();

  const resizeObserver = new ResizeObserver(() => renderer?.draw());
  resizeObserver.observe(mainCanvas.value);

  renderer.draw();
});
</script>
