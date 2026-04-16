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
                <div>Диспетчер проекта</div>
                <div>
                  <q-btn icon="add" label="Слой" flat dense size="sm" @click="addNewLayer" />
                </div>
              </q-card-section>
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

                        <!-- Индикатор активного слоя -->
                        <q-icon v-if="activeLayerId === prop.node.layerId" name="check_circle" size="14px"
                          color="positive" class="q-ml-xs" :title="'Активный слой'" />

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
        <q-splitter horizontal :dark="isDarkTheme" v-model="splitterModel3">
          <template v-slot:before>
            <q-splitter vertical :dark="isDarkTheme" v-model="splitterModel4">
              <template v-slot:before>
                <div class="canvas-container">
                  <canvas class="main-canvas" ref="mainCanvas" @mousedown="onCanvasMouseDown"
                    @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" @wheel.prevent="onWheel"
                    @contextmenu.prevent @dragover="onDragOver" @drop="onDrop" tabindex="0">
                  </canvas>
                </div>
              </template>
              <template v-slot:after>
                <q-card v-if="selectedElements.length > 0" :dark="isDarkTheme" square flat>
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
                              <q-item-section class="param-label-col">
                                <q-item-label>
                                  {{ param.label }}:
                                </q-item-label>
                              </q-item-section>
                              <q-item-section>
                                <q-toggle v-if="param.type === 'boolean'" :dark="isDarkTheme"
                                  v-model="selectedElement[param.name]" :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, selectedElement[param.name])" />
                                <q-select :dark="isDarkTheme" v-else-if="param.type === 'select'"
                                  v-model="selectedElement[param.name]" :options="param.options" option-label="label"
                                  option-value="value" dense outlined emit-value map-options
                                  :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, selectedElement[param.name])" />
                                <q-input :dark="isDarkTheme" v-else :type="param.type"
                                  v-model.number="selectedElement[param.name]" :step="param.step" :min="param.min" dense
                                  outlined :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, selectedElement[param.name])" />
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
                              <q-item-section class="param-label-col"><q-item-label>X
                                  (px):</q-item-label></q-item-section>
                              <q-item-section>
                                <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.x" step="1"
                                  dense outlined :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'x')" />
                              </q-item-section>
                            </q-item>
                            <q-item>
                              <q-item-section class="param-label-col"><q-item-label>Y
                                  (px):</q-item-label></q-item-section>
                              <q-item-section>
                                <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.y" step="1"
                                  dense outlined :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'y')" />
                              </q-item-section>
                            </q-item>
                            <q-item>
                              <q-item-section class="param-label-col"><q-item-label>Поворот
                                  (°):</q-item-label></q-item-section>
                              <q-item-section>
                                <q-input :dark="isDarkTheme" type="number" v-model.number="selectedElement.rotation"
                                  step="1" dense outlined :disable="isElementLocked(selectedElement)"
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
                                  :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'showCallout')" />
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
                            <span class="q-ml-sm">{{ port.side }} ({{ port.getDirectionName?.() || port.direction
                            }})</span>

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
                <q-card v-else :dark="isDarkTheme" square flat>
                  <q-card-section>
                    Выберите элемент
                  </q-card-section>
                </q-card>
              </template>
            </q-splitter>
          </template>
          <template v-slot:after>
            <div class="q-pa-sm fit">
              <q-table flat dense :rows="activeLayer.elements" :columns="columns" row-key="id" :dark="isDarkTheme"
                virtual-scroll v-model:pagination="pagination" :rows-per-page-options="[0]" selection="multiple"
                :selected="tableSelectedRows" @update:selected="onTableSelectionChange" @row-click="onTableRowClick"
                style="height: 100%;">
                <template v-slot:top>
                  <q-card-section class="q-pa-sm row full-width">
                    <q-input :dark="isDarkTheme" type="text" v-model.text="activeLayer.name" dense outlined />
                  </q-card-section>
                </template>
              </q-table>
            </div>
          </template>
        </q-splitter>
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
import { ClipboardManager } from './ClipboardManager.js';
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

document.title = 'Редактор воздуховодов онлайн';

