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
                  <q-btn icon="folder" label="Группа" flat dense size="sm" @click="groupSelected" :disable="selectedElements.length < 2" />
                </div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn @click="updateAllPortsAndConnections" color="info" icon="sync" dense size="sm" />
                <q-btn @click="copySelected" color="secondary" icon="content_copy" v-if="selectedElements.length > 0" dense size="sm"/>
                <q-btn @click="pasteElements" color="secondary" icon="content_paste" v-if="clipboardElements.length > 0" dense size="sm"/>
                <q-btn @click="expandAllTree" icon="unfold_more" dense size="sm" flat />
                <q-btn @click="collapseAllTree" icon="unfold_less" dense size="sm" flat />
              </q-card-actions>
              <q-card-section class="q-pt-none">
                <q-tree :dark="isDarkTheme" :nodes="projectTree" :expanded="expandedTreeNodes"
                  @update:expanded="onExpandedChange" node-key="id" label-key="label" children-key="children"
                  no-connectors @update:selected="onTreeSelect" :selected.sync="selectedTreeNode"
                  default-expand-all>
                  <template v-slot:default-header="prop">
                    <div :class="['tree-node', { 'tree-node-selected': prop.node.id === selectedTreeNode }]"
                         @contextmenu.prevent="onTreeNodeContextMenu($event, prop.node)">
                      <q-icon :name="prop.node.icon" :color="prop.node.color" size="20px" class="q-mr-sm" />
                      <span class="tree-node-label">{{ prop.node.label }}</span>
                      <q-icon v-if="prop.node.layerLocked" name="lock" size="14px" color="negative" class="q-ml-xs" />
                      <q-icon v-if="!prop.node.layerVisible" name="visibility_off" size="14px" color="grey" class="q-ml-xs" />
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
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>Слой</q-item-label>
                    </q-item-section>
                    <q-item-section>
                      <q-select :dark="isDarkTheme" v-model="selectedElementLayer"
                        :options="layerOptions" label="Слой" dense outlined
                        @update:model-value="onElementLayerChange" />
                    </q-item-section>
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
                        <q-item-section class="param-label-col">
                          <q-item-label>{{ param.label }}:</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-toggle v-if="param.type === 'boolean'" :dark="isDarkTheme"
                            v-model="selectedElement[param.name]"
                            @update:model-value="val => onParameterChange(val, param.name)" />
                          <q-select :dark="isDarkTheme" v-else-if="param.type === 'select'"
                            v-model="selectedElement[param.name]" :disable="isGroupSelected" :options="param.options"
                            option-label="label" option-value="value" dense outlined emit-value map-options
                            @update:model-value="(val) => onParameterChange(val, param.name)" />
                          <q-input :dark="isDarkTheme" v-else :type="param.type"
                            v-model.number="selectedElement[param.name]" :step="param.step" :min="param.min" dense
                            outlined @update:model-value="val => onParameterChange(val, param.name)" />
                        </q-item-section>
                        <q-item-section side class="param-unit-col">
                          <span v-if="param.unit">{{ param.unit }}</span>
                          <span v-else>—</span>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-tab-panel>
                <q-tab-panel name="positions">
                  <div class="single-element-info">
                    <q-list dense>
                      <q-item>
                        <q-item-section class="param-label-col">
                          <q-item-label>X (px):</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.x" step="1" dense
                            outlined @update:model-value="val => onParameterChange(val, 'x')" />
                        </q-item-section>
                      </q-item>
                      <q-item>
                        <q-item-section class="param-label-col">
                          <q-item-label>Y (px):</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.y" step="1" dense
                            outlined @update:model-value="val => onParameterChange(val, 'y')" />
                        </q-item-section>
                      </q-item>
                      <q-item>
                        <q-item-section class="param-label-col">
                          <q-item-label>Поворот (°):</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.rotation" step="1"
                            dense outlined @update:model-value="val => onParameterChange(val, 'rotation')" />
                        </q-item-section>
                      </q-item>
                    </q-list>
                    <div class="q-mt-md">
                      <div class="text-subtitle2 q-mb-sm">Поворот</div>
                      <q-btn-group spread :dark="isDarkTheme">
                        <q-btn :dark="isDarkTheme" label="↺ 90°" @click="rotateLeft90" />
                        <q-btn :dark="isDarkTheme" label="↻ 90°" @click="rotateRight90" />
                        <q-btn :dark="isDarkTheme" label="↺ 180°" @click="rotateLeft180" />
                        <q-btn :dark="isDarkTheme" label="↻ 180°" @click="rotateRight180" />
                      </q-btn-group>
                    </div>
                    <div class="q-mt-md">
                      <div class="text-subtitle2 q-mb-sm">Слои</div>
                      <q-btn-group :dark="isDarkTheme">
                        <q-btn :dark="isDarkTheme" icon="vertical_align_top" @click="moveToTop" label="Вверх" />
                        <q-btn :dark="isDarkTheme" icon="arrow_upward" @click="moveUp" label="Выше" />
                        <q-btn :dark="isDarkTheme" icon="arrow_downward" @click="moveDown" label="Ниже" />
                        <q-btn :dark="isDarkTheme" icon="vertical_align_bottom" @click="moveToBottom" label="Вниз" />
                      </q-btn-group>
                    </div>
                  </div>
                </q-tab-panel>
                <q-tab-panel name="callout">
                  <div class="single-element-info">
                    <q-list dense>
                      <q-item>
                        <q-item-section class="param-label-col">
                          <q-item-label>Показывать выноску:</q-item-label>
                        </q-item-section>
                        <q-item-section>
                          <q-toggle :dark="isDarkTheme" v-model="selectedElement.showCallout"
                            @update:model-value="val => onParameterChange(val, 'showCallout')" />
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-tab-panel>
                <q-tab-panel name="links">
                  <div v-if="selectedElement?.ports && selectedElement.ports.length > 0" class="connections-info">
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
              <q-btn label="Сгруппировать" icon="folder" color="primary" :disable="selectedElements.length < 2"
                @click="groupSelected" class="full-width q-mb-sm" />
              <q-btn label="Разгруппировать" icon="folder_open" color="warning" :disable="!isGroupSelected"
                @click="ungroupSelected" class="full-width" />
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
import { ref, onMounted, computed, watch, onBeforeUnmount, readonly } from 'vue';
import { Notify } from 'quasar'
import { CanvasRenderer } from './CanvasRenderer.js';
import { ZIndexManager } from './ZIndexManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { SelectionManager } from './SelectionManager.js';
import { LayerManager } from './LayerManager.js';
import { BaseElement, dragItems } from './Elements.js';
import { Group } from './Group.js';
import { DuctDirect } from './DuctDirect.js';
import { Transition } from './Transition.js';
import { Elbow } from './Elbow.js';
import { Cross } from './Cross.js';
import { Tee } from './Tee.js';
import { Fan } from './Fan.js';
import { ElementFactory } from './ElementFactory.js';
import { globalScale } from './GlobalScale.js';

