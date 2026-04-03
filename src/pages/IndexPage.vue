<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <q-splitter :dark="isDarkTheme" v-model="splitterModel" class="full-height-splitter" :limits="[15, 85]">
      <template v-slot:before>
        <div class="toolbar">
          <h3>HVAC Editor</h3>
          <div class="tab-settings">
            <div class="settings-grid">
              <label>Масштаб размеров (мм/px):</label>
              <div>
                <q-input :dark="isDarkTheme" type="number" v-model.number="mmPerPx" step="0.5" min="0.5" max="10" dense outlined class="inline-input"
                  debounce="500" />
                <span class="hint-text">(1px = {{ mmPerPx }} мм)</span>
              </div>

              <label>Масштаб сетки:</label>
              <div>
                <q-input :dark="isDarkTheme" type="number" v-model.number="gridStepM" step="10" min="50" max="500" dense outlined class="inline-input"
                  debounce="300" @update:model-value="onGridStepChange" />
                <span class="hint-text">px</span>
              </div>

              <label>Темная тема:</label>
              <div><q-toggle v-model="isDarkTheme" /></div>

              <label>Сетка:</label>
              <div><q-toggle v-model="showGrid" /></div>

              <label>Показать порты:</label>
              <div><q-toggle v-model="showPorts" /></div>

              <template v-if="showPorts">
                <label>Привязка к портам:</label>
                <div><q-toggle v-model="snapToPorts" /></div>
              </template>

              <template v-if="showPorts && snapToPorts">
                <label>Автообновление связей:</label>
                <div><q-toggle v-model="autoUpdateConnections" /></div>
              </template>

              <label>Показать выноски:</label>
              <div><q-toggle v-model="showCallouts" /></div>

              <label>Показывать цвета:</label>
              <div><q-toggle v-model="showColors" /></div>

              <label>Показывать оси элементов:</label>
              <div><q-toggle v-model="showElementAxes" /></div>
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
            <q-btn @click="saveToLocalStorage" color="primary" icon="save" label="Сохранить" dense />
            <q-btn @click="resetToDefault" color="warning" icon="refresh" label="Сброс" dense />
            <q-btn @click="updateAllPortsAndConnections" color="info" icon="sync" label="Обновить связи" dense />
            <q-btn @click="copySelected" color="secondary" :disable="selectedElements.length === 0" dense>
              <q-icon name="content_copy" />
              <span class="q-ml-xs">Копировать ({{ selectedElements.length }})</span>
            </q-btn>
            <q-btn @click="pasteElements" color="secondary" :disable="!clipboardElements.length" dense>
              <q-icon name="content_paste" />
              <span class="q-ml-xs">Вставить</span>
            </q-btn>
          </div>
        </div>
      </template>

      <template v-slot:after>
        <div class="canvas-container">
          <!-- Канвас для рендеринга элементов -->
          <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
            @wheel.prevent="onWheel" @contextmenu.prevent @dragover="onDragOver" @drop="onDrop" tabindex="0">
          </canvas>

          <!-- Информация о выбранных элементах -->
          <q-card :dark="isDarkTheme" v-if="selectedElements.length > 0" class="selected-info-card" flat bordered>
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="q-m-none">Выбрано элементов: {{ selectedElements.length }}</div>
                <q-btn icon="close" flat dense v-close-popup @click="clearSelection" />
              </div>

              <q-separator class="q-mt-sm q-mb-md" />

              <div v-if="selectedElements.length === 1" class="single-element-info">
                <q-list :dark="isDarkTheme" dense>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>ID</q-item-label>
                      <q-item-label>{{ selectedElement?.id }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>Тип</q-item-label>
                      <q-item-label>{{ getElementTypeName(selectedElement) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>

                <div class="element-params">
                  <div class="text-subtitle2 q-mt-md q-mb-sm">Параметры</div>
                  <q-separator class="q-mb-sm" />

                  <q-list dense>
                    <q-item v-for="param in getElementParameters(selectedElement)" :key="param.name">
                      <q-item-section class="param-label-col">
                        <q-item-label>{{ param.label }}:</q-item-label>
                      </q-item-section>
                      <q-item-section>
                        <q-select :dark="isDarkTheme" v-if="param.type === 'select'" v-model="selectedElement[param.name]" :options="param.options"
                          option-label="label" option-value="value" dense outlined emit-value map-options
                          @update:model-value="(val) => onParameterChange(val, param.name)" />
                        <q-input :dark="isDarkTheme" v-else :type="param.type" v-model.number="selectedElement[param.name]" :step="param.step"
                          :min="param.min" dense outlined @update:model-value="val => onParameterChange(val, param.name)" />
                      </q-item-section>
                      <q-item-section side class="param-unit-col">
                        <span v-if="param.unit">{{ param.unit }}</span>
                        <span v-else>—</span>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>

                <div v-if="selectedElement?.ports && selectedElement.ports.length > 0" class="connections-info">
                  <div class="text-subtitle2 q-mt-md q-mb-sm">Связи</div>
                  <q-separator class="q-mb-sm" />

                  <div v-for="port in selectedElement.ports" :key="port.id" class="connection-item">
                    <q-icon :name="port.isConnected && port.isConnected() ? 'link' : 'link_off'"
                      :color="port.isConnected && port.isConnected() ? 'positive' : 'negative'" size="16px" />
                    <span class="q-ml-sm">
                      {{ port.side }} ({{ port.getDirectionName?.() || port.direction }})
                    </span>
                    <span v-if="port.isConnected && port.isConnected()" class="q-ml-auto">
                      → ID {{ port.connectedElementId }}
                    </span>
                    <span v-else class="q-ml-auto text-negative">не подключен</span>
                  </div>
                </div>

                <div v-if="!isGroupSelected" class="rotation-controls q-mt-md">
                  <div class="text-subtitle2 q-mb-sm">Поворот</div>
                  <q-btn-group spread>
                    <q-btn label="↺ 90°" @click="rotateLeft" color="primary" />
                    <q-btn label="↻ 90°" @click="rotateRight" color="primary" />
                  </q-btn-group>
                </div>

                <div class="layer-controls q-mt-md">
                  <div class="text-subtitle2 q-mb-sm">Слои</div>
                  <q-btn-group>
                    <q-btn icon="vertical_align_top" @click="moveToTop" label="Вверх" />
                    <q-btn icon="arrow_upward" @click="moveUp" label="Выше" />
                    <q-btn icon="arrow_downward" @click="moveDown" label="Ниже" />
                    <q-btn icon="vertical_align_bottom" @click="moveToBottom" label="Вниз" />
                  </q-btn-group>
                </div>
              </div>

              <div v-if="selectedElements.length > 1 || isGroupSelected" class="group-controls q-mt-md">
                <div class="text-subtitle2 q-mb-sm">Групповые операции</div>
                <q-btn label="Сгруппировать" icon="folder" color="primary" :disable="selectedElements.length < 2" @click="groupSelected"
                  class="full-width q-mb-sm" />
                <q-btn label="Разгруппировать" icon="folder_open" color="warning" :disable="!isGroupSelected" @click="ungroupSelected"
                  class="full-width" />
              </div>

              <div class="delete-controls q-mt-md">
                <q-btn label="Удалить" icon="delete" color="negative" @click="deleteSelected" class="full-width" />
                <span v-if="selectedElements.length > 1" class="q-ml-sm text-caption">
                  ({{ selectedElements.length }} элементов)
                </span>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount, nextTick } from 'vue';
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

// Функция для уведомлений (fallback если Quasar не загружен)
const showNotify = (options) => {
  if (typeof window !== 'undefined' && window.Quasar && window.Quasar.Notify) {
    window.Quasar.Notify.create(options);
  } else {
    console.log(options.message);
  }
};

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
const splitterModel = ref(15);
const isDarkTheme = ref(false);
const showGrid = ref(true);
const showPorts = ref(true);
const showCallouts = ref(true);
const showColors = ref(true);
const showElementAxes = ref(false);
const snapToPorts = ref(true);
const gridStepM = ref(50);
const mmPerPx = ref(2);
const autoUpdateConnections = ref(true);

// Флаг для предотвращения множественных перерисовок
let redrawTimeout = null;

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

// Для drag and drop
let dragType = null;
let dragItemData = null;
let ghostElement = null;
let isDragging = false;
let ghostWorldPos = { x: 0, y: 0 };

// Вычисляемые свойства
const selectedElement = computed(() => {
  return selectedElements.value.length === 1 ? selectedElements.value[0] : null;
});

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

// Оптимизированная функция перерисовки с debounce
const debouncedDraw = () => {
  if (redrawTimeout) {
    clearTimeout(redrawTimeout);
  }
  redrawTimeout = setTimeout(() => {
    renderer?.draw();
    redrawTimeout = null;
  }, 16); // ~60fps
};

// Обработчик изменения масштаба сетки с оптимизацией
const onGridStepChange = (value) => {
  // Валидация значения
  let newValue = parseInt(value);
  if (isNaN(newValue)) newValue = 50;
  if (newValue < 50) newValue = 50;
  if (newValue > 500) newValue = 500;

  if (gridStepM.value !== newValue) {
    gridStepM.value = newValue;
    // Используем debounced перерисовку
    debouncedDraw();
  }
};

// Вспомогательные функции
const getElementTypeName = (element) => {
  if (!element) return 'Неизвестно';
  if (typeof element.getTypeName === 'function') {
    return element.getTypeName();
  }
  const types = BaseElement.getAvailableTypes();
  return types[element.type] || element.type || 'Неизвестно';
};

const getElementParameters = (element) => {
  if (!element) return [];
  if (typeof element.getParameters === 'function') {
    return element.getParameters();
  }
  return [];
};

const setParamValue = (element, paramName, value) => {
  if (!element) return;
  element[paramName] = value;
};

const onParameterChange = (value, paramName) => {
  if (!selectedElement.value) return;
  setParamValue(selectedElement.value, paramName, value);
  if (typeof selectedElement.value.updatePorts === 'function') {
    selectedElement.value.updatePorts();
  }
  if (typeof selectedElement.value.updateCalloutText === 'function') {
    selectedElement.value.updateCalloutText();
  }
  renderer?.draw();
};

const clearSelection = () => {
  selectedElements.value = [];
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements([]);
  }
  renderer?.draw();
};

// Функции копирования и вставки
const copySelected = () => {
  if (selectedElements.value.length === 0) return;
  clipboardElements.value = selectedElements.value.map(element => {
    if (typeof element.toJSON === 'function') {
      const json = element.toJSON();
      json.callouts = [];
      return json;
    }
    return element;
  });
  showNotify({
    type: 'positive',
    message: `Скопировано ${clipboardElements.value.length} элементов`,
    position: 'bottom-right',
    timeout: 1000
  });
};

const pasteElements = () => {
  if (clipboardElements.value.length === 0) return;
  selectedElements.value = [];
  const newElements = [];
  const offset = 50;
  clipboardElements.value.forEach(json => {
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
    if (newElement.name) {
      const baseName = newElement.name.replace(/\s*\(копия.*\)\s*$/, '');
      newElement.name = `${baseName} (копия)`;
    }
    if (typeof newElement.updatePorts === 'function') {
      newElement.updatePorts();
    }
    const calloutX = newElement.x;
    const calloutY = newElement.y - 150;
    if (typeof newElement.addCallout === 'function') {
      newElement.addCallout(calloutX, calloutY);
    }
    elements.value.push(newElement);
    newElements.push(newElement);
  });
  selectedElements.value = newElements;
  if (renderer && typeof renderer.setSelectedElements === 'function') {
    renderer.setSelectedElements(newElements);
  }
  renderer?.draw();
  showNotify({
    type: 'positive',
    message: `Вставлено ${newElements.length} элементов`,
    position: 'bottom-right',
    timeout: 1000
  });
};

// Обработчик горячих клавиш
const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC')) {
    e.preventDefault();
    copySelected();
  } else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV')) {
    e.preventDefault();
    pasteElements();
  } else if (e.key === 'Delete' || e.key === 'Del') {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape' || e.code === 'Escape') {
    e.preventDefault();
    clearSelection();
  }
};

