<template>
  <div class="app" :class="{ 'dark-theme': isDarkTheme }">
    <q-splitter :dark="isDarkTheme" v-model="splitterModel1" :limits="[20, 80]" class="full-height-splitter">
      <template v-slot:before>
        <q-splitter horizontal :dark="isDarkTheme" v-model="splitterModel2">
          <template v-slot:before>
            <q-card :dark="isDarkTheme" square class="fit" flat>
              <q-card-section>
                <div class="text-h6">Расчёт воздуховодов онлайн</div>
              </q-card-section>
              <q-tabs v-model="tabEditor" :dark="isDarkTheme" no-caps>
                <q-tab name="library" label="Библиотека" />
                <q-tab name="settings" label="Настройки" />
              </q-tabs>
              <q-separator />
              <q-tab-panels v-model="tabEditor" :dark="isDarkTheme" animated>
                <q-tab-panel name="library">
                  <div class="drag-items">
                    <div v-for="item in dragItems" :key="item.type" class="drag-item" draggable="true"
                      @dragstart="onDragStart($event, item)" @dragend="onDragEnd">
                      <div class="drag-item-preview" v-html="item.svg"></div>
                      <span class="drag-item-label">{{ item.label }}</span>
                    </div>
                  </div>
                </q-tab-panel>
                <q-tab-panel name="settings">
                  <div class="settings-grid">
                    <label>Масштаб размеров (мм/px):</label>
                    <div>
                      <q-input :dark="isDarkTheme" type="number" v-model.number="mmPerPx" step="0.5" min="0.5" max="10"
                        dense outlined class="inline-input" debounce="500" />
                      <span class="hint-text">(1px = {{ mmPerPx }} мм)</span>
                    </div>

                    <label>Масштаб сетки:</label>
                    <div>
                      <q-input :dark="isDarkTheme" type="number" v-model.number="gridStepM" step="10" min="50" max="500"
                        dense outlined class="inline-input" debounce="300" @update:model-value="onGridStepChange" />
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

              <q-card-section class="save-controls">
                <q-btn @click="saveToLocalStorage" color="primary" icon="save" label="Сохранить" dense />
                <q-btn @click="resetToDefault" color="warning" icon="refresh" label="Сброс" dense />
              </q-card-section>
            </q-card>
          </template>
          <template v-slot:after>
            <q-card :dark="isDarkTheme" class="fit" flat>
              <q-card-section class="row items-center justify-between">
                <div class="text-subtitle1">Диспетчер проекта</div>
                <div>
                  <q-btn icon="add" label="Слой" flat dense size="sm" @click="addNewLayer" />
                </div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn @click="updateAllPortsAndConnections" icon="sync" dense flat size="sm" />
                <q-btn @click="copySelected" icon="content_copy" v-if="selectedElements.length > 0" dense flat
                  size="sm" />
                <q-btn @click="pasteElements" icon="content_paste" v-if="clipboardElements.length > 0" dense flat
                  size="sm" />
                <q-btn @click="expandAllTree" icon="unfold_more" dense flat size="sm" />
                <q-btn @click="collapseAllTree" icon="unfold_less" dense flat size="sm" />
              </q-card-actions>
              <q-card-section class="q-pt-none">
                <q-tree :dark="isDarkTheme" :nodes="projectTree" :expanded="expandedTreeNodes"
                  @update:expanded="onExpandedChange" node-key="id" label-key="label" children-key="children"
                  no-connectors @update:selected="onTreeSelect" :selected.sync="selectedTreeNode" default-expand-all>
                  <template v-slot:default-header="prop">
                    <div :class="['tree-node', {
                      'tree-node-selected': prop.node.id === selectedTreeNode,
                      'tree-node-layer': prop.node.isLayer,
                      'tree-node-layer-locked': prop.node.isLayer && prop.node.layerLocked,
                      'tree-node-layer-hidden': prop.node.isLayer && !prop.node.layerVisible
                    }]" @contextmenu.prevent="onTreeNodeContextMenu($event, prop.node)">

                      <q-icon :name="prop.node.icon" :color="prop.node.color" size="20px" class="q-mr-sm" />
                      <span class="tree-node-label">{{ prop.node.label }}</span>

                      <!-- Индикаторы для слоя -->
                      <template v-if="prop.node.isLayer">
                        <!-- Кнопка блокировки/разблокировки -->
                        <q-icon :name="prop.node.layerLocked ? 'lock' : 'lock_open'" size="14px"
                          :color="prop.node.layerLocked ? 'negative' : 'positive'" class="q-ml-xs cursor-pointer"
                          @click.stop="toggleLayerLock(prop.node.layerId)"
                          :title="prop.node.layerLocked ? 'Разблокировать слой' : 'Заблокировать слой'" />

                        <!-- Кнопка видимости -->
                        <q-icon :name="prop.node.layerVisible ? 'visibility' : 'visibility_off'" size="14px"
                          :color="prop.node.layerVisible ? 'primary' : 'grey'" class="q-ml-xs cursor-pointer"
                          @click.stop="toggleLayerVisibility(prop.node.layerId)"
                          :title="prop.node.layerVisible ? 'Скрыть слой' : 'Показать слой'" />

                        <!-- Индикатор активного слоя -->
                        <q-icon v-if="activeLayerId === prop.node.layerId" name="check_circle" size="14px"
                          color="positive" class="q-ml-xs" :title="'Активный слой'" />

                        <!-- Кнопка переименования -->
                        <q-icon name="edit" size="14px" color="info" class="q-ml-xs cursor-pointer"
                          @click.stop="renameLayer(prop.node.layerId)" :title="'Переименовать'" />

                        <!-- Кнопка удаления -->
                        <q-icon name="delete" size="14px" color="negative" class="q-ml-xs cursor-pointer"
                          @click.stop="removeLayerWithConfirm(prop.node.layerId)" :title="'Удалить слой'" />
                      </template>

                      <!-- Индикаторы для элемента -->
                      <template v-else>
                        <q-icon v-if="prop.node.layerLocked" name="lock" size="12px" color="negative" class="q-ml-xs"
                          :title="`Слой ${prop.node.layerName} заблокирован`" />
                      </template>

                      <span class="tree-node-info">{{ prop.node.info }}</span>
                    </div>
                  </template>
                </q-tree>
              </q-card-section>
            </q-card>
          </template>
        </q-splitter>
      </template>

      <template v-slot:after>
        <div class="canvas-container">
          <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove"
            @mouseup="onCanvasMouseUp" @wheel.prevent="onWheel" @contextmenu.prevent @dragover="onDragOver"
            @drop="onDrop" tabindex="0">
          </canvas>
          <q-card class="selected-info-card" v-if="selectedElements.length > 0" :dark="isDarkTheme" square flat
            bordered>
            <q-card-section class="row items-center justify-between">
              <div class="q-m-none">Выбрано элементов: {{ selectedElements.length }}</div>
              <q-btn icon="close" flat dense v-close-popup @click="clearSelection" />
            </q-card-section>
            <div v-if="selectedElements.length === 1">
              <q-card-section class="row items-center justify-between">
                <q-list class="full-width" :dark="isDarkTheme" dense>
                  <q-item>
                    <q-item-section><q-item-label caption>ID</q-item-label></q-item-section>
                    <q-item-section><q-item-label>{{ selectedElement?.id }}</q-item-label></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label caption>Тип</q-item-label></q-item-section>
                    <q-item-section><q-item-label>{{ getElementTypeName(selectedElement)
                        }}</q-item-label></q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>

              <q-tabs v-model="tabElement" :dark="isDarkTheme" no-caps>
                <q-tab name="parameters" label="Параметры" />
                <q-tab name="positions" label="Позиция" />
                <q-tab name="callout" label="Выноска" />
                <q-tab name="links" label="Связи" />
              </q-tabs>

              <q-tab-panels v-model="tabElement" :dark="isDarkTheme" animated>
                <q-tab-panel name="parameters">
                  <div class="single-element-info">
                    <q-list dense>
                      <q-item v-for="param in getElementParameters(selectedElement)" :key="param.name">
                        <q-item-section class="param-label-col"><q-item-label>{{ param.label
                        }}:</q-item-label></q-item-section>
                        <q-item-section>
                          <q-toggle v-if="param.type === 'boolean'" :dark="isDarkTheme"
                            v-model="selectedElement[param.name]" :disable="isElementLocked(selectedElement)" />
                          <q-select :dark="isDarkTheme" v-else-if="param.type === 'select'"
                            v-model="selectedElement[param.name]" :options="param.options" option-label="label"
                            option-value="value" dense outlined emit-value map-options
                            :disable="isElementLocked(selectedElement)" />
                          <q-input :dark="isDarkTheme" v-else :type="param.type"
                            v-model.number="selectedElement[param.name]" :step="param.step" :min="param.min" dense
                            outlined :disable="isElementLocked(selectedElement)" />
                        </q-item-section>
                        <q-item-section side class="param-unit-col">
                          <span v-if="param.unit">{{ param.unit }}</span><span v-else>—</span>
                        </q-item-section>
                      </q-item>
                    </q-list>
                    <div v-if="isElementLocked(selectedElement)" class="text-negative q-mt-sm text-center">
                      <q-icon name="lock" size="14px" /> Элемент находится на заблокированном слое. Редактирование
                      недоступно.
                    </div>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="positions">
                  <div class="single-element-info">
                    <q-list dense>
                      <q-item>
                        <q-item-section class="param-label-col"><q-item-label>X (px):</q-item-label></q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.x" step="1" dense
                            outlined :disable="isElementLocked(selectedElement)"
                            @update:model-value="val => onParameterChange(val, 'x')" />
                        </q-item-section>
                      </q-item>
                      <q-item>
                        <q-item-section class="param-label-col"><q-item-label>Y (px):</q-item-label></q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.y" step="1" dense
                            outlined :disable="isElementLocked(selectedElement)"
                            @update:model-value="val => onParameterChange(val, 'y')" />
                        </q-item-section>
                      </q-item>
                      <q-item>
                        <q-item-section class="param-label-col"><q-item-label>Поворот
                            (°):</q-item-label></q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.rotation" step="1"
                            dense outlined :disable="isElementLocked(selectedElement)"
                            @update:model-value="val => onParameterChange(val, 'rotation')" />
                        </q-item-section>
                      </q-item>
                    </q-list>
                    <div class="q-mt-md">
                      <div class="text-subtitle2 q-mb-sm">Поворот</div>
                      <q-btn-group spread :dark="isDarkTheme">
                        <q-btn :dark="isDarkTheme" label="↺ 45°" @click="rotateLeft45"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" label="↻ 45°" @click="rotateRight45"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" label="↺ 90°" @click="rotateLeft90"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" label="↻ 90°" @click="rotateRight90"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" label="↺ 180°" @click="rotateLeft180"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" label="↻ 180°" @click="rotateRight180"
                          :disable="isElementLocked(selectedElement)" />
                      </q-btn-group>
                    </div>
                    <div class="q-mt-md">
                      <div class="text-subtitle2 q-mb-sm">Слои</div>
                      <q-btn-group :dark="isDarkTheme">
                        <q-btn :dark="isDarkTheme" icon="vertical_align_top" @click="moveToTop" label="Вверх"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" icon="arrow_upward" @click="moveUp" label="Выше"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" icon="arrow_downward" @click="moveDown" label="Ниже"
                          :disable="isElementLocked(selectedElement)" />
                        <q-btn :dark="isDarkTheme" icon="vertical_align_bottom" @click="moveToBottom" label="Вниз"
                          :disable="isElementLocked(selectedElement)" />
                      </q-btn-group>
                    </div>
                    <div v-if="isElementLocked(selectedElement)" class="text-negative q-mt-sm text-center">
                      <q-icon name="lock" size="14px" /> Элемент находится на заблокированном слое. Перемещение и
                      поворот недоступны.
                    </div>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="callout">
                  <div class="single-element-info">
                    <q-list dense>
                      <q-item>
                        <q-item-section class="param-label-col"><q-item-label>Показывать
                            выноску:</q-item-label></q-item-section>
                        <q-item-section>
                          <q-toggle :dark="isDarkTheme" v-model="selectedElement.showCallout"
                            :disable="isElementLocked(selectedElement)" @update:model-value="val => onParameterChange(val, 'showCallout')" />
                        </q-item-section>
                      </q-item>
                    </q-list>
                    <div v-if="isElementLocked(selectedElement)" class="text-negative q-mt-sm text-center">
                      <q-icon name="lock" size="14px" /> Элемент находится на заблокированном слое.
                    </div>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="links">
                  <div v-if="selectedElement?.ports?.length" class="connections-info">
                    <div v-for="port in selectedElement.ports" :key="port.id" class="connection-item">
                      <q-icon :name="port.isConnected?.() ? 'link' : 'link_off'"
                        :color="port.isConnected?.() ? 'positive' : 'negative'" size="16px" />
                      <span class="q-ml-sm">{{ port.side }} ({{ port.getDirectionName?.() || port.direction }})</span>

                      <div v-if="port.isConnected?.()" class="q-ml-auto">
                        <q-btn flat dense size="sm" color="primary" icon="open_in_new"
                          :label="`→ Элемент ${port.connectedElementId}`"
                          @click="gotoConnectedElement(port.connectedElementId)" class="connection-link-btn" />
                      </div>
                      <span v-else class="q-ml-auto text-negative">не подключен</span>
                    </div>
                  </div>
                  <div v-else class="text-center q-pa-md text-grey">
                    Нет портов у выбранного элемента
                  </div>
                </q-tab-panel>
              </q-tab-panels>
            </div>
            <q-card-section>
              <q-btn label="Удалить" icon="delete" color="negative" @click="deleteSelected" class="full-width" />
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount, readonly } from 'vue';
import { Notify } from 'quasar'
import { CanvasRenderer } from './CanvasRenderer.js';
import { ZIndexManager } from './ZIndexManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { SelectionManager } from './SelectionManager.js';
import { LayerManager } from './LayerManager.js';
import { BaseElement } from './Elements.js';
import { dragItems } from './dragItems.js';
import { DuctDirect } from './DuctDirect.js';
import { Transition } from './Transition.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { ElementFactory } from './ElementFactory.js';
import { globalScale } from './GlobalScale.js';