const showNotify = (options) => {
  Notify.create(options);
};

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

// Refs
const tabEditor = ref('library');
const tabElement = ref('parameters');
const mainCanvas = ref(null);
const selectedElements = ref([]);
const mouseWorldPos = ref(null);
const clipboardElements = ref([]);
const selectedTreeNode = ref(null);
const expandedTreeNodes = ref([]);

// Новая структура данных - слои
const layers = ref([
  {
    id: 'layer_default',
    name: 'Слой 1',
    visible: true,
    locked: false,
    elements: []
  }
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
const isGroupSelected = computed(() => selectedElement.value instanceof Group);

// Получение всех элементов из всех слоёв
const allElements = computed(() => {
  if (!layers.value) return [];
  return layers.value.flatMap(layer => layer.elements);
});

// Получение видимых элементов для рендера
const visibleElements = computed(() => {
  if (!layers.value) return [];
  return layers.value.flatMap(layer =>
    layer.visible ? layer.elements : []
  );
});

// Получение интерактивных элементов (не заблокированных)
const interactiveElements = computed(() => {
  if (!layers.value) return [];
  return layers.value.flatMap(layer =>
    !layer.locked ? layer.elements : []
  );
});

// Опции для выбора слоя в панели свойств
const layerOptions = computed(() => {
  return layers.value.map(layer => ({
    label: `${layer.name} ${layer.locked ? '🔒' : ''} ${!layer.visible ? '👁️' : ''}`,
    value: layer.id
  }));
});

const selectedElementLayer = computed({
  get: () => {
    if (!selectedElement.value) return null;
    const layer = layerManager?.getElementLayer(selectedElement.value);
    return layer?.id || null;
  },
  set: (val) => {}
});

// Построение дерева проекта с иерархией слоёв
const projectTree = computed(() => {
  const buildElementNode = (item, layerInfo = null) => {
    if (item instanceof Group) {
      return {
        id: item.id,
        label: item.name || `Группа ${item.id}`,
        icon: 'folder',
        color: 'orange',
        info: `${item.elements?.length || 0} эл.`,
        children: (item.elements || []).map(el => buildElementNode(el, layerInfo)),
        element: item,
        layerId: layerInfo?.id,
        layerName: layerInfo?.name,
        layerLocked: layerInfo?.locked,
        layerVisible: layerInfo?.visible
      };
    }

    return {
      id: item.id,
      label: `${BaseElement.getAvailableTypes()[item.type] || item.type}: ${item.name || item.id}`,
      icon: 'rectangle',
      color: item.color || '#888',
      info: '',
      element: item,
      layerId: layerInfo?.id,
      layerName: layerInfo?.name,
      layerLocked: layerInfo?.locked,
      layerVisible: layerInfo?.visible
    };
  };

  // Строим дерево: сначала слои, внутри них элементы и группы
  const treeNodes = layers.value.map(layer => {
    // Фильтруем элементы верхнего уровня (не входящие в группы)
    const topLevelElements = layer.elements.filter(el => {
      // Проверяем, не входит ли элемент в какую-либо группу
      let isInGroup = false;
      for (const otherEl of layer.elements) {
        if (otherEl instanceof Group && otherEl.elements?.includes(el)) {
          isInGroup = true;
          break;
        }
      }
      return !isInGroup;
    });

    return {
      id: `layer_${layer.id}`,
      label: layer.name,
      icon: layer.locked ? 'lock' : (layer.visible ? 'layers' : 'layers_clear'),
      color: layer.locked ? 'negative' : (layer.visible ? 'primary' : 'grey'),
      info: `${layer.elements.length} эл.`,
      children: topLevelElements.map(el => buildElementNode(el, layer)),
      layerId: layer.id,
      layerName: layer.name,
      layerLocked: layer.locked,
      layerVisible: layer.visible,
      isLayer: true
    };
  });

  return treeNodes;
});

// Обновление дерева и выделения
const updateTreeAndSelection = () => {
  if (selectedElement.value) {
    selectedTreeNode.value = selectedElement.value.id;
  }
};

// Обработчики дерева
const onTreeSelect = (nodeId) => {
  if (!nodeId) return;

  const findElement = (nodes) => {
    for (const node of nodes) {
      if (node.id === nodeId && node.element) return node.element;
      if (node.children) {
        const found = findElement(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const found = findElement(projectTree.value);
  if (found) {
    updateSelection([found]);
    if (renderer?.canvas) {
      const cx = renderer.canvas.clientWidth / 2;
      const cy = renderer.canvas.clientHeight / 2;
      renderOptions.panX.value = cx - found.x * renderOptions.scale.value;
      renderOptions.panY.value = cy - found.y * renderOptions.scale.value;
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
      if (node.children) {
        ids.push(...getAllIds(node.children));
      }
    }
    return ids;
  };
  expandedTreeNodes.value = getAllIds(projectTree.value);
};

const collapseAllTree = () => {
  expandedTreeNodes.value = [];
};

// Контекстное меню для дерева
const onTreeNodeContextMenu = (event, node) => {
  event.preventDefault();
  if (node.isLayer) {
    // Меню для слоя
    const actions = [
      { label: node.layerVisible ? 'Скрыть слой' : 'Показать слой', action: () => toggleLayerVisibility(node.layerId) },
      { label: node.layerLocked ? 'Разблокировать слой' : 'Заблокировать слой', action: () => toggleLayerLock(node.layerId) },
      { label: 'Переименовать', action: () => renameLayer(node.layerId) },
      { label: 'Удалить слой', action: () => removeLayerWithConfirm(node.layerId) }
    ];
    // Здесь можно показать кастомное меню
    showNotify({ type: 'info', message: `Слой: ${node.label}`, timeout: 1000 });
  } else if (node.element) {
    // Меню для элемента
    if (node.element instanceof Group) {
      const actions = [
        { label: 'Разгруппировать', action: () => { updateSelection([node.element]); ungroupSelected(); } },
        { label: 'Выделить все элементы', action: () => updateSelection(node.element.elements) }
      ];
    }
    updateSelection([node.element]);
  }
};

// Параметры рендерера
const renderOptions = {
  scale: ref(1), panX: ref(0), panY: ref(0),
  showGrid: readonly(showGrid), showPorts: readonly(showPorts), showColors: readonly(showColors),
  showCallouts: readonly(showCallouts), snapToPorts: readonly(snapToPorts),
  autoUpdateConnections: readonly(autoUpdateConnections), showElementAxes: readonly(showElementAxes),
  isDarkTheme: readonly(isDarkTheme), gridStepM: readonly(gridStepM), mmPerPx: readonly(mmPerPx), mouseWorldPos
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

const scheduleRender = () => {
  if (renderFrameRequest) return;
  renderFrameRequest = requestAnimationFrame(() => { renderer?.draw(); renderFrameRequest = null; });
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

    // Обновляем выделение в дереве
    if (newSelection.length === 1 && newSelection[0]) {
      selectedTreeNode.value = newSelection[0].id;
    } else {
      selectedTreeNode.value = null;
    }

    if (!skipRender) scheduleRender();
  } finally {
    isUpdatingSelection = false;
  }
};

const clearSelection = () => {
  updateSelection([], true);
  selectedTreeNode.value = null;
};

const onParameterChange = (value, paramName) => {
  if (!selectedElement.value) return;
  selectedElement.value[paramName] = value;
  selectedElement.value.updatePorts?.();
  selectedElement.value.updateCalloutText?.();
  if (connectionManager && autoUpdateConnections.value) connectionManager.updateAllPortsAndConnections(40);
  scheduleRender();
};

// ========== УПРАВЛЕНИЕ СЛОЯМИ ==========

const addNewLayer = () => {
  const newLayer = layerManager.addLayer();
  activeLayerId.value = newLayer.id;
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
      const firstLayer = layers.value[0];
      layerManager.removeLayer(layerId, firstLayer.id);
      showNotify({ type: 'positive', message: `Слой "${layer.name}" удалён, элементы перемещены`, timeout: 2000 });
    } else {
      return;
    }
  } else {
    layerManager.removeLayer(layerId);
    showNotify({ type: 'positive', message: `Слой "${layer.name}" удалён`, timeout: 2000 });
  }

  scheduleRender();
};

const toggleLayerVisibility = (layerId) => {
  layerManager.toggleLayerVisibility(layerId);
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Слой "${layer.name}" ${layer.visible ? 'показан' : 'скрыт'}`, timeout: 1000 });
  scheduleRender();
};

const toggleLayerLock = (layerId) => {
  layerManager.toggleLayerLock(layerId);
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Слой "${layer.name}" ${layer.locked ? 'заблокирован' : 'разблокирован'}`, timeout: 1000 });
  scheduleRender();
};

const setActiveLayer = (layerId) => {
  activeLayerId.value = layerId;
  const layer = layers.value.find(l => l.id === layerId);
  showNotify({ type: 'info', message: `Активный слой: ${layer.name}`, timeout: 1000 });
};

const renameLayer = (layerId) => {
  const layer = layers.value.find(l => l.id === layerId);
  if (!layer) return;

  const newName = prompt('Введите новое имя слоя:', layer.name);
  if (newName && newName.trim()) {
    layerManager.renameLayer(layerId, newName.trim());
    scheduleRender();
  }
};

const clearAllLayers = () => {
  if (confirm('Очистить все слои? Все элементы будут удалены!')) {
    layerManager.clearAllLayers();
    updateSelection([]);
    scheduleRender();
    showNotify({ type: 'positive', message: 'Все слои очищены', timeout: 2000 });
  }
};

const getActiveLayerName = () => {
  const layer = layers.value.find(l => l.id === activeLayerId.value);
  return layer?.name || '—';
};

const onElementLayerChange = (newLayerId) => {
  if (!selectedElement.value) return;
  if (layerManager.moveElementToLayer(selectedElement.value.id, newLayerId)) {
    showNotify({ type: 'positive', message: 'Элемент перемещён на другой слой', timeout: 1000 });
    scheduleRender();
    updateTreeAndSelection();
  }
};

// ========== КОПИРОВАНИЕ/ВСТАВКА ==========

const copySelected = () => {
  if (selectedElements.value.length === 0) return;
  if (selectedElements.value.some(el => el instanceof Group)) {
    showNotify({ type: 'warning', message: 'Нельзя копировать группы! Сначала разгруппируйте их', position: 'top', timeout: 3000 });
    return;
  }
  clipboardElements.value = selectedElements.value.map(el => ({ ...el.toJSON(), callouts: [] }));
  showNotify({ type: 'positive', message: `Скопировано ${clipboardElements.value.length} элементов`, position: 'top', timeout: 1000 });
};

const pasteElements = () => {
  if (clipboardElements.value.length === 0) return;
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
  clipboardElements.value.forEach(json => {
    const newJson = {
      ...json, id: ++nextElementId, x: json.x + 50, y: json.y + 50,
      ports: (json.ports || []).map(p => ({ ...p, id: ++nextPortId, connectedElementId: null, connectedPortId: null })),
      callouts: []
    };
    const el = ElementFactory.createFromJSON(newJson);
    el.name = `${el.name.replace(/\s*\(копия.*\)\s*$/, '')} (копия)`;
    el.updatePorts?.();
    el.addCallout?.(el.x, el.y - 150);
    newElements.push(el);
  });

  layerManager.addElementToActiveLayer(newElements);
  // Альтернативно: newElements.forEach(el => activeLayer.elements.push(el));
  updateSelection(newElements);
  scheduleRender();
  showNotify({ type: 'positive', message: `Вставлено ${newElements.length} элементов в слой "${activeLayer.name}"`, timeout: 2000 });
};

// ========== HOTKEYS ==========

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
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      elements: layer.elements.map(el => el.toJSON())
    })),
    activeLayerId: activeLayerId.value,
    nextElementId,
    nextPortId,
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
    version: '2.0',
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('hvac_editor_data', JSON.stringify(data));
  showNotify({ type: 'positive', message: 'Сохранено!', position: 'top', timeout: 1000 });
};

