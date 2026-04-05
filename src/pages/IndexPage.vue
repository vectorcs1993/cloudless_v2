<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <q-splitter :dark="isDarkTheme" v-model="splitterModel" class="full-height-splitter" :limits="[15, 85]">
      <template v-slot:before>
        <div class="toolbar">
          <h3>HVAC Editor</h3>
          <q-card :dark="isDarkTheme" square>
            <q-tabs v-model="tabEditor" :dark="isDarkTheme" no-caps>
              <q-tab name="library" label="Библиотека" />
              <q-tab name="settings" label="Настройки" />
            </q-tabs>
            <q-separator />
            <q-tab-panels v-model="tabEditor" :dark="isDarkTheme" animated>
              <q-tab-panel name="library">
                <div class="drag-items">
                  <div v-for="item in dragItems" :key="item.type" class="drag-item" draggable="true" @dragstart="onDragStart($event, item)"
                    @dragend="onDragEnd">
                    <div class="drag-item-preview" v-html="item.svg"></div>
                    <span class="drag-item-label">{{ item.label }}</span>
                  </div>
                </div>
              </q-tab-panel>
              <q-tab-panel name="settings">
                <div class="settings-grid">
                  <label>Масштаб размеров (мм/px):</label>
                  <div>
                    <q-input :dark="isDarkTheme" type="number" v-model.number="mmPerPx" step="0.5" min="0.5" max="10" dense outlined
                      class="inline-input" debounce="500" />
                    <span class="hint-text">(1px = {{ mmPerPx }} мм)</span>
                  </div>

                  <label>Масштаб сетки:</label>
                  <div>
                    <q-input :dark="isDarkTheme" type="number" v-model.number="gridStepM" step="10" min="50" max="500" dense outlined
                      class="inline-input" debounce="300" @update:model-value="onGridStepChange" />
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
              </q-tab-panel>
            </q-tab-panels>
          </q-card>

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
          <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
            @wheel.prevent="onWheel" @contextmenu.prevent @dragover="onDragOver" @drop="onDrop" tabindex="0">
          </canvas>
          <q-card class="selected-info-card" v-if="selectedElements.length > 0" :dark="isDarkTheme" square flat bordered>
            <q-card-section class="row items-center justify-between">
              <div class="q-m-none">Выбрано элементов: {{ selectedElements.length }}</div>
              <q-btn icon="close" flat dense v-close-popup @click="clearSelection" />
            </q-card-section>
            <div v-if="selectedElements.length === 1">
              <q-card-section class="row items-center justify-between">
                <q-list class="full-width" :dark="isDarkTheme" dense>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>ID</q-item-label>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ selectedElement?.id }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>Тип</q-item-label>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ getElementTypeName(selectedElement) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
              <q-tabs v-model="tabElement" :dark="isDarkTheme" no-caps>
                <q-tab name="parameters" label="Параметры" />
                <q-tab name="links" label="Связи" />
              </q-tabs>
              <q-tab-panels v-model="tabElement" :dark="isDarkTheme" animated>
                <q-tab-panel name="parameters">
                  <div class="single-element-info">
                    <div class="element-params">
                      <q-list dense>
                        <q-item v-for="param in getElementParameters(selectedElement)" :key="param.name">
                          <q-item-section class="param-label-col">
                            <q-item-label>{{ param.label }}:</q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-select :dark="isDarkTheme" v-if="param.type === 'select'" v-model="selectedElement[param.name]"
                              :options="param.options" option-label="label" option-value="value" dense outlined emit-value map-options
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
                    <div class="rotation-controls q-mt-md">
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
                </q-tab-panel>
                <q-tab-panel name="links">
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

                </q-tab-panel>
              </q-tab-panels>
            </div>
            <q-card-section v-if="selectedElements.length > 1 || isGroupSelected" class="group-controls q-mt-md">
              <div class="text-subtitle2 q-mb-sm">Групповые операции</div>
              <q-btn label="Сгруппировать" icon="folder" color="primary" :disable="selectedElements.length < 2" @click="groupSelected"
                class="full-width q-mb-sm" />
              <q-btn label="Разгруппировать" icon="folder_open" color="warning" :disable="!isGroupSelected" @click="ungroupSelected"
                class="full-width" />
            </q-card-section>
            <q-card-section>
              <div class="delete-controls q-mt-md">
                <q-btn label="Удалить" icon="delete" color="negative" @click="deleteSelected" class="full-width" />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount, shallowRef, readonly } from 'vue';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LayerManager } from './LayerManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { SelectionManager } from './SelectionManager.js';