const showNotify = (options) => Notify.create(options);

// Состояние
const splitterModel1 = ref(20);
const splitterModel2 = ref(60);
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
const snapDistance = ref(10);

// Refs
const tabEditor = ref('library');
const tabElement = ref('parameters');
const mainCanvas = ref(null);
const selectedElements = ref([]);
const mouseWorldPos = ref(null);
const clipboardElements = ref([]);
const selectedTreeNode = ref(null);
const expandedTreeNodes = ref([]);

// Структура данных - слои
const layers = ref([
  { id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }
]);
const activeLayerId = ref('layer_default');

// ID счетчики
let nextElementId = 100;
let nextPortId = 1000;

// Менеджеры
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let selectionManager = null;
let layerManager = null;
let zIndexManager = null;
let storageManager = null;

// Drag and drop
let dragType = null;
let ghostElement = null;
let redrawTimeout = null;
let isUpdatingSelection = false;
let renderFrameRequest = null;

// Вычисляемые
const selectedElement = computed(() => selectedElements.value.length === 1 ? selectedElements.value[0] : null);

const allElements = computed(() => {
  if (!layers.value) return [];
  const result = [];
  for (const layer of layers.value) {
    result.push(...layer.elements);
  }
  return result;
});

const visibleElements = computed(() => {
  if (!layers.value) return [];
  const result = [];
  for (const layer of layers.value) {
    if (layer.visible) result.push(...layer.elements);
  }
  return result;
});