const loadFromLocalStorage = () => {
  const savedData = localStorage.getItem('hvac_editor_data');
  if (!savedData) {
    // Инициализация по умолчанию
    layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }];
    activeLayerId.value = 'layer_default';
    nextElementId = 100;
    nextPortId = 1000;
    updateSelection([]);
    scheduleRender();
    return;
  }

  try {
    const data = JSON.parse(savedData);

    // Загружаем слои
    if (data.layers && Array.isArray(data.layers)) {
      layers.value = data.layers.map(layer => ({
        ...layer,
        elements: (layer.elements || []).map(elJson => ElementFactory.createFromJSON(elJson))
      }));
    } else {
      // Совместимость со старой версией
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

    // Обновляем все порты и выноски
    allElements.value.forEach(el => {
      el.updatePorts?.();
      el.updateCalloutText?.();
    });

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
    nextElementId = 100;
    nextPortId = 1000;
    updateSelection([]);
    clipboardElements.value = [];
    scheduleRender();
  }
};

const updateAllPortsAndConnections = () => {
  const restored = connectionManager?.updateAllPortsAndConnections?.(5, layerManager) || 0;
  scheduleRender();
  showNotify({ type: 'positive', message: `Восстановлено ${restored} связей!`, position: 'top', timeout: 2000 });
};

