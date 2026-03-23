<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <!-- Тулбар -->
    <div class="toolbar">
      <button class="theme-toggle" @click="toggleTheme">
        {{ isDarkTheme ? '☀️' : '🌙' }}
      </button>
      <h3>Редактор</h3>

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

      <!-- Информация о выбранном элементе -->
      <div v-if="selectedElement" class="selected-info">
        <h4>Выбран элемент:</h4>
        <p>{{ selectedElement.name }}</p>
        <p>Позиция: ({{ Math.round(selectedElement.x) }}, {{ Math.round(selectedElement.y) }})</p>
        <p>Поворот: {{ selectedElement.rotation || 0 }}°</p>
        {{ selectedElement }}
        <!-- Кнопки поворота -->
        <div class="rotation-controls">
          <button @click="rotateLeft" class="rotate-btn" title="Повернуть влево">↺ 90°</button>
          <button @click="rotateRight" class="rotate-btn" title="Повернуть вправо">↻ 90°</button>
        </div>

        <!-- Кнопки управления слоями -->
        <div class="layer-controls">
          <button @click="moveToTop" class="layer-btn" title="На передний план">⬆️ Вверх</button>
          <button @click="moveToBottom" class="layer-btn" title="На задний план">⬇️ Вниз</button>
          <button @click="moveUp" class="layer-btn" title="Выше на один">⬆️ Выше</button>
          <button @click="moveDown" class="layer-btn" title="Ниже на один">⬇️ Ниже</button>
        </div>

        <button @click="deleteSelected" class="delete-btn">Удалить</button>
      </div>
    </div>

    <!-- Canvas холст -->
    <canvas ref="mainCanvas" class="main-canvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
      @wheel.prevent="onWheel">
    </canvas>
  </div>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';

// Состояние
const isDarkTheme = ref(false);
const pixelsPerMeter = ref(50);
const showGrid = ref(true);
const showPorts = ref(true);
const snapToPorts = ref(true);
const gridStepM = ref(1);

// Canvas
const mainCanvas = ref(null);
let ctx = null;
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);

// Состояния мыши
let isPanning = false;
let isDragging = false;
let dragStartMouse = { x: 0, y: 0 };
let dragStartPan = { x: 0, y: 0 };
let dragStartElementPos = { x: 0, y: 0 };
const mouseWorldPos = ref(null);
const selectedElement = ref(null);
let draggingElement = null;
let highlightedPort = null;
let grabbedPortInfo = null; // Информация о захваченном порте

// Добавляем массив для хранения элементов
const elements = ref([
  { id: 1, type: 'rect', x: 200, y: 200, width: 150, height: 100, color: '#2196f3', name: 'Прямоугольник 1', rotation: 0 },
  { id: 2, type: 'rect', x: 500, y: 300, width: 150, height: 100, color: '#ff9800', name: 'Прямоугольник 2', rotation: 0 },
  { id: 3, type: 'rect', x: 350, y: 450, width: 150, height: 100, color: '#4caf50', name: 'Прямоугольник 3', rotation: 0 }
]);

// ========== Система портов ==========
// Получение портов элемента
const getElementPorts = (element) => {
  const ports = [];
  const portCountPerSide = 1;
  const width = element.width;
  const height = element.height;

  // Верхняя сторона
  for (let i = 0; i < portCountPerSide; i++) {
    const offsetX = (width / (portCountPerSide + 1)) * (i + 1);
    ports.push({
      elementId: element.id,
      side: 'top',
      index: i,
      worldX: element.x + offsetX,
      worldY: element.y,
      localX: offsetX,
      localY: 0
    });
  }

  // Правая сторона
  for (let i = 0; i < portCountPerSide; i++) {
    const offsetY = (height / (portCountPerSide + 1)) * (i + 1);
    ports.push({
      elementId: element.id,
      side: 'right',
      index: i,
      worldX: element.x + width,
      worldY: element.y + offsetY,
      localX: width,
      localY: offsetY
    });
  }

  // Нижняя сторона
  for (let i = 0; i < portCountPerSide; i++) {
    const offsetX = (width / (portCountPerSide + 1)) * (i + 1);
    ports.push({
      elementId: element.id,
      side: 'bottom',
      index: i,
      worldX: element.x + offsetX,
      worldY: element.y + height,
      localX: offsetX,
      localY: height
    });
  }

  // Левая сторона
  for (let i = 0; i < portCountPerSide; i++) {
    const offsetY = (height / (portCountPerSide + 1)) * (i + 1);
    ports.push({
      elementId: element.id,
      side: 'left',
      index: i,
      worldX: element.x,
      worldY: element.y + offsetY,
      localX: 0,
      localY: offsetY
    });
  }

  return ports;
};