const saveToLocalStorage = () => {
  if (storageManager && typeof storageManager.save === 'function') {
    storageManager.save(elements.value, nextElementId, nextPortId, nextGroupId, renderOptions);
  }
  showNotify({
    type: 'positive',
    message: 'Сохранено!',
    position: 'bottom-right',
    timeout: 1000
  });
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
    // Сначала создаем все элементы
    const loadedElements = data.elements.map(json => ElementFactory.createFromJSON(json));

    // Обновляем глобальные настройки ДО обновления портов
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

    // ========== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Обновляем все порты и границы групп ==========
    // Сначала обновляем порты всех элементов (это пересчитает их мировые координаты)
    loadedElements.forEach(el => {
      if (typeof el.updatePorts === 'function') {
        el.updatePorts();
      }
    });

    // Затем обновляем границы всех групп (теперь порты элементов актуальны)
    loadedElements.forEach(el => {
      if (el.type === 'group' && typeof el.updateBounds === 'function') {
        el.updateBounds();
      }
    });

    // Обновляем выноски
    loadedElements.forEach(el => {
      if (typeof el.updateCalloutText === 'function') {
        el.updateCalloutText();
      }
    });

    elements.value = loadedElements;
    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;
    nextGroupId = data.nextGroupId || 1000;

    selectedElements.value = [];
    if (renderer && typeof renderer.setSelectedElements === 'function') {
      renderer.setSelectedElements([]);
    }
    renderer?.draw();

    console.log('Загружено элементов:', elements.value.length);

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
    showNotify({
      type: 'info',
      message: 'Сброс выполнен',
      position: 'bottom-right'
    });
  }
};