// ========== DRAG & DROP ==========

const createGhostElement = (type, x, y) => {
  switch (type) {
    case 'duct': return new DuctDirect(-1, x, y);
    case 'fan': return new Fan(-1, x, y);
    case 'tee': return new Tee(-1, x, y);
    case 'elbow': return new Elbow(-1, x, y);
    case 'cross': return new Cross(-1, x, y);
    case 'transition': return new Transition(-1, x, y);
    default: return null;
  }
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
      fan: () => new Fan(++nextElementId, worldPos.x, worldPos.y),
      tee: () => new Tee(++nextElementId, worldPos.x, worldPos.y),
      elbow: () => new Elbow(++nextElementId, worldPos.x, worldPos.y),
      cross: () => new Cross(++nextElementId, worldPos.x, worldPos.y),
      transition: () => new Transition(++nextElementId, worldPos.x, worldPos.y)
    };
    const el = creators[dragType]();
    el.updatePorts?.();
    el.updateCalloutText?.();

    activeLayer.elements.push(el);
    updateSelection([el]);
    scheduleRender();
  }
  ghostElement = null;
  dragType = null;
  renderer?.clearGhostElement();
  scheduleRender();
};

// ========== ОПЕРАЦИИ С ЭЛЕМЕНТАМИ ==========