// Получение всех портов всех элементов
const getAllPorts = () => {
  const allPorts = [];
  elements.value.forEach(element => {
    allPorts.push(...getElementPorts(element));
  });
  return allPorts;
};

// Поиск ближайшего порта
const findNearestPort = (worldX, worldY, excludeElementId = null, maxDistance = 30) => {
  const allPorts = getAllPorts();
  let nearestPort = null;
  let minDistance = maxDistance;

  allPorts.forEach(port => {
    if (excludeElementId && port.elementId === excludeElementId) return;

    const dx = port.worldX - worldX;
    const dy = port.worldY - worldY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPort = port;
    }
  });

  return nearestPort;
};

// Поиск порта под курсором (увеличенный радиус)
const findPortAtPosition = (worldX, worldY, maxDistance = 15) => {
  const allPorts = getAllPorts();

  for (const port of allPorts) {
    const dx = port.worldX - worldX;
    const dy = port.worldY - worldY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < maxDistance) {
      return port;
    }
  }

  return null;
};

// ========== Управление поворотом ==========
const rotateLeft = () => {
  if (!selectedElement.value) return;
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) - 90 + 360) % 360;
  draw();
};

const rotateRight = () => {
  if (!selectedElement.value) return;
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) + 90) % 360;
  draw();
};

// ========== Управление слоями ==========
const moveToTop = () => {
  if (!selectedElement.value) return;
  const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
  if (index !== -1) {
    const element = elements.value.splice(index, 1)[0];
    elements.value.push(element);
    draw();
  }
};

const moveToBottom = () => {
  if (!selectedElement.value) return;
  const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
  if (index !== -1) {
    const element = elements.value.splice(index, 1)[0];
    elements.value.unshift(element);
    draw();
  }
};

const moveUp = () => {
  if (!selectedElement.value) return;
  const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
  if (index !== -1 && index < elements.value.length - 1) {
    const temp = elements.value[index];
    elements.value[index] = elements.value[index + 1];
    elements.value[index + 1] = temp;
    draw();
  }
};

const moveDown = () => {
  if (!selectedElement.value) return;
  const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
  if (index !== -1 && index > 0) {
    const temp = elements.value[index];
    elements.value[index] = elements.value[index - 1];
    elements.value[index - 1] = temp;
    draw();
  }
};

// ========== Вспомогательные ==========
const screenToWorld = (screenX, screenY) => {
  const rect = mainCanvas.value.getBoundingClientRect();
  return {
    x: (screenX - rect.left - panX.value) / scale.value,
    y: (screenY - rect.top - panY.value) / scale.value
  };
};

// ========== Отрисовка ==========
const drawPorts = () => {
  if (!ctx || !showPorts.value) return;

  const allPorts = getAllPorts();

  allPorts.forEach(port => {
    ctx.save();
    ctx.beginPath();

    const portSize = 5 / scale.value;
    ctx.arc(port.worldX, port.worldY, portSize, 0, 2 * Math.PI);

    // Подсветка при наведении
    let isHighlighted = false;

    if (highlightedPort &&
      highlightedPort.elementId === port.elementId &&
      highlightedPort.side === port.side &&
      highlightedPort.index === port.index) {
      isHighlighted = true;
    }

    // Проверка, является ли порт захваченным
    const isGrabbed = grabbedPortInfo &&
      grabbedPortInfo.elementId === port.elementId &&
      grabbedPortInfo.side === port.side &&
      grabbedPortInfo.index === port.index;

    if (isGrabbed) {
      ctx.fillStyle = '#ff6600';
      ctx.shadowBlur = 15 / scale.value;
      ctx.shadowColor = '#ff6600';
      ctx.beginPath();
      ctx.arc(port.worldX, port.worldY, portSize + 2 / scale.value, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ffaa00';
    } else if (isHighlighted) {
      ctx.fillStyle = '#ff00ff';
      ctx.shadowBlur = 12 / scale.value;
      ctx.shadowColor = '#ff00ff';
    } else {
      ctx.fillStyle = '#00ff00';
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(port.worldX, port.worldY, portSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / scale.value;
    ctx.stroke();
    ctx.restore();
  });
};

const drawAxes = () => {
  if (!ctx) return;

  const canvas = mainCanvas.value;
  const startX = -panX.value / scale.value;
  const startY = -panY.value / scale.value;
  const endX = startX + canvas.width / scale.value;
  const endY = startY + canvas.height / scale.value;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = isDarkTheme.value ? '#888' : '#666';
  ctx.lineWidth = Math.max(1, 1.5 / scale.value);
  ctx.moveTo(startX, 0);
  ctx.lineTo(endX, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(0, endY);
  ctx.stroke();

  const arrowSize = 8 / scale.value;
  ctx.beginPath();
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX - arrowSize, -arrowSize / 2);
  ctx.lineTo(endX - arrowSize, arrowSize / 2);
  ctx.fillStyle = isDarkTheme.value ? '#888' : '#666';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, endY);
  ctx.lineTo(-arrowSize / 2, endY - arrowSize);
  ctx.lineTo(arrowSize / 2, endY - arrowSize);
  ctx.fill();

  ctx.fillStyle = isDarkTheme.value ? '#888' : '#666';
  const fontSize = Math.max(10, 12 / scale.value);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillText('X', endX - 15 / scale.value, -5 / scale.value);
  ctx.fillText('Y', 5 / scale.value, endY - 5 / scale.value);

  ctx.restore();
};

const drawGrid = () => {
  if (!ctx || !showGrid.value) return;

  const canvas = mainCanvas.value;
  const step = gridStepM.value * pixelsPerMeter.value;

  if (step <= 5) return;

  const startX = Math.floor(-panX.value / scale.value / step) * step;
  const startY = Math.floor(-panY.value / scale.value / step) * step;
  const endX = startX + canvas.width / scale.value + step;
  const endY = startY + canvas.height / scale.value + step;

  ctx.beginPath();
  ctx.strokeStyle = isDarkTheme.value ? '#444' : '#ddd';
  ctx.lineWidth = 0.5 / scale.value;

  for (let x = startX; x < endX; x += step) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }

  for (let y = startY; y < endY; y += step) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }

  ctx.stroke();
};