const updateAllPortsAndConnections = () => {
  if (connectionManager && typeof connectionManager.updateAllPortsAndConnections === 'function') {
    const restored = connectionManager.updateAllPortsAndConnections(5);
    renderer?.draw();
    showNotify({
      type: 'positive',
      message: `Восстановлено ${restored} связей!`,
      position: 'bottom-right',
      timeout: 2000
    });
  }
};

const addElement = (ElementClass, params = [], x = null, y = null, centerOffset = true) => {
  const newId = ++nextElementId;
  let posX = x !== null ? x : 100;
  let posY = y !== null ? y : 300;
  const newElement = new ElementClass(newId, posX, posY, ...params);
  if (centerOffset && x !== null && y !== null) {
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

const createGhostElement = (itemType, worldX, worldY) => {
  let ghost = null;
  switch (itemType) {
    case 'duct': ghost = new DuctDirect(-1, worldX, worldY); break;
    case 'fan': ghost = new Fan(-1, worldX, worldY); break;
    case 'tee': ghost = new Tee(-1, worldX, worldY); break;
    case 'elbow': ghost = new Elbow(-1, worldX, worldY); break;
    case 'cross': ghost = new Cross(-1, worldX, worldY); break;
    default: return null;
  }
  return ghost;
};

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
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    ghostElement = createGhostElement(dragType, worldPos.x, worldPos.y);
  }
  e.dataTransfer.setData('text/plain', item.type);
  e.dataTransfer.effectAllowed = 'copy';
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
      case 'duct': addElement(DuctDirect, [], worldPos.x, worldPos.y, true); break;
      case 'fan': addElement(Fan, [], worldPos.x, worldPos.y, true); break;
      case 'tee': addElement(Tee, [], worldPos.x, worldPos.y, true); break;
      case 'elbow': addElement(Elbow, [], worldPos.x, worldPos.y, true); break;
      case 'cross': addElement(Cross, [], worldPos.x, worldPos.y, true); break;
      default: console.warn('Unknown drag type:', dragType);
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
    renderer?.draw();
  }
};