const rotateLeft90 = () => {
  if (!selectedElement.value) return;
  if (selectedElement.value instanceof Group) {
    const group = selectedElement.value;
    const centerX = group.x, centerY = group.y;
    const angle = -90 * Math.PI / 180;
    group.elements.forEach(el => {
      const dx = el.x - centerX, dy = el.y - centerY;
      el.x = centerX + (dx * Math.cos(angle) - dy * Math.sin(angle));
      el.y = centerY + (dx * Math.sin(angle) + dy * Math.cos(angle));
      el.rotation = (el.rotation - 90) % 360;
      el.updatePorts?.();
    });
    group.updateBounds();
    group.updateCalloutText();
  } else {
    selectedElement.value.rotation = (selectedElement.value.rotation - 90 + 360) % 360;
    selectedElement.value.updatePorts?.();
    selectedElement.value.updateCalloutText?.();
  }
  connectionManager?.updateAllPortsAndConnections(40);
  updateTreeAndSelection();
  scheduleRender();
};

const rotateRight90 = () => {
  if (!selectedElement.value) return;
  if (selectedElement.value instanceof Group) {
    const group = selectedElement.value;
    const centerX = group.x, centerY = group.y;
    const angle = 90 * Math.PI / 180;
    group.elements.forEach(el => {
      const dx = el.x - centerX, dy = el.y - centerY;
      el.x = centerX + (dx * Math.cos(angle) - dy * Math.sin(angle));
      el.y = centerY + (dx * Math.sin(angle) + dy * Math.cos(angle));
      el.rotation = (el.rotation + 90) % 360;
      el.updatePorts?.();
    });
    group.updateBounds();
    group.updateCalloutText();
  } else {
    selectedElement.value.rotation = (selectedElement.value.rotation + 90) % 360;
    selectedElement.value.updatePorts?.();
    selectedElement.value.updateCalloutText?.();
  }
  connectionManager?.updateAllPortsAndConnections(40);
  updateTreeAndSelection();
  scheduleRender();
};

