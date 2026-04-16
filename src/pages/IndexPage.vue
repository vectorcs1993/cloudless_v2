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
                      @dragstart="(e) => dragDropManager.onDragStart(e, item)"
                      @dragend="() => dragDropManager.onDragEnd()">
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
                <div><q-btn icon="add" label="Слой" flat dense size="sm" @click="addNewLayer" /></div>
              </q-card-section>
              <q-card-actions class="q-pa-sm">
                <q-btn @click="updateAllPortsAndConnections" icon="sync" dense flat size="sm" />
                <q-btn @click="copySelected" icon="content_copy" v-if="selectedElements.length > 0" dense flat
                  size="sm" />
                <q-btn @click="pasteElements" icon="content_paste" v-if="!clipboardManager?.isEmpty()" dense flat
                  size="sm" />
                <q-btn @click="expandAllTree" icon="unfold_more" dense flat size="sm" />
                <q-btn @click="collapseAllTree" icon="unfold_less" dense flat size="sm" />
              </q-card-actions>
              <q-card-section class="q-pt-none">
                <q-tree :dark="isDarkTheme" :nodes="treeManager.getProjectTree()"
                  :expanded="treeManager.getExpandedTreeNodes()"
                  @update:expanded="(val) => treeManager.setExpandedTreeNodes(val)" node-key="id" label-key="label"
                  children-key="children" no-connectors
                  @update:selected="(nodeId) => treeManager.onTreeSelect(nodeId, treeManager.getProjectTree())"
                  :selected="treeManager.getSelectedTreeNode()" default-expand-all>
                  <template v-slot:default-header="prop">
                    <div :class="['tree-node', {
                      'tree-node-selected': prop.node.id === treeManager.getSelectedTreeNode(),
                      'tree-node-layer': prop.node.isLayer,
                      'tree-node-layer-locked': prop.node.isLayer && prop.node.layerLocked,
                      'tree-node-layer-hidden': prop.node.isLayer && !prop.node.layerVisible
                    }]" @contextmenu.prevent="(e) => treeManager.onTreeNodeContextMenu(e, prop.node)">
                      <q-icon :name="prop.node.icon" :color="prop.node.color" size="20px" class="q-mr-sm" />
                      <span class="tree-node-label">{{ prop.node.label }}</span>
                      <template v-if="prop.node.isLayer">
                        <q-icon v-if="activeLayerId === prop.node.layerId" name="check_circle" size="14px"
                          color="positive" class="q-ml-xs" title="Активный слой" />
                        <q-icon :name="prop.node.layerLocked ? 'lock' : 'lock_open'" size="14px"
                          :color="prop.node.layerLocked ? 'negative' : 'positive'" class="q-ml-xs cursor-pointer"
                          @click.stop="toggleLayerLock(prop.node.layerId)"
                          :title="prop.node.layerLocked ? 'Разблокировать слой' : 'Заблокировать слой'" />
                        <q-icon :name="prop.node.layerVisible ? 'visibility' : 'visibility_off'" size="14px"
                          :color="prop.node.layerVisible ? 'primary' : 'grey'" class="q-ml-xs cursor-pointer"
                          @click.stop="toggleLayerVisibility(prop.node.layerId)"
                          :title="prop.node.layerVisible ? 'Скрыть слой' : 'Показать слой'" />
                        <q-icon name="delete" size="14px" color="negative" class="q-ml-xs cursor-pointer"
                          @click.stop="removeLayerWithConfirm(prop.node.layerId)" title="Удалить слой" />
                      </template>
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
                    @contextmenu.prevent @dragover="(e) => dragDropManager.onDragOver(e)" @drop="(e) => onDrop(e)"
                    tabindex="0"></canvas>
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
                        <q-item><q-item-section caption>ID</q-item-section><q-item-section>{{ selectedElement?.id
                        }}</q-item-section></q-item>
                        <q-item><q-item-section caption>Тип</q-item-section><q-item-section>{{
                          getElementTypeName(selectedElement) }}</q-item-section></q-item>
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
                              <q-item-section side class="param-unit-col"><span v-if="param.unit">{{ param.unit
                              }}</span><span v-else>—</span></q-item-section>
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
                            <q-item><q-item-section class="param-label-col">X
                                (px):</q-item-section><q-item-section><q-input :dark="isDarkTheme" type="number"
                                  v-model.number="selectedElement.x" step="1" dense outlined
                                  :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'x')" /></q-item-section></q-item>
                            <q-item><q-item-section class="param-label-col">Y
                                (px):</q-item-section><q-item-section><q-input :dark="isDarkTheme" type="number"
                                  v-model.number="selectedElement.y" step="1" dense outlined
                                  :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'y')" /></q-item-section></q-item>
                            <q-item><q-item-section class="param-label-col">Поворот
                                (°):</q-item-section><q-item-section><q-input :dark="isDarkTheme" type="number"
                                  v-model.number="selectedElement.rotation" step="1" dense outlined
                                  :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'rotation')" /></q-item-section></q-item>
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
                          <div v-if="isElementLocked(selectedElement)" class="text-negative q-mt-sm text-center"><q-icon
                              name="lock" size="14px" /> Элемент находится на заблокированном слое. Перемещение и
                            поворот недоступны.</div>
                        </div>
                      </q-tab-panel>
                      <q-tab-panel name="callout">
                        <div class="single-element-info">
                          <q-list dense>
                            <q-item><q-item-section class="param-label-col">Показывать
                                выноску:</q-item-section><q-item-section><q-toggle :dark="isDarkTheme"
                                  v-model="selectedElement.showCallout" :disable="isElementLocked(selectedElement)"
                                  @update:model-value="val => onParameterChange(val, 'showCallout')" /></q-item-section></q-item>
                          </q-list>
                          <div v-if="isElementLocked(selectedElement)" class="text-negative q-mt-sm text-center"><q-icon
                              name="lock" size="14px" /> Элемент находится на заблокированном слое.</div>
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
                        <div v-else class="text-center q-pa-md text-grey">Нет портов у выбранного элемента</div>
                      </q-tab-panel>
                    </q-tab-panels>
                  </div>
                  <q-card-section><q-btn label="Удалить" icon="delete" color="negative" @click="deleteSelected"
                      class="full-width" /></q-card-section>
                </q-card>
                <q-card v-else :dark="isDarkTheme" square flat><q-card-section>Выберите
                    элемент</q-card-section></q-card>
              </template>
            </q-splitter>
          </template>
          <template v-slot:after>
            <q-card class="layer-panel-container" :dark="isDarkTheme" flat>
              <q-tabs v-model="tabLayer" :dark="isDarkTheme" no-caps class="layer-tabs-fixed">
                <q-tab name="elements" label="Элементы слоя" />
                <q-tab name="settings" label="Настройки слоя" />
              </q-tabs>
              <q-tab-panels v-model="tabLayer" :dark="isDarkTheme" animated class="layer-panels-scrollable">
                <q-tab-panel name="elements" class="layer-panel-content">
                  <div class="fit">
                    <q-table flat dense :rows="activeLayer.elements" :columns="tableManager.getColumns().value"
                      row-key="id" :dark="isDarkTheme" virtual-scroll
                      v-model:pagination="tableManager.getPagination().value" :rows-per-page-options="[0]"
                      selection="multiple" :selected="tableManager.getSelectedRows().value"
                      @update:selected="(rows) => tableManager.onTableSelectionChange(rows, updateSelection)"
                      @row-click="(evt, row) => tableManager.onTableRowClick(evt, row, updateSelection)"
                      style="height: 100%;">
                    </q-table>
                  </div>
                </q-tab-panel>
                <q-tab-panel name="settings" class="layer-panel-content">
                  <q-card-section class="q-pa-sm row full-width">
                    <q-input :dark="isDarkTheme" type="text" v-model.text="activeLayer.name" dense outlined />
                  </q-card-section>
                </q-tab-panel>
              </q-tab-panels>
            </q-card>
          </template>
        </q-splitter>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount, readonly } from 'vue';
