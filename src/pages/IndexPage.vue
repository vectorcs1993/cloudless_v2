<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <!-- Тулбар -->
    <div class="toolbar">
      <h3>HVAC Editor</h3>
      <div class="tab-settings">
        <div class="settings-grid">


          <label>Масштаб размеров (мм/px):</label>
          <div>
            <input type="number" v-model.number="mmPerPx" step="0.5" min="0.5" max="10" />
            (1px = {{ mmPerPx }} мм)
          </div>

          <label>Масштаб:</label>
          <div><input type="number" v-model.number="gridStepM" step="10" min="50" max="500" />px</div>

          <label>Темная тема:</label>
          <div><input type="checkbox" v-model="isDarkTheme" /></div>

          <label>Сетка:</label>
          <div><input type="checkbox" v-model="showGrid" /></div>

          <label>Показать порты:</label>
          <div><input type="checkbox" v-model="showPorts" /></div>

          <template v-if="showPorts">
            <label>Привязка к портам:</label>
            <div><input type="checkbox" v-model="snapToPorts" /></div>
          </template>

          <template v-if="showPorts && snapToPorts">
            <label>Автообновление связей:</label>
            <div><input type="checkbox" v-model="autoUpdateConnections" /></div>
          </template>

          <label>Показать выноски:</label>
          <div><input type="checkbox" v-model="showCallouts" /></div>

          <label>Показывать цвета:</label>
          <div><input type="checkbox" v-model="showColors" /></div>

          <label>Показывать оси элементов:</label>
          <div><input type="checkbox" v-model="showElementAxes" /></div>
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
        <button @click="copySelected" class="cl-btn" :disabled="selectedElements.length === 0">📋 Копировать ({{
          selectedElements.length }})</button>
        <button @click="pasteElements" class="cl-btn" :disabled="!clipboardElements.length">📋 Вставить</button>
      </div>

    </div>
    <!-- Канвас для рендеринга элементов -->
    <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
      @wheel.prevent="onWheel" @contextmenu.prevent @dragover="onDragOver" @drop="onDrop" tabindex="0">
    </canvas>
    <!-- Информация о выбранных элементах -->
    <div class="selected-info" v-if="selectedElements.length > 0">
      <h5>Выбрано элементов: {{ selectedElements.length }}</h5>

      <div v-if="selectedElements.length === 1" class="single-element-info">
        <p>ID: {{ selectedElement?.id }}</p>
        <p>Тип: {{ getElementTypeName(selectedElement) }}</p>
        <p v-if="!isGroupSelected">Поворот: {{ selectedElement?.rotation || 0 }}°</p>

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
              <tr v-for="param in getElementParameters(selectedElement)" :key="param.name">
                <td class="param-label">{{ param.label }}: </td>
                <td class="param-input">
                  <select v-if="param.type === 'select'" :value="getParamValue(selectedElement, param.name)"
                    @change="onParameterChange($event, param.name)" class="param-select">
                    <option v-for="option in param.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <input v-else :type="param.type" :value="getParamValue(selectedElement, param.name)" :step="param.step" :min="param.min"
                    @change="onParameterChange($event, param.name)" />
                </td>
                <td class="param-unit">
                  <span v-if="param.unit">{{ param.unit }}</span>
                  <span v-else class="empty-unit">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="selectedElement?.ports && selectedElement.ports.length > 0">
          <h5>Cвязи:</h5>
          <div v-for="port in selectedElement.ports" :key="port.id"
            :class="['connection-info', { 'connected': port.isConnected && port.isConnected(), 'disconnected': !port.isConnected || !port.isConnected() }]">
            <div v-if="port.isConnected && port.isConnected()">
              🔗 {{ port.side }} ({{ port.getDirectionName?.() || port.direction }}) → ID {{ port.connectedElementId }}
            </div>
            <div v-else>
              ⭕ {{ port.side }} ({{ port.getDirectionName?.() || port.direction }}) - не подключен
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
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LayerManager } from './LayerManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { SelectionManager } from './SelectionManager.js';
import { Group, BaseElement } from './Elements.js';
import { DuctDirect } from './DuctDirect.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { Fan } from './Fan.js';
import { ElementFactory } from './ElementFactory.js';
import { globalScale } from './GlobalScale.js';

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
    type: 'elbow',
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
const gridStepM = ref(50);
const mmPerPx = ref(2); // 1px = 1мм по умолчанию
const autoUpdateConnections = ref(true);
// Canvas
const mainCanvas = ref(null);
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let selectionManager = null;
let layerManager = null;
let storageManager = null;