const rotateLeft180 = () => { rotateLeft90(); rotateLeft90(); };
const rotateRight180 = () => { rotateRight90(); rotateRight90(); };

const moveToTop = () => { if (selectedElement.value) { zIndexManager?.moveToTop(selectedElement.value); scheduleRender(); } };
const moveToBottom = () => { if (selectedElement.value) { zIndexManager?.moveToBottom(selectedElement.value); scheduleRender(); } };
const moveUp = () => { if (selectedElement.value) { zIndexManager?.moveUp(selectedElement.value); scheduleRender(); } };
const moveDown = () => { if (selectedElement.value) { zIndexManager?.moveDown(selectedElement.value); scheduleRender(); } };

const deleteSelected = () => {
  if (selectedElements.value.length === 0) return;
  const toDelete = new Set(selectedElements.value.map(el => el.id));

  selectedElements.value.forEach(el => connectionManager?.disconnectElement(el));

  // Удаляем из слоёв
  for (const layer of layers.value) {
    layer.elements = layer.elements.filter(el => !toDelete.has(el.id));
  }

  updateSelection([]);
  scheduleRender();
};

const groupSelected = () => {
  if (selectedElements.value.length < 2) return;
  if (selectedElements.value.some(el => el instanceof Group)) {
    showNotify({ type: 'warning', message: 'Нельзя группировать группы!', position: 'top', timeout: 3000 });
    return;
  }

  // Проверяем, что все элементы из одного слоя
  const layersSet = new Set();
  for (const el of selectedElements.value) {
    const layer = layerManager.getElementLayer(el);
    if (layer) layersSet.add(layer.id);
  }

  if (layersSet.size > 1) {
    showNotify({ type: 'warning', message: 'Нельзя группировать элементы из разных слоёв!', position: 'top', timeout: 3000 });
    return;
  }

  const targetLayer = layerManager.getElementLayer(selectedElements.value[0]);
  if (!targetLayer) return;

  const group = new Group(++nextElementId, [...selectedElements.value]);
  group.updatePorts?.();

  const toRemove = new Set(selectedElements.value.map(el => el.id));
  targetLayer.elements = [...targetLayer.elements.filter(el => !toRemove.has(el.id)), group];

  updateSelection([group]);
  scheduleRender();
};