import { Notify } from 'quasar';
import { CanvasRenderer } from './CanvasRenderer.js';
import { ZIndexManager } from './ZIndexManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { ClipboardManager } from './ClipboardManager.js';
import { SelectionManager } from './SelectionManager.js';
import { LayerManager } from './LayerManager.js';
import { TreeManager } from './TreeManager.js';
import { TableManager } from './TableManager.js';
import { ElementOperationsManager } from './ElementOperationsManager.js';
import { DragDropManager } from './DragDropManager.js';
import { TraceManager } from './TraceManager.js';
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

// ========== РЕАКТИВНЫЕ ПЕРЕМЕННЫЕ ==========
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
const tabEditor = ref('library');
const tabLayer = ref('elements');
const tabElement = ref('parameters');
const mainCanvas = ref(null);
const selectedElements = ref([]);
const mouseWorldPos = ref(null);
const layers = ref([{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }]);
const activeLayerId = ref('layer_default');
const traceMode = ref('8dir');
const isTraceModeActive = ref(false);

const activeLayer = computed(() => layers.value.find(l => l.id === activeLayerId.value));
const selectedElement = computed(() => selectedElements.value.length === 1 ? selectedElements.value[0] : null);
const allElements = computed(() => layers.value.flatMap(layer => layer.elements));