import { Group, BaseElement } from './Elements.js';
import { DuctDirect } from './DuctDirect.js';
import { Transition } from './Transition.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { Fan } from './Fan.js';
import { ElementFactory } from './ElementFactory.js';
import { globalScale } from './GlobalScale.js';

const showNotify = (options) => {
  if (typeof window !== 'undefined' && window.Quasar && window.Quasar.Notify) {
    window.Quasar.Notify.create(options);
  } else {
    console.log(options.message);
  }
};

const dragItems = Object.freeze([
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
  },
  {
    type: 'transition',
    label: 'Переход',
    color: '#e67e22',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <polygon points="12,24 52,20 52,44 12,40" fill="#e67e22" stroke="#2c3e50" stroke-width="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
      <text x="32" y="54" font-size="8" text-anchor="middle" fill="#fff">${'⌀'}125→200</text>
    </svg>`
  }
]);


// Состояние
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

// Оптимизационные флаги
let redrawTimeout = null;
let isUpdatingSelection = false;
let renderFrameRequest = null;

// Refs
const tabEditor = ref('library');
const tabElement = ref('parameters');
const mainCanvas = ref(null);
const elements = shallowRef([]);
const selectedElements = shallowRef([]);
const mouseWorldPos = ref(null);
const clipboardElements = shallowRef([]);

// Менеджеры
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let selectionManager = null;
let layerManager = null;
let storageManager = null;

// ID счетчики
let nextElementId = 100;
let nextPortId = 1000;
let nextGroupId = 1000;

// Drag and drop состояние
let dragType = null;
let ghostElement = null;

// Вычисляемые свойства
const selectedElement = computed(() => {
  const selected = selectedElements.value;
  return selected.length === 1 ? selected[0] : null;
});

const isGroupSelected = computed(() => {
  const el = selectedElement.value;
  return el && el instanceof Group;
});

// Параметры рендерера
const renderOptions = {
  scale: ref(1),
  panX: ref(0),
  panY: ref(0),
  showGrid: readonly(showGrid),
  showPorts: readonly(showPorts),
  showColors: readonly(showColors),
  showCallouts: readonly(showCallouts),
  snapToPorts: readonly(snapToPorts),
  autoUpdateConnections: readonly(autoUpdateConnections),
  showElementAxes: readonly(showElementAxes),
  isDarkTheme: readonly(isDarkTheme),
  gridStepM: readonly(gridStepM),
  mmPerPx: readonly(mmPerPx),
  mouseWorldPos,
};

// ========== ОПТИМИЗИРОВАННЫЕ ФУНКЦИИ ==========

const scheduleRender = () => {
  if (renderFrameRequest) return;
  renderFrameRequest = requestAnimationFrame(() => {
    renderer?.draw();
    renderFrameRequest = null;
  });
};

const debouncedDraw = () => {
  if (redrawTimeout) clearTimeout(redrawTimeout);
  redrawTimeout = setTimeout(scheduleRender, 16);
};

const updateSelection = (newSelection, skipRender = false) => {
  if (isUpdatingSelection) return;
  isUpdatingSelection = true;

  try {
    const currentIds = selectedElements.value.map(el => el?.id).join(',');
    const newIds = newSelection.map(el => el?.id).join(',');

    if (currentIds !== newIds) {
      selectedElements.value = newSelection;
      renderer?.setSelectedElements(newSelection);
      if (!skipRender) scheduleRender();
    }
  } finally {
    isUpdatingSelection = false;
  }
};

// ========== РИСОВАНИЕ ПРИЗРАКА ==========
const drawGhost = () => {
  if (!ghostElement || !renderer) return;

  const ctx = renderer.canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.translate(renderOptions.panX.value, renderOptions.panY.value);
  ctx.scale(renderOptions.scale.value, renderOptions.scale.value);
  ctx.globalAlpha = 0.6;
  ghostElement.draw(ctx, renderOptions.scale.value, false, isDarkTheme.value, showPorts.value, showColors.value, showElementAxes.value);
  ctx.globalAlpha = 1.0;
  ctx.restore();
};

// Патчим метод draw рендерера для отрисовки призрака
const patchRendererDraw = () => {
  if (!renderer) return;

  const originalDraw = renderer.draw.bind(renderer);
  renderer.draw = () => {
    originalDraw();
    drawGhost();
  };
};

// ========== ОБРАБОТЧИКИ ==========

const onGridStepChange = (value) => {
  let newValue = parseInt(value);
  if (isNaN(newValue)) newValue = 50;
  newValue = Math.min(500, Math.max(50, newValue));
  if (gridStepM.value !== newValue) {
    gridStepM.value = newValue;
    debouncedDraw();
  }
};

const getElementTypeName = (element) => {
  if (!element) return 'Неизвестно';
  return typeof element.getTypeName === 'function' ? element.getTypeName() :
    (BaseElement.getAvailableTypes()[element.type] || element.type || 'Неизвестно');
};

const getElementParameters = (element) => {
  return element && typeof element.getParameters === 'function' ? element.getParameters() : [];
};

const onParameterChange = (value, paramName) => {
  if (!selectedElement.value) return;

  console.log(`Изменяем ${paramName} на ${value}`);
  selectedElement.value[paramName] = value;

  selectedElement.value.updatePorts?.();
  selectedElement.value.updateCalloutText?.();

  if (connectionManager && autoUpdateConnections.value) {
    connectionManager.updateAllPortsAndConnections(40);
  }

  // Принудительно обновляем UI панели без сброса выделения
  if (selectedElement.value) {
    // Создаем новый массив, чтобы Vue увидел изменения
    selectedElements.value = [...selectedElements.value];
  }

  scheduleRender();
};

const clearSelection = () => {
  updateSelection([], true);
  scheduleRender();
};

// ========== КОПИРОВАНИЕ/ВСТАВКА ==========

const copySelected = () => {
  if (selectedElements.value.length === 0) return;
  clipboardElements.value = selectedElements.value.map(element => {
    const json = element.toJSON?.() || element;
    return { ...json, callouts: [] };
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

    newElement.updatePorts?.();
    newElement.addCallout?.(newElement.x, newElement.y - 150);
    newElements.push(newElement);
  });

  elements.value = [...elements.value, ...newElements];
  updateSelection(newElements);
  scheduleRender();

  showNotify({
    type: 'positive',
    message: `Вставлено ${newElements.length} элементов`,
    position: 'bottom-right',
    timeout: 1000
  });
};

// ========== HOTKEYS ==========

const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
    e.preventDefault();
    copySelected();
  } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
    e.preventDefault();
    pasteElements();
  } else if (e.key === 'Delete' || e.key === 'Del') {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    clearSelection();
  }
};

// ========== СОХРАНЕНИЕ/ЗАГРУЗКА ==========

const saveToLocalStorage = () => {
  storageManager?.save(elements.value, nextElementId, nextPortId, nextGroupId, renderOptions);
  showNotify({ type: 'positive', message: 'Сохранено!', position: 'bottom-right', timeout: 1000 });
};

const loadFromLocalStorage = () => {
  if (!storageManager?.load) return;

  const data = storageManager.load();
  if (!data) {
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    updateSelection([]);
    scheduleRender();
    return;
  }

  try {
    const loadedElements = data.elements.map(json => ElementFactory.createFromJSON(json));

    renderOptions.panX.value = data.panX || 0;
    renderOptions.panY.value = data.panY || 0;
    renderOptions.scale.value = data.scale || 1;
    showColors.value = data.showColors ?? true;
    showElementAxes.value = data.showElementAxes ?? false;
    isDarkTheme.value = data.isDarkTheme ?? false;
    showGrid.value = data.showGrid ?? false;
    showPorts.value = data.showPorts ?? false;
    snapToPorts.value = data.snapToPorts ?? false;
    autoUpdateConnections.value = data.autoUpdateConnections ?? false;
    showCallouts.value = data.showCallouts ?? false;
    gridStepM.value = data.gridStepM ?? 50;
    mmPerPx.value = data.mmPerPx ?? 2;

    loadedElements.forEach(el => {
      el.updatePorts?.();
      if (el.type === 'group') el.updateBounds?.();
      el.updateCalloutText?.();
    });

    elements.value = loadedElements;
    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;
    nextGroupId = data.nextGroupId || 1000;

    updateSelection([]);
    scheduleRender();
  } catch (error) {
    console.error('Error loading data:', error);
    elements.value = [];
    updateSelection([]);
    scheduleRender();
  }
};

const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    nextGroupId = 1000;
    updateSelection([]);
    clipboardElements.value = [];
    scheduleRender();
    showNotify({ type: 'info', message: 'Сброс выполнен', position: 'bottom-right' });
  }
};

const updateAllPortsAndConnections = () => {
  const restored = connectionManager?.updateAllPortsAndConnections?.(5) || 0;
  scheduleRender();
  showNotify({
    type: 'positive',
    message: `Восстановлено ${restored} связей!`,
    position: 'bottom-right',
    timeout: 2000
  });
};

// ========== DRAG & DROP ==========

const createGhostElement = (itemType, worldX, worldY) => {
  switch (itemType) {
    case 'duct': return new DuctDirect(-1, worldX, worldY);
    case 'fan': return new Fan(-1, worldX, worldY);
    case 'tee': return new Tee(-1, worldX, worldY);
    case 'elbow': return new Elbow(-1, worldX, worldY);
    case 'cross': return new Cross(-1, worldX, worldY);
    case 'transition': return new Transition(-1, worldX, worldY);
    default: return null;
  }
};

const onDragStart = (e, item) => {
  dragType = item.type;
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    ghostElement = createGhostElement(dragType, worldPos.x, worldPos.y);
    patchRendererDraw(); // Обновляем патч после создания призрака
    scheduleRender();
  }

  e.dataTransfer.setData('text/plain', item.type);
  e.dataTransfer.effectAllowed = 'copy';
  const dragIcon = document.createElement('div');
  dragIcon.style.opacity = '0';
  document.body.appendChild(dragIcon);
  e.dataTransfer.setDragImage(dragIcon, 0, 0);
  setTimeout(() => document.body.removeChild(dragIcon), 0);
};

const onDragEnd = () => {
  dragType = null;
  ghostElement = null;
  patchRendererDraw(); // Обновляем патч после удаления призрака
  scheduleRender();
};

const onDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  if (ghostElement && renderer) {
    const worldPos = renderer.screenToWorld(e.clientX, e.clientY);
    if (worldPos) {
      ghostElement.x = worldPos.x;
      ghostElement.y = worldPos.y;
      scheduleRender();
    }
  }
};

const onDrop = (e) => {
  e.preventDefault();
  if (!dragType) return;

  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    const elementCreators = {
      duct: () => new DuctDirect(++nextElementId, worldPos.x, worldPos.y),
      fan: () => new Fan(++nextElementId, worldPos.x, worldPos.y),
      tee: () => new Tee(++nextElementId, worldPos.x, worldPos.y),
      elbow: () => new Elbow(++nextElementId, worldPos.x, worldPos.y),
      cross: () => new Cross(++nextElementId, worldPos.x, worldPos.y),
      transition: () => new Transition(++nextElementId, worldPos.x, worldPos.y)
    };

    const creator = elementCreators[dragType];
    if (creator) {
      const newElement = creator();
      newElement.updatePorts?.();
      newElement.addCallout?.(newElement.x, newElement.y - 150);
      elements.value = [...elements.value, newElement];
      updateSelection([newElement]);
      scheduleRender();
    }
  }
  ghostElement = null;
  dragType = null;
  patchRendererDraw();
  scheduleRender();
};

// ========== ОПЕРАЦИИ С ЭЛЕМЕНТАМИ ==========

const rotateElement = (direction) => {
  if (!selectedElement.value) return;

  const delta = direction === 'left' ? -90 : 90;

  // Для группы - поворачиваем каждый элемент внутри
  if (selectedElement.value instanceof Group) {
    const group = selectedElement.value;
    const centerX = group.x;
    const centerY = group.y;
    const angleRad = delta * Math.PI / 180;

    // Сохраняем позиции всех выносок (рекурсивно)
    const savedCallouts = [];

    const saveCalloutsRecursive = (element) => {
      if (element.callouts && element.callouts.length > 0) {
        savedCallouts.push({
          callout: element.callouts[0],
          x: element.callouts[0].x,
          y: element.callouts[0].y,
          element: element
        });
      }
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(saveCalloutsRecursive);
      }
    };

    group.elements.forEach(saveCalloutsRecursive);

    // Рекурсивная функция для поворота элементов
    const rotateElementRecursive = (element) => {
      if (!element) return;

      // Вычисляем новую позицию элемента относительно центра группы
      const dx = element.x - centerX;
      const dy = element.y - centerY;
      element.x = centerX + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
      element.y = centerY + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));

      // Поворачиваем сам элемент
      element.rotation = (element.rotation + delta) % 360;

      // Обновляем порты элемента
      if (element.updatePorts) element.updatePorts();

      // Рекурсивно обрабатываем вложенные группы
      if (element.type === 'group' && element.elements) {
        element.elements.forEach(child => rotateElementRecursive(child));
        if (element.updateBounds) element.updateBounds();
      }
    };

    // Поворачиваем все элементы верхнего уровня
    group.elements.forEach(rotateElementRecursive);

    // Восстанавливаем позиции выносок (они не должны поворачиваться)
    savedCallouts.forEach(saved => {
      saved.callout.x = saved.x;
      saved.callout.y = saved.y;
      if (saved.element.updateCalloutText) {
        saved.element.updateCalloutText();
      }
    });

    // Обновляем границы и выноску группы
    group.updateBounds();
    group.updateCalloutText();
  } else {
    // Для обычного элемента
    selectedElement.value.rotation = ((selectedElement.value.rotation || 0) + delta + 360) % 360;
    selectedElement.value.updatePorts?.();
    selectedElement.value.updateCalloutText?.();
  }

  if (connectionManager) {
    connectionManager.updateAllPortsAndConnections(40);
  }

  const currentElement = selectedElement.value;
  updateSelection([]);
  setTimeout(() => {
    updateSelection([currentElement]);
  }, 10);

  scheduleRender();
};
const rotateLeft = () => rotateElement('left');
const rotateRight = () => rotateElement('right');

const moveToTop = () => {
  if (selectedElement.value) {
    layerManager?.moveToTop(selectedElement.value);
    scheduleRender();
  }
};

const moveToBottom = () => {
  if (selectedElement.value) {
    layerManager?.moveToBottom(selectedElement.value);
    scheduleRender();
  }
};

const moveUp = () => {
  if (selectedElement.value) {
    layerManager?.moveUp(selectedElement.value);
    scheduleRender();
  }
};

const moveDown = () => {
  if (selectedElement.value) {
    layerManager?.moveDown(selectedElement.value);
    scheduleRender();
  }
};

const deleteSelected = () => {
  if (selectedElements.value.length === 0) return;

  const toDeleteIds = new Set(selectedElements.value.map(el => el.id));
  selectedElements.value.forEach(element => connectionManager?.disconnectElement(element));
  elements.value = elements.value.filter(el => !toDeleteIds.has(el.id));
  updateSelection([]);
  scheduleRender();
};

const groupSelected = () => {
  if (selectedElements.value.length < 2) return;

  const group = new Group(++nextGroupId, [...selectedElements.value]);
  group.updatePorts?.();

  const toRemoveIds = new Set(selectedElements.value.map(el => el.id));
  elements.value = [...elements.value.filter(el => !toRemoveIds.has(el.id)), group];
  updateSelection([group]);
  scheduleRender();
};

const ungroupSelected = () => {
  if (!isGroupSelected.value) return;

  const group = selectedElement.value;
  const groupElements = group.getElements();
  elements.value = [...elements.value.filter(el => el.id !== group.id), ...groupElements];
  updateSelection(groupElements);
  scheduleRender();
};

// ========== CANVAS СОБЫТИЯ ==========

const onCanvasMouseDown = (e) => {
  if (dragType) return;
  interactionManager?.onMouseDown(e);
  updateSelection([...renderer?.selectedElements || []]);
};

const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;

  if (dragType && ghostElement) {
    ghostElement.x = worldPos.x;
    ghostElement.y = worldPos.y;
    scheduleRender();
  } else {
    interactionManager?.onMouseMove(e);
    if (renderer?.selectedElements && !isUpdatingSelection) {
      updateSelection([...renderer.selectedElements], true);
    }
  }
};

const onCanvasMouseUp = (e) => {
  if (dragType) return;
  interactionManager?.onMouseUp(e);
  updateSelection([...renderer?.selectedElements || []]);
  scheduleRender();
};

const onWheel = (e) => {
  interactionManager?.onWheel(e);
  scheduleRender();
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

onMounted(() => {
  globalScale.setMmPerPx(mmPerPx.value);

  if (localStorage.getItem('theme') === 'dark') isDarkTheme.value = true;

  storageManager = new StorageManager('hvac_editor_data');
  connectionManager = new ConnectionManager(elements);
  renderer = new CanvasRenderer(mainCanvas.value, elements, renderOptions);
  selectionManager = new SelectionManager(elements, renderer);
  interactionManager = new InteractionManager(
    mainCanvas.value, elements, renderer, connectionManager, selectionManager,
    { snapToPorts, showPorts, showCallouts, panX: renderOptions.panX, panY: renderOptions.panY, scale: renderOptions.scale }
  );
  layerManager = new LayerManager(elements, renderer);

  interactionManager?.setAutoUpdateConnections(autoUpdateConnections.value);
  interactionManager?.setOnElementMoveCallback?.((movingElements) => {
    if (!isUpdatingSelection) updateSelection(movingElements, true);
  });

  watch(autoUpdateConnections, (newVal) => interactionManager?.setAutoUpdateConnections(newVal));

  // Патчим рендерер для отрисовки призрака
  patchRendererDraw();

  loadFromLocalStorage();

  const resizeObserver = new ResizeObserver(() => scheduleRender());
  resizeObserver.observe(mainCanvas.value);

  window.addEventListener('keydown', handleKeyDown);
  mainCanvas.value.setAttribute('tabindex', '0');
  mainCanvas.value.focus();

  scheduleRender();

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
    resizeObserver.disconnect();
    if (redrawTimeout) clearTimeout(redrawTimeout);
    if (renderFrameRequest) cancelAnimationFrame(renderFrameRequest);
  });
});

// ========== WATCHERS ==========

watch([showGrid, showPorts, showCallouts, showColors, isDarkTheme, showElementAxes], () => debouncedDraw());

watch(mmPerPx, (newVal) => {
  globalScale.setMmPerPx(newVal);
  elements.value.forEach(el => {
    el.updatePorts?.();
    el.updateCalloutText?.();
    if (el.type === 'group') el.updateBounds?.();
  });
  debouncedDraw();
});

watch(elements, () => debouncedDraw(), { deep: false });

</script>