const interactiveElements = computed(() => {
  if (!layers.value) return [];
  const result = [];
  for (const layer of layers.value) {
    if (!layer.locked) result.push(...layer.elements);
  }
  return result;
});

const layerOptions = computed(() => layers.value.map(layer => ({
  label: `${layer.name} ${layer.locked ? '🔒' : ''} ${!layer.visible ? '👁️' : ''}`,
  value: layer.id
})));

// Построение дерева проекта
const projectTree = computed(() => {
  const buildElementNode = (item, layerInfo) => {
    return {
      id: item.id,
      label: `${item.name || item.id}`,
      icon: 'rectangle',
      color: item.color || '#888',
      info: '',
      element: item,
      layerId: layerInfo?.id,
      layerName: layerInfo?.name,
      layerLocked: layerInfo?.locked,
      layerVisible: layerInfo?.visible,
      isLayer: false,
    };
  };

  const result = [];
  for (const layer of layers.value) {
    result.push({
      id: `layer_${layer.id}`,
      label: layer.name,
      icon: layer.locked ? 'lock' : (layer.visible ? 'layers' : 'layers_clear'),
      color: layer.locked ? 'negative' : (layer.visible ? 'primary' : 'grey'),
      info: `${layer.elements.length} эл.`,
      children: layer.elements.map(el => buildElementNode(el, layer)),
      layerId: layer.id,
      layerName: layer.name,
      layerLocked: layer.locked,
      layerVisible: layer.visible,
      isLayer: true,
      element: null
    });
  }
  return result;
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
  snapDistance: readonly(snapDistance),
  autoUpdateConnections: readonly(autoUpdateConnections),
  showElementAxes: readonly(showElementAxes),
  isDarkTheme: readonly(isDarkTheme),
  gridStepM: readonly(gridStepM),
  mmPerPx: readonly(mmPerPx),
  mouseWorldPos
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

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
    selectedElements.value = newSelection;
    renderer?.setSelectedElements(newSelection);
    selectedTreeNode.value = (newSelection.length === 1 && newSelection[0]) ? newSelection[0].id : null;
    if (!skipRender) scheduleRender();
  } finally {
    isUpdatingSelection = false;
  }
};