// Данные
const elements = ref([]);
const selectedElements = ref([]);
const mouseWorldPos = ref(null);
let nextElementId = 100;
let nextPortId = 1000;
let nextGroupId = 1000;

// Для копирования/вставки
const clipboardElements = ref([]);

// Для drag and drop и призрака
let dragType = null;
let dragItemData = null;
let ghostElement = null; // Временный элемент для призрака
let isDragging = false;
let ghostWorldPos = { x: 0, y: 0 };

// Вычисляемое свойство для текущего выбранного элемента
const selectedElement = computed(() => {
  return selectedElements.value.length === 1 ? selectedElements.value[0] : null;
});

// Вычисляемое свойство для проверки, выбрана ли группа
const isGroupSelected = computed(() => {
  return selectedElement.value && selectedElement.value instanceof Group;
});

// Параметры для рендерера
const renderOptions = {
  scale: ref(1),
  panX: ref(0),
  panY: ref(0),
  showGrid,
  showPorts,
  showColors,
  showCallouts,
  snapToPorts,
  showElementAxes,
  autoUpdateConnections,
  isDarkTheme,
  gridStepM,
  mmPerPx,
  mouseWorldPos,
};

// Вспомогательные функции для безопасного доступа к методам элемента
const getElementTypeName = (element) => {
  if (!element) return 'Неизвестно';
  if (typeof element.getTypeName === 'function') {
    return element.getTypeName();
  }
  // Если элемент - простой объект (например, после загрузки)
  const types = BaseElement.getAvailableTypes();
  return types[element.type] || element.type || 'Неизвестно';
};

const getElementParameters = (element) => {
  if (!element) return [];
  if (typeof element.getParameters === 'function') {
    return element.getParameters();
  }
  // Базовые параметры для простого объекта
  return [
    { name: 'name', label: 'Имя', type: 'text', value: element.name },
    { name: 'x', label: 'X (центр)', type: 'number', step: 1, min: 20, value: element.x, unit: 'px' },
    { name: 'y', label: 'Y (центр)', type: 'number', step: 1, min: 20, value: element.y, unit: 'px' },
    { name: 'rotation', label: 'Поворот', type: 'number', step: 1, min: 0, value: element.rotation || 0, unit: '°' },
  ];
};

const getParamValue = (element, paramName) => {
  if (!element) return null;
  return element[paramName];
};

const setParamValue = (element, paramName, value) => {
  if (!element) return;
  element[paramName] = value;
};

const onParameterChange = (event, paramName) => {
  if (!selectedElement.value) return;

  let value = event.target.value;
  if (event.target.type === 'number') {
    value = parseFloat(value);
  }

  setParamValue(selectedElement.value, paramName, value);

  if (typeof selectedElement.value.updatePorts === 'function') {
    selectedElement.value.updatePorts();
  }
  if (typeof selectedElement.value.updateCalloutText === 'function') {
    selectedElement.value.updateCalloutText();
  }
  renderer?.draw();
};

// ========== Функции копирования и вставки ==========
const copySelected = () => {
  if (selectedElements.value.length === 0) return;

  // Сохраняем копии выбранных элементов в буфер обмена
  clipboardElements.value = selectedElements.value.map(element => {
    if (typeof element.toJSON === 'function') {
      const json = element.toJSON();
      json.callouts = [];
      return json;
    }
    return element;
  });

  // Показываем уведомление
  const copyBtn = document.querySelector('.cl-btn:has(> 📋 Копировать)');
  if (copyBtn) {
    const originalText = copyBtn.textContent;
    copyBtn.textContent = `✓ Скопировано ${clipboardElements.value.length} элементов!`;
    setTimeout(() => { if (copyBtn) copyBtn.textContent = originalText; }, 1000);
  }

  console.log(`Скопировано ${clipboardElements.value.length} элементов`);
};

