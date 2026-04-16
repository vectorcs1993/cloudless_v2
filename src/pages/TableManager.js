import { ref } from 'vue';

export class TableManager {
  constructor(layers, allElements, onSelectElement, onCenterElement) {
    this.layers = layers;
    this.allElements = allElements;
    this.onSelectElement = onSelectElement;
    this.onCenterElement = onCenterElement;

    this.columns = ref([
      { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
      { name: 'type', label: 'Тип', field: (row) => this.getElementTypeName(row), sortable: true, align: 'left' },
      { name: 'name', label: 'Имя', field: 'name', sortable: true, align: 'left' },
      { name: 'a', label: 'A, мм', field: 'a', sortable: true, align: 'left' },
      { name: 'b', label: 'B, мм', field: 'b', sortable: true, align: 'left' },
      { name: 'c', label: 'C, мм', field: (row) => (row.c !== undefined ? row.c : '-'), sortable: true, align: 'left' },
    ]);

    this.pagination = ref({ rowsPerPage: 0 });
    this.tableSelectedRows = ref([]);
  }

  getElementTypeName(el) {
    return el?.getTypeName?.() || el?.type || 'Неизвестно';
  }

  onTableSelectionChange(selectedRows, updateSelectionCallback) {
    if (selectedRows.length === 0) {
      updateSelectionCallback([]);
      this.tableSelectedRows.value = [];
      return;
    }

    const selectedElementsList = selectedRows
      .map(row => {
        for (const layer of this.layers.value) {
          const found = layer.elements.find(el => el.id === row.id);
          if (found) return found;
        }
        return null;
      })
      .filter(el => el !== null);

    updateSelectionCallback(selectedElementsList);
    this.tableSelectedRows.value = selectedRows;
  }

  onTableRowClick(evt, row, updateSelectionCallback) {
    const element = this.allElements.value.find(el => el.id === row.id);
    if (!element) return;

    if (evt.ctrlKey || evt.metaKey) {
      // Множественный выбор с Ctrl – нужно получить текущее выделение извне
      // Лучше передать текущие selectedElements и updateSelection
      console.warn('Ctrl+клик в таблице требует внешнего состояния selectedElements');
      return;
    } else {
      updateSelectionCallback([element]);
      this.onCenterElement?.(element);
    }
  }

  syncWithSelection(selectedElements) {
    if (selectedElements.length === 0) {
      this.tableSelectedRows.value = [];
      return;
    }
    const selectedRowsData = selectedElements.map(el => ({
      id: el.id,
      type: el.getTypeName?.() || el.type,
      name: el.name || `${el.type}_${el.id}`
    }));
    this.tableSelectedRows.value = selectedRowsData;
  }

  getColumns() { return this.columns; }
  getPagination() { return this.pagination; }
  getSelectedRows() { return this.tableSelectedRows; }
  setSelectedRows(rows) { this.tableSelectedRows.value = rows; }
}