const showNotify = (options) => Notify.create(options);

// Состояние
const splitterModel1 = ref(20);
const splitterModel2 = ref(60);
const splitterModel3 = ref(70);
const splitterModel4 = ref(80);
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

// таблица
const columns = ref([
  { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
  { name: 'type', label: 'Тип', field: (row) => getElementTypeName(row), sortable: true, align: 'left' },
  { name: 'name', label: 'Имя', field: 'name', sortable: true, align: 'left' },
  { name: 'a', label: 'A, мм', field: 'a', sortable: true, align: 'left' },
  { name: 'b', label: 'B, мм', field: 'b', sortable: true, align: 'left' },
  { name: 'c', label: 'C, мм', field: (row) => (row.c !== undefined ? row.c : '-'), sortable: true, align: 'left' },
]);
const pagination = ref({
  rowsPerPage: 0
})
const tableSelectedRows = ref([]);

// Синхронизация из таблицы -> в selectionManager и дерево
const onTableSelectionChange = (selectedRows) => {
  if (selectedRows.length === 0) {
    updateSelection([]);
    tableSelectedRows.value = [];
    return;
  }

  // Находим реальные объекты элементов
  const selectedElementsList = selectedRows
    .map(row => {
      // Поиск элемента в слоях по id
      for (const layer of layers.value) {
        const found = layer.elements.find(el => el.id === row.id);
        if (found) return found;
      }
      return null;
    })
    .filter(el => el !== null);

  updateSelection(selectedElementsList);
  tableSelectedRows.value = selectedRows;
};
const onTableRowClick = (evt, row) => {
  const element = allElements.value.find(el => el.id === row.id);
  if (element) {
    if (evt.ctrlKey || evt.metaKey) {
      // Множественный выбор с Ctrl
      const currentSelection = [...selectedElements.value];
      const index = currentSelection.findIndex(el => el.id === element.id);
      if (index === -1) {
        currentSelection.push(element);
      } else {
        currentSelection.splice(index, 1);
      }
      updateSelection(currentSelection);
    } else {
      // Одиночный выбор
      updateSelection([element]);
      renderer.centerOnElement(element, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight)
    }
  }
};
// Синхронизация из selectionManager -> в таблицу
const syncTableWithSelection = () => {
  if (selectedElements.value.length === 0) {
    tableSelectedRows.value = [];
    return;
  }

  // Создаем массив строк для таблицы на основе выбранных элементов
  const selectedRowsData = selectedElements.value.map(el => ({
    id: el.id,
    type: el.getTypeName?.() || el.type,
    name: el.name || `${el.type}_${el.id}`
  }));

  tableSelectedRows.value = selectedRowsData;
};

// Структура данных - слои
const layers = ref([
  { id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }
]);
const activeLayerId = ref('layer_default');
const activeLayer = computed(() => layers.value.find(l => l.id === activeLayerId.value));

const traceMode = ref('8dir');
const isTraceModeActive = ref(false);
const traceStartPort = ref(null);


// Отмена режима рисования
const cancelTraceMode = () => {
  isTraceModeActive.value = false;
  interactionManager?.cancelTrace();
  scheduleRender();
};


// Менеджеры
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let selectionManager = null;
let layerManager = null;
let zIndexManager = null;
let storageManager = null;
let clipboardManager = null;

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
      icon: 'layers',
      color: 'primary',
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
  mouseWorldPos,
  traceMode: readonly(traceMode),
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

    // Синхронизируем с таблицей
    if (newSelection.length === 0) {
      tableSelectedRows.value = [];
    } else {
      const selectedRowsData = newSelection.map(el => ({
        id: el.id,
        type: el.getTypeName?.() || el.type,
        name: el.name || `${el.type}_${el.id}`
      }));
      tableSelectedRows.value = selectedRowsData;
    }

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
    return;
  }

  if (foundNode.element) {
    updateSelection([foundNode.element]);
    renderer.centerOnElement(foundNode.element, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight)
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
  if (selectedElements.value.length) {
    clipboardManager.copy(selectedElements.value);
    showNotify({ type: 'positive', message: `Скопировано ${selectedElements.value.length} элементов`, timeout: 2000 });
  }
};

