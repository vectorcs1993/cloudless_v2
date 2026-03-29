<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <!-- Тулбар -->
    <div class="toolbar">
      <h3>Безоблачный</h3>
      <div class="tab-settings">
        <div>
          <label><input type="checkbox" v-model="isDarkTheme" /> Темная тема</label>
          <label><input type="checkbox" v-model="showGrid" /> Сетка</label>
          <label><input type="checkbox" v-model="showPorts" /> Показать порты</label>
          <label v-if="showPorts"><input type="checkbox" v-model="snapToPorts" /> Привязка к портам</label>
          <label v-if="showPorts && snapToPorts"><input type="checkbox" v-model="autoUpdateConnections" /> Автообновление связей</label>
          <label><input type="checkbox" v-model="showCallouts" /> Показать выноски</label>
          <label><input type="checkbox" v-model="showColors" /> Показывать цвета</label>
          <label><input type="checkbox" v-model="showElementAxes" /> Показывать оси элементов</label>
        </div>
      </div>

      <!-- Панель drag-and-drop элементов -->
      <div class="drag-panel">
        <div class="drag-items">
          <div v-for="item in dragItems" :key="item.type" class="drag-item" draggable="true" @dragstart="onDragStart($event, item)"
            @dragend="onDragEnd">
            <div class="drag-item-preview" v-html="item.svg"></div>
            <span class="drag-item-label">{{ item.label }}</span>
          </div>
        </div>
      </div>

      <!-- Кнопки управления сохранением -->
      <div class="save-controls">
        <button @click="saveToLocalStorage" class="cl-btn">💾 Сохранить</button>
        <button @click="resetToDefault" class="cl-btn">↺ Сброс</button>
        <button @click="updateAllPortsAndConnections" class="cl-btn">🔄 Обновить все порты и связи</button>
      </div>

    </div>
    <!-- Канвас для рендеринга элементов -->
    <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
      @wheel.prevent="onWheel" @contextmenu.prevent @dragover="onDragOver" @drop="onDrop">
    </canvas>
    <!-- Информация о выбранных элементах -->
    <div class="selected-info" v-if="selectedElements.length > 0">
      <h5>Выбрано элементов: {{ selectedElements.length }}</h5>

      <div v-if="selectedElements.length === 1" class="single-element-info">
        <p>ID: {{ selectedElements[0].id }}</p>
        <p>Тип: {{ selectedElements[0].getTypeName() }}</p>
        <p v-if="!isGroupSelected">Поворот: {{ selectedElements[0].rotation || 0 }}°</p>

        <div class="element-params">
          <table class="params-table">
            <thead>
              <tr>
                <th>Параметр</th>
                <th>Значение</th>
                <th>Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="param in selectedElements[0].getParameters()" :key="param.name">
                <td class="param-label">{{ param.label }}: </td>
                <td class="param-input">
                  <select v-if="param.type === 'select'" v-model="selectedElements[0][param.name]" @change="onParameterChange" class="param-select">
                    <option v-for="option in param.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <input v-else :type="param.type" v-model.number="selectedElements[0][param.name]" :step="param.step" :min="param.min"
                    @change="onParameterChange" />
                </td>
                <td class="param-unit">
                  <span v-if="param.unit">{{ param.unit }}</span>
                  <span v-else class="empty-unit">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="selectedElements[0].ports && selectedElements[0].ports.length > 0">
          <h5>Cвязи:</h5>
          <div v-for="port in selectedElements[0].ports" :key="port.id"
            :class="['connection-info', { 'connected': port.isConnected(), 'disconnected': !port.isConnected() }]">
            <div v-if="port.isConnected()">
              🔗 {{ port.side }} ({{ port.getDirectionName() }}) → ID {{ port.connectedElementId }}
            </div>
            <div v-else>
              ⭕ {{ port.side }} ({{ port.getDirectionName() }}) - не подключен
            </div>
          </div>
        </div>

        <div v-if="!isGroupSelected" class="rotation-controls">
          <button @click="rotateLeft" class="rotate-btn">↺ 90°</button>
          <button @click="rotateRight" class="rotate-btn">↻ 90°</button>
        </div>

        <div class="layer-controls">
          <button @click="moveToTop" class="layer-btn">⬆️ Вверх</button>
          <button @click="moveToBottom" class="layer-btn">⬇️ Вниз</button>
          <button @click="moveUp" class="layer-btn">⬆️ Выше</button>
          <button @click="moveDown" class="layer-btn">⬇️ Ниже</button>
        </div>
      </div>

      <div v-if="selectedElements.length > 1 || isGroupSelected" class="group-controls">
        <button @click="groupSelected" class="group-btn" :disabled="selectedElements.length < 2">
          📦 Сгруппировать ({{ selectedElements.length }})
        </button>
        <button @click="ungroupSelected" class="ungroup-btn" :disabled="!isGroupSelected">
          🔓 Разгруппировать
        </button>
      </div>
      <div v-if="selectedElements.length > 1" class="multi-selection-info">
        <button @click="deleteSelected" class="delete-btn">Удалить выбранные ({{ selectedElements.length }})</button>
      </div>
      <button v-if="selectedElements.length === 1" @click="deleteSelected" class="delete-btn">Удалить</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LayerManager } from './LayerManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { Tee, DuctDirect, Fan, ElementFactory, ElbowCircular, ElbowRectangular, Cross, Group } from './Elements.js';