const clearSelection = () => updateSelection([], true);

const onParameterChange = (value, paramName) => {
  if (!selectedElement.value) return;
  if (isElementLocked(selectedElement.value)) return;

  selectedElement.value[paramName] = value;
  selectedElement.value.updatePorts?.();
  selectedElement.value.updateCalloutText?.();

  if (connectionManager && autoUpdateConnections.value) {
    connectionManager.updateAllPortsAndConnections(snapDistance.value, layerManager);
  }

  scheduleRender();
};

// ========== УПРАВЛЕНИЕ СЛОЯМИ ==========

const addNewLayer = () => {
  const newLayer = layerManager.addLayer();
  activeLayerId.value = newLayer.id;
  layers.value = [...layers.value];
  showNotify({ type: 'positive', message: `Создан слой: ${newLayer.name}`, timeout: 2000 });
  scheduleRender();
};

const removeLayerWithConfirm = (layerId) => {
  if (layers.value.length === 1) {
    showNotify({ type: 'warning', message: 'Нельзя удалить последний слой!', timeout: 2000 });
    return;
  }
  const layer = layers.value.find(l => l.id === layerId);
  if (!layer) return;

  if (layer.elements.length > 0) {
    if (confirm(`Слой "${layer.name}" содержит ${layer.elements.length} элементов. Переместить их на первый слой?`)) {
      layerManager.removeLayer(layerId, layers.value[0].id);
      layers.value = [...layers.value];
      showNotify({ type: 'positive', message: `Слой "${layer.name}" удалён, элементы перемещены`, timeout: 2000 });
    } else return;
  } else {
    layerManager.removeLayer(layerId);
    layers.value = [...layers.value];
    showNotify({ type: 'positive', message: `Слой "${layer.name}" удалён`, timeout: 2000 });
  }
  scheduleRender();
};