const drawShape = (ctx, element, isSelected, scaleValue) => {
  const rotation = element.rotation || 0;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  if (isSelected) {
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(element.x, element.y, element.width, element.height);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = Math.max(1, 2 / scaleValue);
    ctx.strokeRect(element.x, element.y, element.width, element.height);
  } else {
    ctx.fillStyle = element.color;
    ctx.fillRect(element.x, element.y, element.width, element.height);
  }

  ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
  const fontSize = Math.max(8, 12 / scaleValue);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillText(element.name, element.x + 5, element.y + 20);

  const orderIndex = elements.value.findIndex(el => el.id === element.id);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = `${Math.max(8, 10 / scaleValue)}px Arial`;
  ctx.fillText(`#${orderIndex + 1}`, element.x + 5, element.y + 35);

  ctx.restore();

  if (isSelected) {
    drawElementAxes(ctx, element, scaleValue);
  }
};

const drawElementAxes = (ctx, element, scaleValue) => {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const rotation = element.rotation || 0;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  const axisLength = Math.max(element.width, element.height) * 0.6;

  ctx.beginPath();
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = Math.max(1, 2 / scaleValue);
  ctx.moveTo(centerX - axisLength, centerY);
  ctx.lineTo(centerX + axisLength, centerY);
  ctx.stroke();

  const arrowSize = 8 / scaleValue;
  ctx.beginPath();
  ctx.moveTo(centerX + axisLength, centerY);
  ctx.lineTo(centerX + axisLength - arrowSize, centerY - arrowSize / 2);
  ctx.lineTo(centerX + axisLength - arrowSize, centerY + arrowSize / 2);
  ctx.fillStyle = '#ff0000';
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#00ff00';
  ctx.moveTo(centerX, centerY - axisLength);
  ctx.lineTo(centerX, centerY + axisLength);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - axisLength);
  ctx.lineTo(centerX - arrowSize / 2, centerY - axisLength + arrowSize);
  ctx.lineTo(centerX + arrowSize / 2, centerY - axisLength + arrowSize);
  ctx.fillStyle = '#00ff00';
  ctx.fill();

  const fontSize = Math.max(10, 12 / scaleValue);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = '#ff0000';
  ctx.fillText('X', centerX + axisLength + 5 / scaleValue, centerY);
  ctx.fillStyle = '#00ff00';
  ctx.fillText('Y', centerX, centerY - axisLength - 5 / scaleValue);

  ctx.beginPath();
  ctx.arc(centerX, centerY, 4 / scaleValue, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffff00';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, 1 / scaleValue);
  ctx.stroke();

  ctx.restore();
};