const ungroupSelected = () => {
  if (!isGroupSelected.value) return;
  const group = selectedElement.value;
  if (group.elements?.some(el => el instanceof Group)) {
    showNotify({ type: 'warning', message: 'Нельзя разгруппировать группу с вложенными группами!', position: 'top', timeout: 3000 });
    return;
  }

  const layer = layerManager.getElementLayer(group);
  if (!layer) return;

  const groupElements = group.getElements();
  const index = layer.elements.findIndex(el => el.id === group.id);
  if (index !== -1) {
    layer.elements.splice(index, 1, ...groupElements);
  }

  updateSelection(groupElements);
  scheduleRender();
};

// ========== CANVAS СОБЫТИЯ ==========

const onCanvasMouseDown = (e) => { if (dragType) return; interactionManager?.onMouseDown(e); updateSelection([...renderer?.selectedElements || []]); };
const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;
  if (dragType && ghostElement) {
    ghostElement.x = worldPos.x; ghostElement.y = worldPos.y;
    scheduleRender();
  } else {
    interactionManager?.onMouseMove(e);
    if (renderer?.selectedElements && !isUpdatingSelection) updateSelection([...renderer.selectedElements], true);
  }
};
const onCanvasMouseUp = (e) => { if (dragType) return; interactionManager?.onMouseUp(e); updateSelection([...renderer?.selectedElements || []]); scheduleRender(); };
const onWheel = (e) => { interactionManager?.onWheel(e); scheduleRender(); };
const onGridStepChange = (val) => { gridStepM.value = Math.min(500, Math.max(50, parseInt(val) || 50)); debouncedDraw(); };
const getElementTypeName = (el) => el?.getTypeName?.() || BaseElement.getAvailableTypes()[el?.type] || el?.type || 'Неизвестно';
const getElementParameters = (el) => el?.getParameters?.() || [];

// ========== ИНИЦИАЛИЗАЦИЯ ==========

onMounted(() => {
  globalScale.setMmPerPx(mmPerPx.value);
  if (localStorage.getItem('theme') === 'dark') isDarkTheme.value = true;

  storageManager = new StorageManager('hvac_editor_data');

  // Инициализация менеджеров в правильном порядке
  layerManager = new LayerManager(layers, activeLayerId);
  zIndexManager = new ZIndexManager(layers);
  connectionManager = new ConnectionManager(allElements, layerManager);
  renderer = new CanvasRenderer(mainCanvas.value, layers, renderOptions);
  selectionManager = new SelectionManager(allElements, renderer);
  interactionManager = new InteractionManager(
    mainCanvas.value, allElements, renderer, connectionManager, selectionManager, renderOptions, layerManager
  );

  // Устанавливаем связи между менеджерами
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
  ElementFactory.updateAllGroupsBounds(allElements.value);
  allElements.value.forEach(el => { el.updatePorts?.(); el.updateCalloutText?.(); });
  updateTreeAndSelection();
  debouncedDraw();
});
watch(allElements, () => {
  debouncedDraw();
  updateTreeAndSelection();
}, { deep: true });
watch(layers, () => {
  debouncedDraw();
  updateTreeAndSelection();
}, { deep: true });
</script>