const renameLayer = (layerId) => {
  const layer = layers.value.find(l => l.id === layerId);
  if (!layer) return;
  const newName = prompt('Введите новое имя слоя:', layer.name);
  if (newName?.trim()) {
    layerManager.renameLayer(layerId, newName.trim());
    layers.value = [...layers.value];
    scheduleRender();
  }
};

const setActiveLayer = (layerId) => {
  clearSelection();
  activeLayerId.value = layerId;
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Активный слой: ${layer.name}`, timeout: 1000 });
};

// ========== ОБРАБОТЧИКИ ДЕРЕВА ==========

const onTreeSelect = (nodeId) => {
  if (!nodeId) return;

  const findNode = (nodes) => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.children?.length) {
        const found = findNode(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const foundNode = findNode(projectTree.value);
  if (!foundNode) return;

  if (foundNode.isLayer) {
    selectedTreeNode.value = nodeId;
    setActiveLayer(foundNode.layerId);
    showNotify({ type: 'info', message: `Выбран слой: ${foundNode.label} (${foundNode.info})`, timeout: 1500 });
    return;
  }

  if (foundNode.element) {
    updateSelection([foundNode.element]);
    if (renderer?.canvas) {
      const cx = renderer.canvas.clientWidth / 2;
      const cy = renderer.canvas.clientHeight / 2;
      renderOptions.panX.value = cx - foundNode.element.x * renderOptions.scale.value;
      renderOptions.panY.value = cy - foundNode.element.y * renderOptions.scale.value;
      scheduleRender();
    }
  }
};

const onExpandedChange = (val) => { expandedTreeNodes.value = val; };
const expandAllTree = () => {
  const getAllIds = (nodes) => {
    let ids = [];
    for (const node of nodes) {
      ids.push(node.id);
      if (node.children?.length) ids.push(...getAllIds(node.children));
    }
    return ids;
  };
  expandedTreeNodes.value = getAllIds(projectTree.value);
};
const collapseAllTree = () => { expandedTreeNodes.value = []; };
const onTreeNodeContextMenu = (event, node) => {
  event.preventDefault();
  if (node.isLayer) {
    showNotify({ type: 'info', message: `Слой: ${node.label}`, timeout: 1000 });
  } else if (node.element) {
    updateSelection([node.element]);
  }
};

const toggleLayerLock = (layerId) => {
  layerManager.toggleLayerLock(layerId);
  layers.value = [...layers.value];
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Слой "${layer.name}" ${layer.locked ? 'заблокирован' : 'разблокирован'}`, timeout: 1000 });
  scheduleRender();
};

