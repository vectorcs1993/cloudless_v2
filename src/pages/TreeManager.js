// TreeManager.js
import { ref, computed } from 'vue';

export class TreeManager {
  constructor(layers, activeLayerId, onSelectLayer, onSelectElement, showNotify) {
    this.layers = layers;
    this.activeLayerId = activeLayerId;
    this.onSelectLayer = onSelectLayer;
    this.onSelectElement = onSelectElement;
    this.showNotify = showNotify;

    this.selectedTreeNode = ref(null);
    this.expandedTreeNodes = ref([]);

    // СОЗДАЕМ REACTIVE COMPUTED
    this.projectTree = computed(() => this.buildProjectTree());
  }

  buildProjectTree() {
    const layersArray = this.layers.value || this.layers;

    const result = [];
    for (const layer of layersArray) {
      result.push({
        id: `layer_${layer.id}`,
        label: layer.name,
        icon: 'layers',
        color: 'primary',
        info: `${layer.elements.length} эл.`,
        children: layer.elements.map(el => ({
          id: el.id,
          label: `${el.name || el.id}`,
          icon: 'rectangle',
          color: el.color || '#888',
          info: '',
          element: el,
          layerId: layer.id,
          layerName: layer.name,
          layerLocked: layer.locked,
          layerVisible: layer.visible,
          isLayer: false,
        })),
        layerId: layer.id,
        layerName: layer.name,
        layerLocked: layer.locked,
        layerVisible: layer.visible,
        isLayer: true,
        element: null
      });
    }
    return result;
  }

  // ВОЗВРАЩАЕМ COMPUTED ЗНАЧЕНИЕ
  getProjectTree() {
    return this.projectTree.value;
  }

  onTreeSelect(nodeId, projectTree) {
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

    const foundNode = findNode(projectTree);
    if (!foundNode) return;

    if (foundNode.isLayer) {
      this.selectedTreeNode.value = nodeId;
      this.onSelectLayer?.(foundNode.layerId);
      return;
    }

    if (foundNode.element) {
      this.onSelectElement?.(foundNode.element);
    }
  }

  expandAll(projectTree) {
    const getAllIds = (nodes) => {
      let ids = [];
      for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) ids.push(...getAllIds(node.children));
      }
      return ids;
    };
    this.expandedTreeNodes.value = getAllIds(projectTree);
    return this.expandedTreeNodes.value;
  }

  collapseAll() {
    this.expandedTreeNodes.value = [];
    return this.expandedTreeNodes.value;
  }

  onTreeNodeContextMenu(event, node) {
    event.preventDefault();
    if (node.isLayer) {
      this.showNotify({ type: 'info', message: `Слой: ${node.label}`, timeout: 1000 });
    } else if (node.element) {
      this.onSelectElement?.(node.element);
    }
  }

  setSelectedTreeNode(nodeId) {
    this.selectedTreeNode.value = nodeId;
  }

  getSelectedTreeNode() {
    return this.selectedTreeNode.value;
  }

  getExpandedTreeNodes() {
    return this.expandedTreeNodes.value;
  }

  setExpandedTreeNodes(nodes) {
    this.expandedTreeNodes.value = nodes;
  }
}