const draw = () => {
  if (!ctx || !mainCanvas.value) return;

  const canvas = mainCanvas.value;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX.value, panY.value);
  ctx.scale(scale.value, scale.value);

  drawGrid();
  drawAxes();

  elements.value.forEach(element => {
    drawShape(ctx, element, selectedElement.value?.id === element.id, scale.value);
  });

  drawPorts();

  ctx.restore();

  ctx.fillStyle = isDarkTheme.value ? '#fff' : '#000';
  ctx.font = '14px Arial';
  ctx.fillText('Масштаб: ' + scale.value.toFixed(2) + 'x', 50, 50);
  ctx.fillText('X, Y: ' + mouseWorldPos.value?.x.toFixed(2) + ', ' + mouseWorldPos.value?.y.toFixed(2), 50, 70);

  if (isDragging && draggingElement && grabbedPortInfo) {
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('Режим привязки порта: перетащите к другому порту', 50, 90);
  } else if (isDragging && draggingElement) {
    ctx.fillText('Перемещение', 50, 90);
  }

  if (highlightedPort && !isDragging) {
    ctx.fillStyle = '#00ff00';
    ctx.fillText('Порт: ' + highlightedPort.side + ' сторона', 50, 110);
  }
};

// Функция проверки попадания в элемент (с учетом поворота)
const hitTest = (worldX, worldY) => {
  for (let i = elements.value.length - 1; i >= 0; i--) {
    const element = elements.value[i];

    if (element.type === 'rect') {
      const rotation = element.rotation || 0;

      if (rotation === 0 || rotation === 180) {
        if (worldX >= element.x && worldX <= element.x + element.width &&
          worldY >= element.y && worldY <= element.y + element.height) {
          return element;
        }
      } else {
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        let dx = worldX - centerX;
        let dy = worldY - centerY;
        const angle = -rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + centerX;
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + centerY;

        if (localX >= element.x && localX <= element.x + element.width &&
          localY >= element.y && localY <= element.y + element.height) {
          return element;
        }
      }
    }
  }
  return null;
};

// Обработчик клика
const onCanvasMouseDown = (e) => {
  const worldPos = screenToWorld(e.clientX, e.clientY);

  // Сначала проверяем, не кликнули ли по порту
  const portUnderCursor = findPortAtPosition(worldPos.x, worldPos.y, 15);

  if (e.button === 0) {
    if (portUnderCursor && snapToPorts.value) {
      // Нашли порт - ищем элемент, которому принадлежит порт
      const ownerElement = elements.value.find(el => el.id === portUnderCursor.elementId);
      if (ownerElement) {
        selectedElement.value = ownerElement;
        draggingElement = ownerElement;
        isDragging = true;
        dragStartMouse = { x: e.clientX, y: e.clientY };
        dragStartElementPos = { x: ownerElement.x, y: ownerElement.y };

        // Сохраняем информацию о захваченном порте
        grabbedPortInfo = {
          elementId: ownerElement.id,
          side: portUnderCursor.side,
          index: portUnderCursor.index,
          localX: portUnderCursor.localX,
          localY: portUnderCursor.localY
        };

        mainCanvas.value.style.cursor = 'grabbing';
        draw();
        return;
      }
    }

    // Если не кликнули по порту, проверяем элемент
    const clickedElement = hitTest(worldPos.x, worldPos.y);
    if (clickedElement) {
      selectedElement.value = clickedElement;
      draggingElement = clickedElement;
      isDragging = true;
      dragStartMouse = { x: e.clientX, y: e.clientY };
      dragStartElementPos = { x: clickedElement.x, y: clickedElement.y };
      grabbedPortInfo = null; // Сброс информации о захваченном порте
      mainCanvas.value.style.cursor = 'grabbing';
      draw();
    } else {
      selectedElement.value = null;
      draggingElement = null;
      grabbedPortInfo = null;
      draw();
    }
    return;
  }

  if (e.button === 1) {
    e.preventDefault();
    isPanning = true;
    dragStartMouse = { x: e.clientX, y: e.clientY };
    dragStartPan = { x: panX.value, y: panY.value };
    mainCanvas.value.style.cursor = 'grabbing';
    return;
  }
};