// ========== ФУНКЦИИ (будут использоваться в менеджерах) ==========
// Заглушки, которые будут переопределены позже
let scheduleRender = () => { };
let updateSelection = (newSelection, skipRender = false) => { };

// Реальные реализации (будут присвоены после создания renderer)
let scheduleRenderReal = () => { };
let updateSelectionReal = (newSelection, skipRender = false) => { };

// Функции, не зависящие от менеджеров
const clearSelection = () => updateSelection([], true);

const setActiveLayer = (layerId) => {
  clearSelection();
  activeLayerId.value = layerId;
  showNotify({ type: 'info', message: `Активный слой: ${layers.value.find(l => l.id === layerId).name}`, timeout: 1000 });
};

const isElementLocked = (element) => layerManager?.isLayerLocked(element) || false;

const onParameterChange = (value, paramName) => {
  if (!selectedElement.value || isElementLocked(selectedElement.value)) return;
  selectedElement.value[paramName] = value;
  selectedElement.value.updatePorts?.();
  selectedElement.value.updateCalloutText?.();
  if (connectionManager && autoUpdateConnections.value)
    connectionManager.updateAllPortsAndConnections(snapDistance.value, layerManager);
  scheduleRender();
};

const gotoConnectedElement = (elementId) => {
  const target = allElements.value.find(el => el.id === elementId);
  if (!target) { showNotify({ type: 'warning', message: `Элемент с ID ${elementId} не найден`, timeout: 2000 }); return; }
  updateSelection([target]);
  renderer?.centerOnElement(target, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight);
  showNotify({ type: 'positive', message: `Переход к элементу: ${target.name || target.type}`, timeout: 1500 });
};

// Управление слоями
const addNewLayer = () => {
  const newLayer = layerManager.addLayer();
  activeLayerId.value = newLayer.id;
  layers.value = [...layers.value];
  showNotify({ type: 'positive', message: `Создан слой: ${newLayer.name}`, timeout: 2000 });
  scheduleRender();
};