const pasteElements = () => {
  const newElements = clipboardManager.paste(50, 50);
  if (newElements.length) {
    layers.value = [...layers.value];
    updateSelection(newElements);
    scheduleRender();
    showNotify({ type: 'positive', message: `Вставлено ${newElements.length} элементов`, timeout: 2000 });
  } else {
    showNotify({ type: 'warning', message: 'Не удалось вставить элементы (возможно, слой заблокирован)', timeout: 2000 });
  }
};

const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { e.preventDefault(); copySelected(); }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); pasteElements(); }
  else if (e.key === 'Delete' || e.key === 'Del') { e.preventDefault(); deleteSelected(); }
  else if (e.key === 'Escape') {
    e.preventDefault();
    clearSelection();
    if (isTraceModeActive.value) cancelTraceMode();
  }
};

// ========== СОХРАНЕНИЕ/ЗАГРУЗКА ==========

const saveToLocalStorage = () => {
  const counters = layerManager.getCounters();
  storageManager.saveFullState({
    layers: layers.value,
    activeLayerId: activeLayerId.value,
    nextElementId: counters.nextElementId,
    nextPortId: counters.nextPortId,
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
  });
  showNotify({ type: 'positive', message: 'Сохранено!', timeout: 1000 });
};


const gotoConnectedElement = (elementId) => {
  const targetElement = allElements.value.find(el => el.id === elementId);
  if (!targetElement) {
    showNotify({ type: 'warning', message: `Элемент с ID ${elementId} не найден`, timeout: 2000 });
    return;
  }
  updateSelection([targetElement]);
  renderer.centerOnElement(targetElement, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight);
  showNotify({ type: 'positive', message: `Переход к элементу: ${targetElement.name || targetElement.type}`, timeout: 1500 });
};

const loadFromLocalStorage = () => {
  const data = storageManager.loadFullState();
  if (!data) {
    // сброс в defaults
    resetToDefault();
    return;
  }
  try {
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

    // Вычисляем максимальные ID из загруженных элементов
    const allEls = allElements.value;
    const maxElementId = Math.max(0, ...allEls.map(el => el.id || 0), data.nextElementId || 100);
    const maxPortId = Math.max(0, ...allEls.flatMap(el => el.ports?.map(p => p.id) || []), data.nextPortId || 1000);

    layerManager?.setCounters(maxElementId, maxPortId);

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
    layerManager?.setCounters(100, 1000);
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

const onDragStart = (e, item) => {
  dragType = item.type;
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) {
    ghostElement = ElementFactory.createGhostElement(dragType, worldPos.x, worldPos.y);
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
    const newId = layerManager.getNextElementId();
    const creators = {
      duct: () => new DuctDirect(newId, worldPos.x, worldPos.y),
      tee: () => new Tee(newId, worldPos.x, worldPos.y),
      elbow: () => new Elbow(newId, worldPos.x, worldPos.y),
      cross: () => new Cross(newId, worldPos.x, worldPos.y),
      transition: () => new Transition(newId, worldPos.x, worldPos.y)
    };

    const el = creators[dragType](newId, worldPos.x, worldPos.y);
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
  const ids = selectedElements.value.map(el => el.id);
  for (const el of selectedElements.value) {
    connectionManager?.disconnectElement(el);
  }
  layerManager.removeElementsByIds(ids);
  layers.value = [...layers.value];
  if (autoUpdateConnections.value) {
    connectionManager.updateAllPortsAndConnections(snapDistance.value, layerManager);
  }
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
  clipboardManager = new ClipboardManager(layerManager, connectionManager);
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
  interactionManager.setOnElementCreated((element) => {
    layers.value = [...layers.value];
    updateSelection([element]);
    scheduleRender();
  });
  interactionManager.setOnTraceStart((port) => {
    isTraceModeActive.value = true;
  });

  interactionManager.setOnError((message) => {
    showNotify({ type: 'warning', message, timeout: 2000 });
  });

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
watch(selectedElements, () => {
  syncTableWithSelection();
}, { deep: true });
</script>