const toggleLayerVisibility = (layerId) => {
  layerManager.toggleLayerVisibility(layerId);
  layers.value = [...layers.value];
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Слой "${layer.name}" ${layer.visible ? 'показан' : 'скрыт'}`, timeout: 1000 });
  scheduleRender();
};

const isElementLocked = (element) => {
  if (!element || !layerManager) return false;
  return layerManager.isLayerLocked(element);
};

// ========== КОПИРОВАНИЕ/ВСТАВКА ==========

const copySelected = () => {
  if (!selectedElements.value.length) return;
  clipboardElements.value = selectedElements.value.map(el => {
    const json = el.toJSON();
    json.callouts = [];
    return json;
  });
  showNotify({ type: 'positive', message: `Скопировано ${clipboardElements.value.length} элементов`, timeout: 2000 });
};

const pasteElements = () => {
  if (!clipboardElements.value.length) return;

  const activeLayer = layerManager.getActiveLayer();
  if (!activeLayer) {
    showNotify({ type: 'warning', message: 'Нет активного слоя для вставки', timeout: 2000 });
    return;
  }
  if (activeLayer.locked) {
    showNotify({ type: 'warning', message: 'Активный слой заблокирован!', timeout: 2000 });
    return;
  }

  const newElements = [];
  const oldIdToNewId = new Map();
  const offsetX = 50;
  const offsetY = 50;

  for (const json of clipboardElements.value) {
    const newJson = JSON.parse(JSON.stringify(json));
    const oldId = newJson.id;
    const newId = ++nextElementId;
    oldIdToNewId.set(oldId, newId);
    newJson.id = newId;

    if (newJson.ports) {
      newJson.ports.forEach(port => {
        port.id = ++nextPortId;
        port.elementId = newId;
        port.connectedElementId = null;
        port.connectedPortId = null;
      });
    }

    newJson.x = (newJson.x || 0) + offsetX;
    newJson.y = (newJson.y || 0) + offsetY;
    newJson.callouts = [];

    const el = ElementFactory.createFromJSON(newJson);
    if (el) {
      el.name = `${el.name.replace(/\s*\(копия.*\)\s*$/, '')} (копия)`;
      if (el.showCallout !== false) {
        const topLeft = el.getTopLeft();
        const calloutY = topLeft.y - 50;
        el.addCallout(el.x, calloutY);
        el.updateCalloutText();
      }
      newElements.push(el);
    }
  }

  // Восстанавливаем связи между скопированными элементами
  for (let i = 0; i < newElements.length; i++) {
    const newEl = newElements[i];
    const oldJson = clipboardElements.value[i];
    if (newEl.ports && oldJson.ports) {
      for (let pIdx = 0; pIdx < newEl.ports.length; pIdx++) {
        const newPort = newEl.ports[pIdx];
        const oldPort = oldJson.ports[pIdx];
        if (oldPort.connectedElementId && oldPort.connectedPortId) {
          const newTargetId = oldIdToNewId.get(oldPort.connectedElementId);
          if (newTargetId) {
            const targetElement = newElements.find(el => el.id === newTargetId);
            if (targetElement && targetElement.ports) {
              const targetPort = targetElement.ports.find(p => p.id === oldPort.connectedPortId);
              if (targetPort) {
                connectionManager.connectPorts(newPort, targetPort);
              }
            }
          }
        }
      }
    }
  }

  for (const el of newElements) {
    if (el.updatePorts) el.updatePorts();
  }

  activeLayer.elements.push(...newElements);
  layers.value = [...layers.value];
  updateSelection(newElements);
  scheduleRender();

  showNotify({ type: 'positive', message: `Вставлено ${newElements.length} элементов в слой "${activeLayer.name}"`, timeout: 2000 });
};

const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { e.preventDefault(); copySelected(); }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); pasteElements(); }
  else if (e.key === 'Delete' || e.key === 'Del') { e.preventDefault(); deleteSelected(); }
  else if (e.key === 'Escape') { e.preventDefault(); clearSelection(); }
};

// ========== СОХРАНЕНИЕ/ЗАГРУЗКА ==========

const saveToLocalStorage = () => {
  const data = {
    layers: layers.value.map(layer => ({
      id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked,
      elements: layer.elements.map(el => el.toJSON())
    })),
    activeLayerId: activeLayerId.value,
    nextElementId, nextPortId,
    panX: renderOptions.panX.value,
    panY: renderOptions.panY.value,
    scale: renderOptions.scale.value,
    showColors: showColors.value,
    showElementAxes: showElementAxes.value,
    isDarkTheme: isDarkTheme.value,
    showGrid: showGrid.value,
    showPorts: showPorts.value,
    snapToPorts: snapToPorts.value,
    autoUpdateConnections: autoUpdateConnections.value,
    showCallouts: showCallouts.value,
    gridStepM: gridStepM.value,
    mmPerPx: mmPerPx.value,
    version: '2.0'
  };
  localStorage.setItem('hvac_editor_data', JSON.stringify(data));
  showNotify({ type: 'positive', message: 'Сохранено!', timeout: 1000 });
};

const forceUpdateConnections = () => {
  if (connectionManager && autoUpdateConnections.value) {
    for (const el of allElements.value) {
      if (el.updatePorts) el.updatePorts();
    }
    const result = connectionManager.updateAllPortsAndConnections(snapDistance.value, layerManager);
    if (result.broken > 0 || result.connected > 0) {
      console.log(`Связи обновлены: разорвано ${result.broken}, создано ${result.connected}`);
    }
  }
};

const gotoConnectedElement = (elementId) => {
  const targetElement = allElements.value.find(el => el.id === elementId);
  if (!targetElement) {
    showNotify({ type: 'warning', message: `Элемент с ID ${elementId} не найден`, timeout: 2000 });
    return;
  }
  updateSelection([targetElement]);
  if (renderer?.canvas) {
    const cx = renderer.canvas.clientWidth / 2;
    const cy = renderer.canvas.clientHeight / 2;
    renderOptions.panX.value = cx - targetElement.x * renderOptions.scale.value;
    renderOptions.panY.value = cy - targetElement.y * renderOptions.scale.value;
    scheduleRender();
  }
  showNotify({ type: 'positive', message: `Переход к элементу: ${targetElement.name || targetElement.type}`, timeout: 1500 });
};

const loadFromLocalStorage = () => {
  const savedData = localStorage.getItem('hvac_editor_data');
  if (!savedData) {
    layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }];
    activeLayerId.value = 'layer_default';
    nextElementId = 100; nextPortId = 1000;
    updateSelection([]);
    scheduleRender();
    return;
  }
  try {
    const data = JSON.parse(savedData);
    if (data.layers?.length) {
      layers.value = data.layers.map(layer => ({
        ...layer,
        elements: (layer.elements || []).map(elJson => ElementFactory.createFromJSON(elJson))
      }));
    } else {
      const oldElements = data.elements?.map(elJson => ElementFactory.createFromJSON(elJson)) || [];
      layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: oldElements }];
    }

    activeLayerId.value = data.activeLayerId || layers.value[0]?.id || 'layer_default';
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
    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;

    for (const el of allElements.value) {
      el.updatePorts?.();
      el.updateCalloutText?.();
    }

    setTimeout(() => {
      const restored = connectionManager?.updateAllPortsAndConnections?.(snapDistance.value, layerManager);
      console.log(`Восстановлено: ${restored?.connected}, разорвано: ${restored?.broken}`);
      scheduleRender();
    }, 100);

    updateSelection([]);
    scheduleRender();
  } catch (error) {
    console.error(error);
    layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }];
    updateSelection([]);
    scheduleRender();
  }
};

const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }];
    activeLayerId.value = 'layer_default';
    nextElementId = 100; nextPortId = 1000;
    clipboardElements.value = [];
    updateSelection([]);
    scheduleRender();
  }
};

const updateAllPortsAndConnections = () => {
  const restored = connectionManager?.updateAllPortsAndConnections?.(snapDistance.value) || { broken: 0, connected: 0 };
  scheduleRender();
  showNotify({ type: 'positive', message: `Восстановлено: ${restored.connected}, разорвано: ${restored.broken}`, timeout: 2000 });
};

// ========== DRAG & DROP ==========

const createGhostElement = (type, x, y) => {
  const creators = {
    duct: () => new DuctDirect(-1, x, y),
    tee: () => new Tee(-1, x, y), elbow: () => new Elbow(-1, x, y),
    cross: () => new Cross(-1, x, y), transition: () => new Transition(-1, x, y)
  };
  return creators[type]?.() || null;
};

const onDragStart = (e, item) => {
  dragType = item.type;
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    ghostElement = createGhostElement(dragType, worldPos.x, worldPos.y);
    renderer?.setGhostElement(ghostElement);
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
  renderer?.clearGhostElement();
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
      renderer.setGhostElement(ghostElement);
      scheduleRender();
    }
  }
};

const onDrop = (e) => {
  e.preventDefault();
  if (!dragType) return;

  const activeLayer = layerManager.getActiveLayer();
  if (!activeLayer) {
    showNotify({ type: 'warning', message: 'Нет активного слоя для добавления элементов', timeout: 2000 });
    return;
  }
  if (activeLayer.locked) {
    showNotify({ type: 'warning', message: 'Активный слой заблокирован!', timeout: 2000 });
    return;
  }

  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    const creators = {
      duct: () => new DuctDirect(++nextElementId, worldPos.x, worldPos.y),
      tee: () => new Tee(++nextElementId, worldPos.x, worldPos.y),
      elbow: () => new Elbow(++nextElementId, worldPos.x, worldPos.y),
      cross: () => new Cross(++nextElementId, worldPos.x, worldPos.y),
      transition: () => new Transition(++nextElementId, worldPos.x, worldPos.y)
    };
    const el = creators[dragType]();
    el.updatePorts?.();
    el.updateCalloutText?.();

    // ДОБАВЛЯЕМ ВЫНОСКУ ДЛЯ НОВОГО ЭЛЕМЕНТА
    if (el.showCallout !== false) {
      const topLeft = el.getTopLeft();
      const calloutY = topLeft.y - 50;
      el.addCallout(el.x, calloutY);
      el.updateCalloutText();
    }

    activeLayer.elements.push(el);
    layers.value = [...layers.value];
    updateSelection([el]);
    scheduleRender();
  }
  ghostElement = null;
  dragType = null;
  renderer?.clearGhostElement();
  scheduleRender();
};

// ========== ОПЕРАЦИИ С ЭЛЕМЕНТАМИ ==========

const rotateElement = (angleDeg) => {
  if (!selectedElement.value) return;
  if (isElementLocked(selectedElement.value)) return;

  const el = selectedElement.value;
  el.rotation = (el.rotation + angleDeg + 360) % 360;
  el.updatePorts?.();
  el.updateCalloutText?.();

  if (connectionManager && autoUpdateConnections.value) {
    connectionManager.updateAllPortsAndConnections(snapDistance.value, layerManager);
  }
  scheduleRender();
};

const rotateLeft45 = () => rotateElement(-45);
const rotateRight45 = () => rotateElement(45);
const rotateLeft90 = () => rotateElement(-90);
const rotateRight90 = () => rotateElement(90);
const rotateLeft180 = () => rotateElement(-180);
const rotateRight180 = () => rotateElement(180);

const moveToTop = () => { if (selectedElement.value) { zIndexManager?.moveToTop(selectedElement.value); scheduleRender(); } };
const moveToBottom = () => { if (selectedElement.value) { zIndexManager?.moveToBottom(selectedElement.value); scheduleRender(); } };
const moveUp = () => { if (selectedElement.value) { zIndexManager?.moveUp(selectedElement.value); scheduleRender(); } };
const moveDown = () => { if (selectedElement.value) { zIndexManager?.moveDown(selectedElement.value); scheduleRender(); } };

const deleteSelected = () => {
  if (!selectedElements.value.length) return;
  const toDelete = new Set(selectedElements.value.map(el => el.id));

  for (const el of selectedElements.value) {
    connectionManager?.disconnectElement(el);
  }

  for (const layer of layers.value) {
    layer.elements = layer.elements.filter(el => !toDelete.has(el.id));
  }
  layers.value = [...layers.value];

  forceUpdateConnections();
  updateSelection([]);
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
      const currentIds = selectedElements.value.map(el => el.id).sort();
      const newIds = renderer.selectedElements.map(el => el.id).sort();
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        updateSelection([...renderer.selectedElements], true);
      }
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

const onGridStepChange = (val) => {
  gridStepM.value = Math.min(500, Math.max(50, parseInt(val) || 50));
  debouncedDraw();
};

const getElementTypeName = (el) => el?.getTypeName?.() || BaseElement.getAvailableTypes()[el?.type] || el?.type || 'Неизвестно';
const getElementParameters = (el) => el?.getParameters?.() || [];

// ========== ИНИЦИАЛИЗАЦИЯ ==========

onMounted(() => {
  globalScale.setMmPerPx(mmPerPx.value);
  if (localStorage.getItem('theme') === 'dark') isDarkTheme.value = true;

  if (!mainCanvas.value) {
    console.error('Canvas element not found');
    return;
  }

  storageManager = new StorageManager('hvac_editor_data');
  layerManager = new LayerManager(layers, activeLayerId);
  zIndexManager = new ZIndexManager(layers);
  connectionManager = new ConnectionManager(allElements, layerManager);
  renderer = new CanvasRenderer(mainCanvas.value, layers, renderOptions);
  selectionManager = new SelectionManager(allElements, renderer, layerManager);
  interactionManager = new InteractionManager(
    mainCanvas.value, allElements, renderer, connectionManager, selectionManager, renderOptions, layerManager
  );

  zIndexManager.setRenderer(renderer);
  interactionManager.setOnElementMoveCallback?.((moving) => {
    if (!isUpdatingSelection) updateSelection(moving, true);
  });
  interactionManager.setAutoUpdateConnections(autoUpdateConnections.value);
  watch(autoUpdateConnections, (val) => interactionManager?.setAutoUpdateConnections(val));

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

watch(mmPerPx, (val) => {
  globalScale.setMmPerPx(val);
  for (const el of allElements.value) {
    el.updatePorts?.();
    el.updateCalloutText?.();
  }
  debouncedDraw();
});

</script>
