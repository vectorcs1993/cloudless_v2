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

        <div>
          <label><input type="checkbox" v-model="showGrid" /> Сетка</label>
          <label><input type="checkbox" v-model="showPorts" /> Показать порты</label>
          <label><input type="checkbox" v-model="snapToPorts" /> Привязка к портам</label>
          <label><input type="checkbox" v-model="showCallouts" /> Показать выноски</label>
          <label><input type="checkbox" v-model="autoUpdateConnections" /> Автообновление связей</label>
        </div>
      </div>

      <!-- Панель добавления элементов -->
      <div class="add-element-panel">
        <button @click="addDuctDirect" class="add-btn">➕ Прямой воздуховод</button>
        <button @click="addFan" class="add-btn">🌀 Вентилятор</button>
        <button @click="addTee" class="add-btn">🔀 Тройник</button>
        <button @click="addElbow" class="add-btn">↪️ Отвод</button>
      </div>

      <!-- Кнопки управления сохранением -->
      <div class="save-controls">
        <button @click="saveToLocalStorage" class="save-btn">💾 Сохранить</button>
        <button @click="resetToDefault" class="reset-btn">↺ Сброс</button>
        <button @click="updateAllPortsAndConnections" class="update-ports-btn" style="background: #ff9800;">🔄 Обновить все порты и связи</button>
      </div>

      <!-- Информация о выбранных элементах -->
      <div v-if="selectedElements.length > 0" class="selected-info">
        <h4>Выбрано элементов: {{ selectedElements.length }}</h4>

        <div class="group-controls">
          <button @click="groupSelected" class="group-btn" :disabled="selectedElements.length < 2">
            📦 Сгруппировать ({{ selectedElements.length }})
          </button>
          <button @click="ungroupSelected" class="ungroup-btn" :disabled="!isGroupSelected">
            🔓 Разгруппировать
          </button>
        </div>

        <div v-if="selectedElements.length === 1" class="single-element-info">
          <p>{{ selectedElements[0].name }}</p>
          <p>Тип: {{ selectedElements[0].getTypeName() }}</p>
          <p>Позиция: ({{ Math.round(selectedElements[0].x) }}, {{ Math.round(selectedElements[0].y) }})</p>
          <p>Поворот: {{ selectedElements[0].rotation || 0 }}°</p>

          <div v-if="selectedElements[0].getParameters().length > 0" class="element-params">
            <div v-for="param in selectedElements[0].getParameters()" :key="param.name" class="param-field">
              <label>{{ param.label }}:
                <input :type="param.type" v-model.number="selectedElements[0][param.name]" :step="param.step" :min="param.min"
                  @change="onParameterChange" />
                <span v-if="param.unit">{{ param.unit }}</span>
              </label>
            </div>
          </div>

          <div v-if="selectedElements[0].ports && selectedElements[0].ports.some(p => p.isConnected())">
            <h5>Связи:</h5>
            <div v-for="port in selectedElements[0].ports.filter(p => p.isConnected())" :key="port.id" class="connection-info">
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
        </div>

        <div v-if="selectedElements.length > 1" class="multi-selection-info">
          <p>Выбрано {{ selectedElements.length }} элементов</p>
          <button @click="deleteSelected" class="delete-btn">Удалить выбранные ({{ selectedElements.length }})</button>
        </div>

        <button v-if="selectedElements.length === 1" @click="deleteSelected" class="delete-btn">Удалить</button>
      </div>
    </div>

    <canvas ref="mainCanvas" class="main-canvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp"
      @wheel.prevent="onWheel" @contextmenu.prevent>
    </canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LayerManager } from './LayerManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager } from './StorageManager.js';
import { Tee, DuctDirect, Fan, ElementFactory, Group, Elbow } from './Elements.js';


// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
// Состояние
const isDarkTheme = ref(false);
const pixelsPerMeter = ref(50);
const showGrid = ref(true);
const showPorts = ref(true);
const showCallouts = ref(true);
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

// Параметры для рендерера
const renderOptions = {
  scale: ref(1),
  panX: ref(0),
  panY: ref(0),
  showGrid,
  showPorts,
  showCallouts,
  pixelsPerMeter,
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

const addElement = (ElementClass, params = []) => {
  const newId = ++nextElementId;
  const newElement = new ElementClass(newId, 100, 300, ...params);
  elements.value.push(newElement);
  newElement.updatePorts();

  const calloutX = newElement.x;
  const calloutY = newElement.y - 150;
  newElement.addCallout(calloutX, calloutY);

  selectedElements.value = [newElement];
  renderer?.setSelectedElements([newElement]);
  renderer?.draw();
};

const addDuctDirect = () => addElement(DuctDirect, [200, 50]);
const addFan = () => addElement(Fan, [50]);
const addTee = () => addElement(Tee, [50]);
const addElbow = () => addElement(Elbow, [50]);

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
  interactionManager?.onMouseMove(e);

  if (renderer?.selectedElements) {
    selectedElements.value = [...renderer.selectedElements];
  }
};

const onCanvasMouseUp = (e) => {
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
</script>