// Элементы для drag and drop
const dragItems = [
  {
    type: 'duct',
    label: 'Воздуховод',
    color: '#4a90e2',
    width: 64,
    height: 40,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#4a90e2" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`
  },
  {
    type: 'fan',
    label: 'Вентилятор',
    color: '#f39c12',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="18" fill="#f39c12" stroke="#2c3e50" stroke-width="2"/>
      <path d="M32 14 L32 8 M32 56 L32 50 M14 32 L8 32 M56 32 L50 32 M20 20 L16 16 M44 44 L48 48 M20 44 L16 48 M44 20 L48 16" stroke="#2c3e50" stroke-width="2" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="6" fill="#e67e22"/>
    </svg>`
  },
  {
    type: 'tee',
    label: 'Тройник',
    color: '#27ae60',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
    </svg>`
  },
  {
    type: 'elbowCircular',
    label: 'Отвод',
    color: '#e74c3c',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M12 32 L32 32 L32 52" fill="none" stroke="#e74c3c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="52" r="3" fill="#e74c3c"/>
    </svg>`
  },
  {
    type: 'elbowRectangular',
    label: 'Отвод секционный',
    color: '#ff6600',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M12 32 L32 32 L32 52" fill="none" stroke="#ff6600" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="12" y="28" width="20" height="8" fill="#ff6600" stroke="#2c3e50" stroke-width="2"/>
      <rect x="28" y="40" width="8" height="12" fill="#ff6600" stroke="#2c3e50" stroke-width="2"/>
    </svg>`
  },
  {
    type: 'cross',
    label: 'Крестовина',
    color: '#9b59b6',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="28" width="40" height="8" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
    </svg>`
  }
];

// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
const isDarkTheme = ref(false);
const showGrid = ref(true);
const showPorts = ref(true);
const showCallouts = ref(true);
const showColors = ref(true);
const showElementAxes = ref(false);
const snapToPorts = ref(true);
const gridStepM = ref(1);
const autoUpdateConnections = ref(true);
// Canvas
const mainCanvas = ref(null);
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let layerManager = null;
let storageManager = null;

// Данные
const elements = ref([]);
const selectedElements = ref([]);
const mouseWorldPos = ref(null);
let nextElementId = 100;
let nextPortId = 1000;
let nextGroupId = 1000;

// Для drag and drop и призрака
let dragType = null;
let dragItemData = null;
let ghostElement = null; // Временный элемент для призрака
let isDragging = false;
let ghostWorldPos = { x: 0, y: 0 };

// Параметры для рендерера
const renderOptions = {
  scale: ref(1),
  panX: ref(0),
  panY: ref(0),
  showGrid,
  showPorts,
  showColors,
  showCallouts,
  showElementAxes,
  gridStepM,
  isDarkTheme,
  mouseWorldPos
};

// Вычисляемое свойство для проверки, выбрана ли группа
const isGroupSelected = computed(() => {
  return selectedElements.value.length === 1 && selectedElements.value[0] instanceof Group;
});

// ========== Функции ==========
const saveToLocalStorage = () => {
  storageManager.save(elements.value, nextElementId, nextPortId, nextGroupId, renderOptions);
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
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    selectedElements.value = [];
    renderer?.setSelectedElements([]);
    renderer?.draw();
    return;
  }
  try {
    console.log('Загружены данные:', data);
    console.log('Количество элементов:', data.elements.length);
    elements.value = data.elements.map(json => {
      const element = ElementFactory.createFromJSON(json);
      console.log('Создан элемент:', element.type, element.id);
      return element;
    });
    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;
    nextGroupId = data.nextGroupId || 1000;
    renderOptions.panX.value = data.panX || 0;
    renderOptions.panY.value = data.panY || 0;
    renderOptions.scale.value = data.scale || 1;
    showColors.value = data.showColors !== undefined ? data.showColors : true;
    showElementAxes.value = data.showElementAxes !== undefined ? data.showElementAxes : false;
    elements.value.forEach(el => el.updatePorts());
    selectedElements.value = [];
    renderer?.setSelectedElements([]);
    renderer?.draw();
    console.log('Элементы после загрузки:', elements.value.length);
  } catch (error) {
    console.error('Error loading data:', error);
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    selectedElements.value = [];
    renderer?.setSelectedElements([]);
    renderer?.draw();
  }
};

const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    selectedElements.value = [];
    renderer?.setSelectedElements([]);
    renderer?.draw();
  }
};

const updateAllPortsAndConnections = () => {
  const restored = connectionManager.updateAllPortsAndConnections(5);
  renderer?.draw();

  const btn = document.querySelector('.update-ports-btn');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = `✓ Восстановлено ${restored} связей!`;
    setTimeout(() => { if (btn) btn.textContent = original; }, 2000);
  }
};

const addElement = (ElementClass, params = [], x = null, y = null, centerOffset = true) => {
  const newId = ++nextElementId;

  // Если координаты не переданы, используем значения по умолчанию
  let posX = x !== null ? x : 100;
  let posY = y !== null ? y : 300;

  // Создаем элемент
  const newElement = new ElementClass(newId, posX, posY, ...params);

  // Если нужно центрировать относительно курсора
  if (centerOffset && x !== null && y !== null) {
    // Получаем размеры элемента
    const width = newElement.getWidth?.() || 64;
    const height = newElement.getHeight?.() || 64;

    // Корректируем позицию, чтобы центр элемента был в точке курсора
    newElement.x = posX - width / 2;
    newElement.y = posY - height / 2;
  }

  elements.value.push(newElement);
  newElement.updatePorts();

  const calloutX = newElement.x;
  const calloutY = newElement.y - 150;
  newElement.addCallout(calloutX, calloutY);

  selectedElements.value = [newElement];
  renderer?.setSelectedElements([newElement]);
  renderer?.draw();
  return newElement;
};

// Создание временного элемента для призрака
const createGhostElement = (itemType, worldX, worldY) => {
  let ghost = null;
  switch (itemType) {
    case 'duct':
      ghost = new DuctDirect(-1, worldX, worldY);
      break;
    case 'fan':
      ghost = new Fan(-1, worldX, worldY);
      break;
    case 'tee':
      ghost = new Tee(-1, worldX, worldY);
      break;
    case 'elbowCircular':
      ghost = new ElbowCircular(-1, worldX, worldY);
      break;
    case 'elbowRectangular':
      ghost = new ElbowRectangular(-1, worldX, worldY);
      break;
    case 'cross':
      ghost = new Cross(-1, worldX, worldY);
      break;
    default:
      return null;
  }
  return ghost;
};

// Обновление позиции призрака
const updateGhostPosition = (worldX, worldY) => {
  if (ghostElement) {
    // Корректируем позицию, чтобы центр элемента был под курсором
    const width = ghostElement.getWidth?.() || 64;
    const height = ghostElement.getHeight?.() || 64;
    ghostElement.x = worldX - width / 2;
    ghostElement.y = worldY - height / 2;
    ghostWorldPos = { x: ghostElement.x, y: ghostElement.y };

    // Обновляем рендер
    renderer?.draw();
  }
};

// Drag and drop handlers
const onDragStart = (e, item) => {
  dragType = item.type;
  dragItemData = item;
  isDragging = true;

  // Сохраняем смещение курсора относительно элемента для более точного размещения
  const rect = e.target.closest('.drag-item').getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  // Получаем текущую мировую позицию курсора
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    // Создаем призрак
    ghostElement = createGhostElement(dragType, worldPos.x, worldPos.y);
    if (ghostElement) {
      // Корректируем позицию с учетом смещения
      const width = ghostElement.getWidth?.() || 64;
      const height = ghostElement.getHeight?.() || 64;
      ghostElement.x = worldPos.x - width / 2;
      ghostElement.y = worldPos.y - height / 2;
    }
  }

  e.dataTransfer.setData('text/plain', item.type);
  e.dataTransfer.effectAllowed = 'copy';

  // Создаем прозрачное изображение для drag preview
  const dragIcon = document.createElement('div');
  dragIcon.style.opacity = '0';
  document.body.appendChild(dragIcon);
  e.dataTransfer.setDragImage(dragIcon, 0, 0);
  setTimeout(() => document.body.removeChild(dragIcon), 0);
};

const onDragEnd = (e) => {
  dragType = null;
  dragItemData = null;
  isDragging = false;
  ghostElement = null;
  renderer?.draw();
};

const onDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';

  // Обновляем позицию призрака при движении мыши
  if (isDragging && ghostElement) {
    const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
    if (worldPos) {
      updateGhostPosition(worldPos.x, worldPos.y);
    }
  }
};

const onDrop = (e) => {
  e.preventDefault();

  if (!dragType) return;

  // Получаем координаты мыши относительно canvas
  const rect = mainCanvas.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Конвертируем в мировые координаты с учетом масштаба и панорамирования
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);

  if (worldPos) {
    // Создаем элемент в позиции курсора в мировых координатах
    // centerOffset = true означает, что элемент будет центрирован относительно курсора
    const elementX = worldPos.x;
    const elementY = worldPos.y;

    // Создаем элемент в зависимости от типа
    switch (dragType) {
      case 'duct':
        addElement(DuctDirect, [], elementX, elementY, true);
        break;
      case 'fan':
        addElement(Fan, [], elementX, elementY, true);
        break;
      case 'tee':
        addElement(Tee, [], elementX, elementY, true);
        break;
      case 'elbowCircular':
        addElement(ElbowCircular, [], elementX, elementY, true);
        break;
      case 'elbowRectangular':
        addElement(ElbowRectangular, [], elementX, elementY, true);
        break;
      case 'cross':
        addElement(Cross, [], elementX, elementY, true);
        break;
      default:
        console.warn('Unknown drag type:', dragType);
    }
  }

  // Очищаем призрак
  ghostElement = null;
  isDragging = false;
  dragType = null;
  renderer?.draw();
};

const onParameterChange = () => {
  if (selectedElements.value.length === 1) {
    selectedElements.value[0].updatePorts();
    selectedElements.value[0].updateCalloutText();
    renderer?.draw();
  }
};

const rotateLeft = () => {
  if (selectedElements.value.length !== 1) return;
  connectionManager.disconnectElement(selectedElements.value[0]);
  selectedElements.value[0].rotation = ((selectedElements.value[0].rotation || 0) - 90 + 360) % 360;
  selectedElements.value[0].updatePorts();
  selectedElements.value[0].updateCalloutText();
  renderer?.draw();
};

const rotateRight = () => {
  if (selectedElements.value.length !== 1) return;
  connectionManager.disconnectElement(selectedElements.value[0]);
  selectedElements.value[0].rotation = ((selectedElements.value[0].rotation || 0) + 90) % 360;
  selectedElements.value[0].updatePorts();
  selectedElements.value[0].updateCalloutText();
  renderer?.draw();
};

const moveToTop = () => {
  if (selectedElements.value.length === 1) {
    layerManager?.moveToTop(selectedElements.value[0]);
  }
};
const moveToBottom = () => {
  if (selectedElements.value.length === 1) {
    layerManager?.moveToBottom(selectedElements.value[0]);
  }
};
const moveUp = () => {
  if (selectedElements.value.length === 1) {
    layerManager?.moveUp(selectedElements.value[0]);
  }
};
const moveDown = () => {
  if (selectedElements.value.length === 1) {
    layerManager?.moveDown(selectedElements.value[0]);
  }
};

const deleteSelected = () => {
  if (selectedElements.value.length === 0) return;

  // Удаляем все выбранные элементы
  selectedElements.value.forEach(element => {
    connectionManager.disconnectElement(element);
    const index = elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
    }
  });

  selectedElements.value = [];
  renderer?.setSelectedElements([]);
  renderer?.draw();
};

const groupSelected = () => {
  if (selectedElements.value.length < 2) return;

  const groupId = ++nextGroupId;
  const group = new Group(groupId, selectedElements.value);
  group.updatePorts();

  // Удаляем выбранные элементы из основного массива
  selectedElements.value.forEach(element => {
    const index = elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
    }
  });

  // Добавляем группу
  elements.value.push(group);
  selectedElements.value = [group];
  renderer?.setSelectedElements([group]);
  renderer?.draw();
};

const ungroupSelected = () => {
  if (!isGroupSelected.value) return;

  const group = selectedElements.value[0];
  if (!(group instanceof Group)) return;

  // Получаем элементы из группы
  const groupElements = group.getElements();

  // Удаляем группу
  const groupIndex = elements.value.findIndex(el => el.id === group.id);
  if (groupIndex !== -1) {
    elements.value.splice(groupIndex, 1);
  }

  // Добавляем элементы обратно
  groupElements.forEach(element => {
    elements.value.push(element);
  });

  selectedElements.value = groupElements;
  renderer?.setSelectedElements(groupElements);
  renderer?.draw();
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
  // Если идет перетаскивание, игнорируем
  if (isDragging) return;

  interactionManager?.onMouseDown(e);

  // Обновляем выбранные элементы из renderer
  if (renderer?.selectedElements) {
    selectedElements.value = renderer.selectedElements;
  } else {
    selectedElements.value = [];
  }
};

const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;

  // Если идет перетаскивание, обновляем позицию призрака
  if (isDragging && ghostElement) {
    updateGhostPosition(worldPos.x, worldPos.y);
  } else {
    interactionManager?.onMouseMove(e);
  }

  if (renderer?.selectedElements) {
    selectedElements.value = [...renderer.selectedElements];
  }
};

const onCanvasMouseUp = (e) => {
  if (isDragging) return;

  interactionManager?.onMouseUp(e);
  if (renderer?.selectedElements) {
    selectedElements.value = [...renderer.selectedElements];
  }
};
const onWheel = (e) => interactionManager?.onWheel(e);

// Инициализация
onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') isDarkTheme.value = true;

  storageManager = new StorageManager('hvac_editor_data');
  connectionManager = new ConnectionManager(elements);
  renderer = new CanvasRenderer(mainCanvas.value, elements, renderOptions);

  // Добавляем возможность рисовать призрака
  const originalDraw = renderer.draw.bind(renderer);
  renderer.draw = () => {
    originalDraw();
    // Рисуем призрака поверх всего
    if (isDragging && ghostElement) {
      const ctx = renderer.canvas.getContext('2d');
      ctx.save();
      // Применяем трансформации для рисования призрака в мировых координатах
      ctx.translate(renderOptions.panX.value, renderOptions.panY.value);
      ctx.scale(renderOptions.scale.value, renderOptions.scale.value);

      // Рисуем призрака с полупрозрачностью
      ctx.globalAlpha = 0.6;
      ghostElement.draw(ctx, renderOptions.scale.value, false, isDarkTheme.value, showPorts.value, showColors.value);
      ctx.globalAlpha = 1.0;

      ctx.restore();
    }
  };

  interactionManager = new InteractionManager(mainCanvas.value, elements, renderer, connectionManager, {
    snapToPorts, showPorts, showCallouts, panX: renderOptions.panX, panY: renderOptions.panY, scale: renderOptions.scale
  });
  // Настройка автоматического обновления связей
  interactionManager.setAutoUpdateConnections(autoUpdateConnections.value);

  // Следим за изменением чекбокса
  watch(autoUpdateConnections, (newVal) => {
    interactionManager?.setAutoUpdateConnections(newVal);
  });
  // Устанавливаем callback для обновления selectedElements
  interactionManager.setOnElementMoveCallback((elements) => {
    selectedElements.value = elements;
  });

  layerManager = new LayerManager(elements, renderer);

  loadFromLocalStorage();

  const resizeObserver = new ResizeObserver(() => renderer?.draw());
  resizeObserver.observe(mainCanvas.value);

  renderer.draw();
});

watch(showGrid, () => {
  renderer?.draw();
});

watch(showPorts, () => {
  renderer?.draw();
});

watch(showCallouts, () => {
  renderer?.draw();
});

watch(showColors, () => {
  renderer?.draw();
});

watch(isDarkTheme, () => {
  renderer?.draw();
});

watch(showElementAxes, () => {
  renderer?.draw();
});

watch(gridStepM, () => {
  renderer?.draw();
});
</script>