const moveToBottom = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveToBottom === 'function') {
    layerManager.moveToBottom(selectedElement.value);
    renderer?.draw();
  }
};

const moveUp = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveUp === 'function') {
    layerManager.moveUp(selectedElement.value);
    renderer?.draw();
  }
};

const moveDown = () => {
  if (selectedElement.value && layerManager && typeof layerManager.moveDown === 'function') {
    layerManager.moveDown(selectedElement.value);
    renderer?.draw();
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
  clearSelection();
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
  if (redrawTimeout) {
    clearTimeout(redrawTimeout);
  }
});

// Оптимизированные watchers с debounce
watch(showGrid, () => debouncedDraw());
watch(showPorts, () => debouncedDraw());
watch(showCallouts, () => debouncedDraw());
watch(showColors, () => debouncedDraw());
watch(isDarkTheme, () => debouncedDraw());
watch(showElementAxes, () => debouncedDraw());
watch(mmPerPx, (newVal) => {
  globalScale.setMmPerPx(newVal);

  // Обновляем порты всех элементов
  elements.value.forEach(el => {
    if (typeof el.updatePorts === 'function') el.updatePorts();
    if (typeof el.updateCalloutText === 'function') el.updateCalloutText();
  });

  // Обновляем границы всех групп
  elements.value.forEach(el => {
    if (el.type === 'group' && typeof el.updateBounds === 'function') {
      el.updateBounds();
    }
  });

  debouncedDraw();
});

// Убираем прямой watch для gridStepM, используем onGridStepChange
</script>