const removeLayerWithConfirm = (layerId) => {
  if (layers.value.length === 1) { showNotify({ type: 'warning', message: 'Нельзя удалить последний слой!', timeout: 2000 }); return; }
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

const toggleLayerLock = (layerId) => {
  layerManager.toggleLayerLock(layerId);
  layers.value = [...layers.value];
  scheduleRender();
};

const toggleLayerVisibility = (layerId) => {
  layerManager.toggleLayerVisibility(layerId);
  layers.value = [...layers.value];
  scheduleRender();
};

// Копирование/вставка
const copySelected = () => {
  if (selectedElements.value.length) clipboardManager?.copy(selectedElements.value);
  showNotify({ type: 'positive', message: `Скопировано ${selectedElements.value.length} элементов`, timeout: 2000 });
};

const pasteElements = () => {
  const newElements = clipboardManager?.paste(50, 50) || [];
  if (newElements.length) {
    layers.value = [...layers.value];
    updateSelection(newElements);
    scheduleRender();
    showNotify({ type: 'positive', message: `Вставлено ${newElements.length} элементов`, timeout: 2000 });
  } else {
    showNotify({ type: 'warning', message: 'Не удалось вставить элементы (возможно, слой заблокирован)', timeout: 2000 });
  }
};

// Сохранение/загрузка
const saveToLocalStorage = () => {
  const counters = layerManager.getCounters();
  storageManager.saveFullState({
    layers: layers.value, activeLayerId: activeLayerId.value,
    nextElementId: counters.nextElementId, nextPortId: counters.nextPortId,
    panX: renderOptions.panX.value, panY: renderOptions.panY.value, scale: renderOptions.scale.value,
    showColors: showColors.value, showElementAxes: showElementAxes.value, isDarkTheme: isDarkTheme.value,
    showGrid: showGrid.value, showPorts: showPorts.value, snapToPorts: snapToPorts.value,
    autoUpdateConnections: autoUpdateConnections.value, showCallouts: showCallouts.value,
    gridStepM: gridStepM.value, mmPerPx: mmPerPx.value,
  });
  showNotify({ type: 'positive', message: 'Сохранено!', timeout: 1000 });
};

const loadFromLocalStorage = () => {
  const data = storageManager.loadFullState();
  if (!data) { resetToDefault(); return; }
  try {
    if (data.layers?.length) {
      layers.value = data.layers.map(layer => ({ ...layer, elements: (layer.elements || []).map(elJson => ElementFactory.createFromJSON(elJson)) }));
    } else {
      const oldElements = data.elements?.map(elJson => ElementFactory.createFromJSON(elJson)) || [];
      layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: oldElements }];
    }
    activeLayerId.value = data.activeLayerId || layers.value[0]?.id || 'layer_default';
    renderOptions.panX.value = data.panX || 0; renderOptions.panY.value = data.panY || 0; renderOptions.scale.value = data.scale || 1;
    showColors.value = data.showColors ?? true; showElementAxes.value = data.showElementAxes ?? false;
    isDarkTheme.value = data.isDarkTheme ?? false; showGrid.value = data.showGrid ?? false;
    showPorts.value = data.showPorts ?? false; snapToPorts.value = data.snapToPorts ?? false;
    autoUpdateConnections.value = data.autoUpdateConnections ?? false; showCallouts.value = data.showCallouts ?? false;
    gridStepM.value = data.gridStepM ?? 50; mmPerPx.value = data.mmPerPx ?? 2;
    const allEls = allElements.value;
    const maxElementId = Math.max(0, ...allEls.map(el => el.id || 0), data.nextElementId || 100);
    const maxPortId = Math.max(0, ...allEls.flatMap(el => el.ports?.map(p => p.id) || []), data.nextPortId || 1000);
    layerManager?.setCounters(maxElementId, maxPortId);
    for (const el of allElements.value) { el.updatePorts?.(); el.updateCalloutText?.(); }
    setTimeout(() => { connectionManager?.updateAllPortsAndConnections?.(snapDistance.value, layerManager); scheduleRender(); }, 100);
    updateSelection([]); scheduleRender();
  } catch (error) { console.error(error); resetToDefault(); }
};

const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    layers.value = [{ id: 'layer_default', name: 'Слой 1', visible: true, locked: false, elements: [] }];
    activeLayerId.value = 'layer_default';
    layerManager?.setCounters(100, 1000);
    updateSelection([]); scheduleRender();
  }
};

const updateAllPortsAndConnections = () => {
  const restored = connectionManager?.updateAllPortsAndConnections?.(snapDistance.value) || { broken: 0, connected: 0 };
  scheduleRender();
  showNotify({ type: 'positive', message: `Восстановлено: ${restored.connected}, разорвано: ${restored.broken}`, timeout: 2000 });
};