const onCanvasMouseMove = (e) => {
  const worldPos = screenToWorld(e.clientX, e.clientY);

  // Обновляем подсветку порта (только если не в режиме перетаскивания)
  if (showPorts.value && !isDragging) {
    const portUnderCursor = findPortAtPosition(worldPos.x, worldPos.y, 15);
    highlightedPort = portUnderCursor;
    if (portUnderCursor) {
      mainCanvas.value.style.cursor = 'pointer';
    } else {
      mainCanvas.value.style.cursor = 'default';
    }
  } else if (!isDragging) {
    highlightedPort = null;
  }

  if (isDragging && draggingElement) {
    const startWorldPos = screenToWorld(dragStartMouse.x, dragStartMouse.y);
    let deltaX = worldPos.x - startWorldPos.x;
    let deltaY = worldPos.y - startWorldPos.y;

    // Привязка к портам
    if (snapToPorts.value && grabbedPortInfo) {
      // Если захвачен порт, ищем ближайший порт для привязки
      const currentPortWorldPos = {
        x: dragStartElementPos.x + deltaX + grabbedPortInfo.localX,
        y: dragStartElementPos.y + deltaY + grabbedPortInfo.localY
      };

      const nearestPort = findNearestPort(currentPortWorldPos.x, currentPortWorldPos.y, draggingElement.id, 30);

      if (nearestPort) {
        // Привязываем захваченный порт к целевому порту
        const newX = nearestPort.worldX - grabbedPortInfo.localX;
        const newY = nearestPort.worldY - grabbedPortInfo.localY;

        draggingElement.x = newX;
        draggingElement.y = newY;

        // Визуально подсвечиваем целевой порт
        if (!highlightedPort || highlightedPort !== nearestPort) {
          highlightedPort = nearestPort;
        }
      } else {
        // Обычное перемещение без привязки
        draggingElement.x = dragStartElementPos.x + deltaX;
        draggingElement.y = dragStartElementPos.y + deltaY;

        // Если нет ближайшего порта, снимаем подсветку
        if (highlightedPort) {
          highlightedPort = null;
        }
      }
    } else if (snapToPorts.value && !grabbedPortInfo) {
      // Перемещение без захвата порта - проверяем, не нужно ли привязать центр
      const newCenterX = draggingElement.x + draggingElement.width / 2;
      const newCenterY = draggingElement.y + draggingElement.height / 2;
      const nearestPort = findNearestPort(newCenterX, newCenterY, draggingElement.id, 25);

      if (nearestPort) {
        draggingElement.x = nearestPort.worldX - draggingElement.width / 2;
        draggingElement.y = nearestPort.worldY - draggingElement.height / 2;
        highlightedPort = nearestPort;
      } else {
        draggingElement.x = dragStartElementPos.x + deltaX;
        draggingElement.y = dragStartElementPos.y + deltaY;
        highlightedPort = null;
      }
    } else {
      draggingElement.x = dragStartElementPos.x + deltaX;
      draggingElement.y = dragStartElementPos.y + deltaY;
    }

    draw();
    return;
  }

  if (isPanning) {
    panX.value = dragStartPan.x + (e.clientX - dragStartMouse.x);
    panY.value = dragStartPan.y + (e.clientY - dragStartMouse.y);
    draw();
    return;
  }
};

const onCanvasMouseUp = (e) => {
  if (isDragging) {
    isDragging = false;
    if (draggingElement) {
      draggingElement = null;
    }
    grabbedPortInfo = null;
    mainCanvas.value.style.cursor = '';
    draw();
  }

  if (isPanning) {
    isPanning = false;
    mainCanvas.value.style.cursor = '';
    draw();
  }

  setTimeout(() => {
    if (!isDragging) {
      highlightedPort = null;
      draw();
    }
  }, 100);
};

const onWheel = (e) => {
  e.preventDefault();

  const worldBefore = screenToWorld(e.clientX, e.clientY);

  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(Math.max(scale.value * delta, 0.2), 5);

  if (newScale !== scale.value) {
    scale.value = newScale;
    const worldAfter = screenToWorld(e.clientX, e.clientY);
    panX.value += (worldAfter.x - worldBefore.x) * scale.value;
    panY.value += (worldAfter.y - worldBefore.y) * scale.value;
    draw();
  }
};

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('theme', isDarkTheme.value ? 'dark' : 'light');
  draw();
};

const deleteSelected = () => {
  if (selectedElement.value) {
    const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
      selectedElement.value = null;
      draw();
    }
  }
};

// Отслеживание движения мыши для координат
const onCanvasMouseMoveForCoords = (e) => {
  const worldPos = screenToWorld(e.clientX, e.clientY);
  mouseWorldPos.value = worldPos;
  draw();
};

// ========== Инициализация ==========
onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') isDarkTheme.value = true;

  ctx = mainCanvas.value.getContext('2d');

  const resizeObserver = new ResizeObserver(() => draw());
  resizeObserver.observe(mainCanvas.value);

  mainCanvas.value.addEventListener('mousemove', onCanvasMouseMoveForCoords);

  draw();
});

watch([scale, panX, panY, showGrid, showPorts, isDarkTheme, pixelsPerMeter, elements], () => draw(), { deep: true });
</script>