const pasteElements = () => {
  if (clipboardElements.value.length === 0) return;

  // Снимаем выделение со всех элементов
  selectedElements.value = [];

  const newElements = [];
  const offset = 50; // Смещение для вставки, чтобы не накладывались на оригинал

  clipboardElements.value.forEach(json => {
    // Создаем новый элемент на основе сохраненного JSON
    const newElement = ElementFactory.createFromJSON({
      ...json,
      id: ++nextElementId,
      x: json.x + offset,
      y: json.y + offset,
      ports: (json.ports || []).map(port => ({
        ...port,
        id: ++nextPortId,
        connectedElementId: null,
        connectedPortId: null
      })),
      callouts: []
    });

    // Обновляем имя, чтобы не было дубликатов
    if (newElement.name) {
      const baseName = newElement.name.replace(/\s*\(копия.*\)\s*$/, '');
      newElement.name = `${baseName} (копия)`;
    }

    // Обновляем порты
    if (typeof newElement.updatePorts === 'function') {
      newElement.updatePorts();
    }

    // Добавляем ОДНУ выноску для нового элемента
    const calloutX = newElement.x;
    const calloutY = newElement.y - 150;
    if (typeof newElement.addCallout === 'function') {
      newElement.addCallout(calloutX, calloutY);
    }

    elements.value.push(newElement);
    newElements.push(newElement);
  });

  // Выделяем вставленные элементы
  selectedElements.value = newElements;
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements(newElements);
  }
  renderer?.draw();

  // Показываем уведомление
  const pasteBtn = document.querySelector('.cl-btn:has(> 📋 Вставить)');
  if (pasteBtn) {
    const originalText = pasteBtn.textContent;
    pasteBtn.textContent = `✓ Вставлено ${newElements.length} элементов!`;
    setTimeout(() => { if (pasteBtn) pasteBtn.textContent = originalText; }, 1000);
  }

  console.log(`Вставлено ${newElements.length} элементов`);
};

// Обработчик горячих клавиш
const handleKeyDown = (e) => {
  // Проверяем нажатие Ctrl+C (копирование) - используем e.code вместо e.key
  if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC')) {
    e.preventDefault();
    copySelected();
  }
  // Ctrl+V (вставка)
  else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV')) {
    e.preventDefault();
    pasteElements();
  }
  // Delete (удаление)
  else if (e.key === 'Delete' || e.key === 'Del') {
    e.preventDefault();
    deleteSelected();
  }
  // Escape (снятие выделения)
  else if (e.key === 'Escape' || e.code === 'Escape') {
    e.preventDefault();
    selectedElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
    renderer?.draw();
  }
}

const saveToLocalStorage = () => {
  if (storageManager && typeof storageManager.save === 'function') {
    storageManager.save(elements.value, nextElementId, nextPortId, nextGroupId, renderOptions);
  }
  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Сохранено!';
    setTimeout(() => { if (saveBtn) saveBtn.textContent = originalText; }, 1000);
  }
};

const loadFromLocalStorage = () => {
  if (!storageManager || typeof storageManager.load !== 'function') return;

  const data = storageManager.load();
  if (!data) {
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    selectedElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
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
    isDarkTheme.value = data.isDarkTheme !== undefined ? data.isDarkTheme : false;
    showGrid.value = data.showGrid !== undefined ? data.showGrid : false;
    showPorts.value = data.showPorts !== undefined ? data.showPorts : false;
    snapToPorts.value = data.snapToPorts !== undefined ? data.snapToPorts : false;
    autoUpdateConnections.value = data.autoUpdateConnections !== undefined ? data.autoUpdateConnections : false;
    showCallouts.value = data.showCallouts !== undefined ? data.showCallouts : false;
    gridStepM.value = data.gridStepM !== undefined ? data.gridStepM : 50;
    mmPerPx.value = data.mmPerPx !== undefined ? data.mmPerPx : 2;
    elements.value.forEach(el => {
      if (typeof el.updatePorts === 'function') el.updatePorts();
    });
    selectedElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
    renderer?.draw();
    console.log('Элементы после загрузки:', elements.value.length);
  } catch (error) {
    console.error('Error loading data:', error);
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    selectedElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
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
    clipboardElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
    renderer?.draw();
  }
};