// Операции с элементами (обертки)
const rotateLeft45 = () => elementOpsManager?.rotateLeft45(selectedElement.value);
const rotateRight45 = () => elementOpsManager?.rotateRight45(selectedElement.value);
const rotateLeft90 = () => elementOpsManager?.rotateLeft90(selectedElement.value);
const rotateRight90 = () => elementOpsManager?.rotateRight90(selectedElement.value);
const rotateLeft180 = () => elementOpsManager?.rotateLeft180(selectedElement.value);
const rotateRight180 = () => elementOpsManager?.rotateRight180(selectedElement.value);
const moveToTop = () => elementOpsManager?.moveToTop(selectedElement.value);
const moveToBottom = () => elementOpsManager?.moveToBottom(selectedElement.value);
const moveUp = () => elementOpsManager?.moveUp(selectedElement.value);
const moveDown = () => elementOpsManager?.moveDown(selectedElement.value);
const deleteSelected = () => {
  elementOpsManager?.deleteSelected(selectedElements.value);
  updateSelection([]);
};

// Drag & Drop обертка
const onDrop = (e) => {
  if (!dragDropManager) return;
  const creatorsMap = {
    duct: (id, x, y) => new DuctDirect(id, x, y),
    tee: (id, x, y) => new Tee(id, x, y),
    elbow: (id, x, y) => new Elbow(id, x, y),
    cross: (id, x, y) => new Cross(id, x, y),
    transition: (id, x, y) => new Transition(id, x, y),
  };
  dragDropManager.onDrop(e, creatorsMap);
};

// События канваса
const onCanvasMouseDown = (e) => { if (dragDropManager?.dragType) return; interactionManager?.onMouseDown(e); updateSelection([...renderer?.selectedElements || []]); };
const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;
  if (dragDropManager?.dragType && dragDropManager?.ghostElement) {
    dragDropManager.ghostElement.x = worldPos.x;
    dragDropManager.ghostElement.y = worldPos.y;
    scheduleRender();
  } else {
    interactionManager?.onMouseMove(e);
    if (renderer?.selectedElements && !isUpdatingSelection) {
      const currentIds = selectedElements.value.map(el => el.id).sort();
      const newIds = renderer.selectedElements.map(el => el.id).sort();
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) updateSelection([...renderer.selectedElements], true);
    }
  }
};
const onCanvasMouseUp = (e) => { if (dragDropManager?.dragType) return; interactionManager?.onMouseUp(e); updateSelection([...renderer?.selectedElements || []]); scheduleRender(); };
const onWheel = (e) => { interactionManager?.onWheel(e); scheduleRender(); };
const onGridStepChange = (val) => { gridStepM.value = Math.min(500, Math.max(50, parseInt(val) || 50)); scheduleRender(); };
const getElementTypeName = (el) => el?.getTypeName?.() || BaseElement.getAvailableTypes()[el?.type] || el?.type || 'Неизвестно';
const getElementParameters = (el) => el?.getParameters?.() || [];

// Обработчики клавиш
const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') { e.preventDefault(); copySelected(); }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { e.preventDefault(); pasteElements(); }
  else if (e.key === 'Delete' || e.key === 'Del') { e.preventDefault(); deleteSelected(); }
  else if (e.key === 'Escape') { e.preventDefault(); clearSelection(); if (isTraceModeActive.value) traceManager?.cancelTrace(); }
};

// ========== СОЗДАНИЕ МЕНЕДЖЕРОВ (после объявления всех функций) ==========
let storageManager = new StorageManager('hvac_editor_data');
let layerManager = new LayerManager(layers, activeLayerId);
let zIndexManager = new ZIndexManager(layers);
let connectionManager = new ConnectionManager(allElements, layerManager);
let clipboardManager = new ClipboardManager(layerManager, connectionManager);

// Менеджеры, зависящие от колбэков (которые уже определены)
let treeManager = new TreeManager(layers, activeLayerId, setActiveLayer, (element) => {
  updateSelection([element]);
  renderer?.centerOnElement(element, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight);
}, showNotify);

let tableManager = new TableManager(layers, allElements, (element) => updateSelection([element]), (element) => renderer?.centerOnElement(element, renderer?.canvas.clientWidth, renderer?.canvas.clientHeight));

