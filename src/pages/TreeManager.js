import { computed } from 'vue';

export class TreeManager {
  constructor(layers, activeLayerId, onSelectLayer, onSelectElement, showNotify) {
    this.layers = layers;
    this.activeLayerId = activeLayerId;
    this.onSelectLayer = onSelectLayer;
    this.onSelectElement = onSelectElement;
    this.showNotify = showNotify;

    this.selectedTreeNode = null;
    this.expandedTreeNodes = [];
  }

  getProjectTree() {
    const buildElementNode = (item, layerInfo) => ({
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
    });

    const result = [];
    for (const layer of this.layers.value) {
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
      this.selectedTreeNode = nodeId;
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
    this.expandedTreeNodes = getAllIds(projectTree);
    return this.expandedTreeNodes;
  }

  collapseAll() {
    this.expandedTreeNodes = [];
    return this.expandedTreeNodes;
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
    this.selectedTreeNode = nodeId;
  }

  getSelectedTreeNode() {
    return this.selectedTreeNode;
  }

  getExpandedTreeNodes() {
    return this.expandedTreeNodes;
  }

  setExpandedTreeNodes(nodes) {
    this.expandedTreeNodes = nodes;
  }
}