const updateAllPortsAndConnections = () => {
  if (connectionManager && typeof connectionManager.updateAllPortsAndConnections === 'function') {
    const restored = connectionManager.updateAllPortsAndConnections(5);
    renderer?.draw();

    const btn = document.querySelector('.update-ports-btn');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = `✓ Восстановлено ${restored} связей!`;
      setTimeout(() => { if (btn) btn.textContent = original; }, 2000);
    }
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
    newElement.x = posX;
    newElement.y = posY;
  }

  elements.value.push(newElement);
  if (typeof newElement.updatePorts === 'function') {
    newElement.updatePorts();
  }

  const calloutX = newElement.x;
  const calloutY = newElement.y - 150;
  if (typeof newElement.addCallout === 'function') {
    newElement.addCallout(calloutX, calloutY);
  }

  selectedElements.value = [newElement];
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements([newElement]);
  }
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
    case 'elbow':
      ghost = new Elbow(-1, worldX, worldY);
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
    ghostElement.x = worldX;
    ghostElement.y = worldY;
    ghostWorldPos = { x: ghostElement.x, y: ghostElement.y };
    renderer?.draw();
  }
};

// Drag and drop handlers
const onDragStart = (e, item) => {
  dragType = item.type;
  dragItemData = item;
  isDragging = true;

  // Получаем текущую мировую позицию курсора
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    ghostElement = createGhostElement(dragType, worldPos.x, worldPos.y);
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

  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);

  if (worldPos) {
    switch (dragType) {
      case 'duct':
        addElement(DuctDirect, [], worldPos.x, worldPos.y, true);
        break;
      case 'fan':
        addElement(Fan, [], worldPos.x, worldPos.y, true);
        break;
      case 'tee':
        addElement(Tee, [], worldPos.x, worldPos.y, true);
        break;
      case 'elbow':
        addElement(Elbow, [], worldPos.x, worldPos.y, true);
        break;
      case 'cross':
        addElement(Cross, [], worldPos.x, worldPos.y, true);
        break;
      default:
        console.warn('Unknown drag type:', dragType);
    }
  }

  ghostElement = null;
  isDragging = false;
  dragType = null;
  renderer?.draw();
};

const rotateLeft = () => {
  if (!selectedElement.value) return;
  if (connectionManager && typeof connectionManager.disconnectElement === 'function') {
    connectionManager.disconnectElement(selectedElement.value);
  }
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) - 90 + 360) % 360;
  if (typeof selectedElement.value.updatePorts === 'function') {
    selectedElement.value.updatePorts();
  }
  if (typeof selectedElement.value.updateCalloutText === 'function') {
    selectedElement.value.updateCalloutText();
  }
  renderer?.draw();
};

const rotateRight = () => {
  if (!selectedElement.value) return;
  if (connectionManager && typeof connectionManager.disconnectElement === 'function') {
    connectionManager.disconnectElement(selectedElement.value);
  }
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) + 90) % 360;
  if (typeof selectedElement.value.updatePorts === 'function') {
    selectedElement.value.updatePorts();
  }
  if (typeof selectedElement.value.updateCalloutText === 'function') {
    selectedElement.value.updateCalloutText();
  }
  renderer?.draw();
};

const moveToTop = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveToTop === 'function') {
    layerManager.moveToTop(selectedElement.value);
  }
};
const moveToBottom = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveToBottom === 'function') {
    layerManager.moveToBottom(selectedElement.value);
  }
};
const moveUp = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveUp === 'function') {
    layerManager.moveUp(selectedElement.value);
  }
};
const moveDown = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveDown === 'function') {
    layerManager.moveDown(selectedElement.value);
  }
};

const deleteSelected = () => {
  if (selectedElements.value.length === 0) return;

  selectedElements.value.forEach(element => {
    if (connectionManager && typeof connectionManager.disconnectElement === 'function') {
      connectionManager.disconnectElement(element);
    }
    const index = elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
    }
  });

  selectedElements.value = [];
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements([]);
  }
  renderer?.draw();
};