let elementOpsManager = new ElementOperationsManager(connectionManager, layerManager, autoUpdateConnections, snapDistance, zIndexManager, scheduleRender, showNotify);

// Менеджеры, зависящие от canvas (будут созданы в onMounted)
let renderer = null;
let selectionManager = null;
let interactionManager = null;
let dragDropManager = null;
let traceManager = null;

let redrawTimeout = null;
let isUpdatingSelection = false;
let renderFrameRequest = null;

// Параметры рендерера
const renderOptions = {
  scale: ref(1), panX: ref(0), panY: ref(0),
  showGrid: readonly(showGrid), showPorts: readonly(showPorts), showColors: readonly(showColors),
  showCallouts: readonly(showCallouts), snapToPorts: readonly(snapToPorts), snapDistance: readonly(snapDistance),
  autoUpdateConnections: readonly(autoUpdateConnections), showElementAxes: readonly(showElementAxes),
  isDarkTheme: readonly(isDarkTheme), gridStepM: readonly(gridStepM), mmPerPx: readonly(mmPerPx),
  mouseWorldPos, traceMode: readonly(traceMode),
};

// Реальные реализации scheduleRender и updateSelection
scheduleRenderReal = () => {
  if (renderFrameRequest) return;
  renderFrameRequest = requestAnimationFrame(() => {
    renderer?.draw();
    renderFrameRequest = null;
  });
};

updateSelectionReal = (newSelection, skipRender = false) => {
  if (isUpdatingSelection) return;
  isUpdatingSelection = true;
  try {
    selectedElements.value = newSelection;
    renderer?.setSelectedElements(newSelection);
    treeManager?.setSelectedTreeNode(newSelection.length === 1 ? newSelection[0].id : null);
    tableManager?.syncWithSelection(newSelection);
    if (!skipRender) scheduleRenderReal();
  } finally { isUpdatingSelection = false; }
};

// Переопределяем заглушки
scheduleRender = scheduleRenderReal;
updateSelection = updateSelectionReal;

// Watchers
watch([showGrid, showPorts, showCallouts, showColors, isDarkTheme, showElementAxes], () => scheduleRender());
watch(mmPerPx, (val) => {
  globalScale.setMmPerPx(val);
  for (const el of allElements.value) { el.updatePorts?.(); el.updateCalloutText?.(); }
  scheduleRender();
});
watch(selectedElements, () => { tableManager?.syncWithSelection(selectedElements.value); }, { deep: true });

// ========== ИНИЦИАЛИЗАЦИЯ ==========
onMounted(() => {
  globalScale.setMmPerPx(mmPerPx.value);
  if (localStorage.getItem('theme') === 'dark') isDarkTheme.value = true;
  if (!mainCanvas.value) { console.error('Canvas element not found'); return; }

  renderer = new CanvasRenderer(mainCanvas.value, layers, renderOptions);
  selectionManager = new SelectionManager(allElements, renderer, layerManager);
  interactionManager = new InteractionManager(mainCanvas.value, allElements, renderer, connectionManager, selectionManager, renderOptions, layerManager);
  dragDropManager = new DragDropManager(renderer, layerManager, updateSelection, scheduleRender, showNotify);
  traceManager = new TraceManager(interactionManager, scheduleRender);

  if (tableManager) tableManager.setRenderer?.(renderer);
  if (treeManager) treeManager.setRenderer?.(renderer);
  if (elementOpsManager) elementOpsManager.setRenderer?.(renderer);

  zIndexManager.setRenderer(renderer);
  interactionManager.setOnElementMoveCallback?.((moving) => { if (!isUpdatingSelection) updateSelection(moving, true); });
  interactionManager.setAutoUpdateConnections(autoUpdateConnections.value);
  interactionManager.setOnElementCreated((element) => { layers.value = [...layers.value]; updateSelection([element]); scheduleRender(); });
  interactionManager.setOnTraceStart(() => { traceManager.setActive(true); });
  interactionManager.setOnError((message) => showNotify({ type: 'warning', message, timeout: 2000 }));
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
</script>
