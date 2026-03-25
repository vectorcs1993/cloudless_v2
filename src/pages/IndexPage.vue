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

        <div class="view-controls">
          <label><input type="checkbox" v-model="showGrid" /> Сетка</label>
          <label><input type="checkbox" v-model="showPorts" /> Показать порты</label>
          <label><input type="checkbox" v-model="snapToPorts" /> Привязка к портам</label>
          <label><input type="checkbox" v-model="showCallouts" /> Показать выноски</label>
        </div>
      </div>

      <!-- Панель добавления элементов -->
      <div class="add-element-panel">
        <button @click="addDuctDirect" class="add-btn">➕ Прямой воздуховод</button>
        <button @click="addFan" class="add-btn">🌀 Вентилятор</button>
        <button @click="addTee" class="add-btn">🔀 Тройник</button>
      </div>

      <!-- Кнопки управления сохранением -->
      <div class="save-controls">
        <button @click="saveToLocalStorage" class="save-btn">💾 Сохранить</button>
        <button @click="resetToDefault" class="reset-btn">↺ Сброс</button>
      </div>

      <!-- Информация о выбранном элементе -->
      <div v-if="selectedElement" class="selected-info">
        <h4>Выбран элемент:</h4>
        <p>{{ selectedElement.name }}</p>
        <p>Тип: {{ selectedElement.getTypeName() }}</p>
        <p>Позиция: ({{ Math.round(selectedElement.x) }}, {{ Math.round(selectedElement.y) }})</p>
        <p>Поворот: {{ selectedElement.rotation || 0 }}°</p>

        <!-- Добавляем кнопку добавления выноски -->
        <!-- <button @click="addCalloutToSelected" class="add-callout-btn">📝 Добавить выноску</button> -->

        <div v-if="selectedElement.getParameters().length > 0" class="element-params">
          <div v-for="param in selectedElement.getParameters()" :key="param.name" class="param-field">
            <label>{{ param.label }}:
              <input :type="param.type" v-model.number="selectedElement[param.name]" :step="param.step" :min="param.min"
                @change="onParameterChange" />
              <span v-if="param.unit">{{ param.unit }}</span>
            </label>
          </div>
        </div>

        <div v-if="selectedElement.ports && selectedElement.ports.some(p => p.isConnected())">
          <h5>Связи:</h5>
          <div v-for="port in selectedElement.ports.filter(p => p.isConnected())" :key="port.id"
            class="connection-info">
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

        <button @click="deleteSelected" class="delete-btn">Удалить</button>
      </div>
    </div>

    <canvas ref="mainCanvas" class="main-canvas" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp" @wheel.prevent="onWheel" @contextmenu.prevent>
    </canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LayerManager } from './LayerManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { InteractionManager } from './InteractionManager.js';
import { StorageManager} from './StorageManager.js';
import { Tee, DuctDirect, Fan, ElementFactory } from './Elements.js';


// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
// Состояние
const isDarkTheme = ref(false);
const pixelsPerMeter = ref(50);
const showGrid = ref(true);
const showPorts = ref(true);
const showCallouts = ref(true);
const snapToPorts = ref(true);
const gridStepM = ref(1);

// Canvas
const mainCanvas = ref(null);
let renderer = null;
let connectionManager = null;
let interactionManager = null;
let layerManager = null;
let storageManager = null;

// Данные
const elements = ref([]);
const selectedElement = ref(null);
const mouseWorldPos = ref(null);
let nextElementId = 100;
let nextPortId = 1000;

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


// ========== Функции ==========
const saveToLocalStorage = () => {
  storageManager.save(elements.value, nextElementId, nextPortId);
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
    selectedElement.value = null;
    renderer?.setSelectedElement(null);
    renderer?.draw();
    return;
  }
  try {
    console.log('Загружены данные:', data); // Отладка
    console.log('Количество элементов:', data.elements.length); // Отладка

    elements.value = data.elements.map(json => {
      const element = ElementFactory.createFromJSON(json);
      console.log('Создан элемент:', element.type, element.id); // Отладка
      return element;
    });

    nextElementId = data.nextElementId || 100;
    nextPortId = data.nextPortId || 1000;
    elements.value.forEach(el => el.updatePorts());
    selectedElement.value = null;
    renderer?.setSelectedElement(null);
    renderer?.draw();

    console.log('Элементы после загрузки:', elements.value.length); // Отладка
  } catch (error) {
    console.error('Error loading data:', error);
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    selectedElement.value = null;
    renderer?.setSelectedElement(null);
    renderer?.draw();
  }
};


const resetToDefault = () => {
  if (confirm('Сбросить все изменения?')) {
    // Очищаем все элементы
    elements.value = [];
    nextElementId = 100;
    nextPortId = 1000;
    selectedElement.value = null;
    renderer?.setSelectedElement(null);
    renderer?.draw();
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

  selectedElement.value = newElement;
  renderer?.setSelectedElement(newElement);
  renderer?.draw();
};

const addDuctDirect = () => addElement(DuctDirect, [200, 50]);
const addFan = () => addElement(Fan, [50]);
const addTee = () => addElement(Tee, [50]);

const onParameterChange = () => {
  if (selectedElement.value) {
    selectedElement.value.updatePorts();
    selectedElement.value.updateCalloutText(); // Обновляем текст выноски
    renderer?.draw();
  }
};

const rotateLeft = () => {
  if (!selectedElement.value) return;
  connectionManager.disconnectElement(selectedElement.value);
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) - 90 + 360) % 360;
  selectedElement.value.updatePorts();
  selectedElement.value.updateCalloutText();
  renderer?.draw();
};

const rotateRight = () => {
  if (!selectedElement.value) return;
  connectionManager.disconnectElement(selectedElement.value);
  selectedElement.value.rotation = ((selectedElement.value.rotation || 0) + 90) % 360;
  selectedElement.value.updatePorts();
  selectedElement.value.updateCalloutText();
  renderer?.draw();
};

const moveToTop = () => layerManager?.moveToTop(selectedElement.value);
const moveToBottom = () => layerManager?.moveToBottom(selectedElement.value);
const moveUp = () => layerManager?.moveUp(selectedElement.value);
const moveDown = () => layerManager?.moveDown(selectedElement.value);

const deleteSelected = () => {
  if (selectedElement.value) {
    connectionManager.disconnectElement(selectedElement.value);
    const index = elements.value.findIndex(el => el.id === selectedElement.value.id);
    if (index !== -1) {
      elements.value.splice(index, 1);
      selectedElement.value = null;
      renderer?.setSelectedElement(null);
      renderer?.draw();
    }
  }
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

  if (renderer?.selectedElement) {
    selectedElement.value = renderer.selectedElement;
  } else {
    selectedElement.value = null;
  }
};
const onCanvasMouseMove = (e) => {
  const worldPos = renderer?.screenToWorld(e.clientX, e.clientY);
  if (worldPos) mouseWorldPos.value = worldPos;
  interactionManager?.onMouseMove(e);
  if (renderer?.selectedElement) {
    selectedElement.value = renderer.selectedElement;
  }
};
const onCanvasMouseUp = (e) => interactionManager?.onMouseUp(e);
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

  // Устанавливаем callback для обновления selectedElement
  interactionManager.setOnElementMoveCallback((element) => {
    selectedElement.value = element;
  });

  layerManager = new LayerManager(elements, renderer);

  loadFromLocalStorage();

  const resizeObserver = new ResizeObserver(() => renderer?.draw());
  resizeObserver.observe(mainCanvas.value);

  renderer.draw();
});
</script>