const groupSelected = () => {
  if (selectedElements.value.length < 2) return;

  const groupId = ++nextGroupId;
  const group = new Group(groupId, [...selectedElements.value]);
  if (typeof group.updatePorts === 'function') {
    group.updatePorts();
  }

  selectedElements.value.forEach(element => {
    const index = elements.value.findIndex(el => el.id === element.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
    }
  });

  elements.value.push(group);
  selectedElements.value = [group];
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements([group]);
  }
  renderer?.draw();
};

const ungroupSelected = () => {
  if (!isGroupSelected.value) return;

  const group = selectedElement.value;
  if (!(group instanceof Group)) return;

  const groupElements = group.getElements();

  const groupIndex = elements.value.findIndex(el => el.id === group.id);
  if (groupIndex !== -1) {
    elements.value.splice(groupIndex, 1);
  }

  groupElements.forEach(element => {
    elements.value.push(element);
  });

  selectedElements.value = groupElements;
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements(groupElements);
  }
  renderer?.draw();
};

// Обработчики событий canvas
const onCanvasMouseDown = (e) => {
  if (isDragging) return;
  interactionManager?.onMouseDown(e);

  if (renderer?.selectedElements) {
    selectedElements.value = [...renderer.selectedElements];
  } else {
    selectedElements.value = [];
  }
};

const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;

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
  globalScale.setMmPerPx(mmPerPx.value);
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') isDarkTheme.value = true;

  storageManager = new StorageManager('hvac_editor_data');
  connectionManager = new ConnectionManager(elements);
  renderer = new CanvasRenderer(mainCanvas.value, elements, renderOptions);
  selectionManager = new SelectionManager(elements, renderer);

  const originalDraw = renderer.draw.bind(renderer);
  renderer.draw = () => {
    originalDraw();
    if (isDragging && ghostElement) {
      const ctx = renderer.canvas.getContext('2d');
      ctx.save();
      ctx.translate(renderOptions.panX.value, renderOptions.panY.value);
      ctx.scale(renderOptions.scale.value, renderOptions.scale.value);
      ctx.globalAlpha = 0.6;
      ghostElement.draw(ctx, renderOptions.scale.value, false, isDarkTheme.value, showPorts.value, showColors.value, showElementAxes.value);
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }
  };

  interactionManager = new InteractionManager(
    mainCanvas.value,
    elements,
    renderer,
    connectionManager,
    selectionManager,
    {
      snapToPorts,
      showPorts,
      showCallouts,
      panX: renderOptions.panX,
      panY: renderOptions.panY,
      scale: renderOptions.scale
    }
  );

  if (interactionManager && typeof interactionManager.setAutoUpdateConnections === 'function') {
    interactionManager.setAutoUpdateConnections(autoUpdateConnections.value);
  }

  watch(autoUpdateConnections, (newVal) => {
    interactionManager?.setAutoUpdateConnections(newVal);
  });

  if (interactionManager && typeof interactionManager.setOnElementMoveCallback === 'function') {
    interactionManager.setOnElementMoveCallback((elements) => {
      selectedElements.value = elements;
      if (selectionManager && typeof selectionManager.setSelectedElements === 'function') {
        selectionManager.setSelectedElements(elements);
      }
    });
  }

  layerManager = new LayerManager(elements, renderer);

  loadFromLocalStorage();

  const resizeObserver = new ResizeObserver(() => renderer?.draw());
  resizeObserver.observe(mainCanvas.value);

  window.addEventListener('keydown', handleKeyDown);
  mainCanvas.value.setAttribute('tabindex', '0');
  mainCanvas.value.focus();

  renderer.draw();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

watch(showGrid, () => renderer?.draw());
watch(showPorts, () => renderer?.draw());
watch(showCallouts, () => renderer?.draw());
watch(showColors, () => renderer?.draw());
watch(isDarkTheme, () => renderer?.draw());
watch(showElementAxes, () => renderer?.draw());
watch(gridStepM, () => renderer?.draw());
watch(mmPerPx, (newVal) => {
  globalScale.setMmPerPx(newVal)
  elements.value.forEach(el => {
    if (typeof el.updatePorts === 'function') el.updatePorts();
    if (typeof el.updateCalloutText === 'function') el.updateCalloutText();
  });
  renderer?.draw();
});
</script>
