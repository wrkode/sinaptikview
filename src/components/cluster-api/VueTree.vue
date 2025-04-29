<template>
  <div class="vue-tree">
    <div class="vue-tree-container" ref="treeContainer">
      <!-- The SVG container will be created by D3 -->
    </div>
    <div class="zoom-controls">
      <Button icon="pi pi-plus" @click="zoomIn" class="p-button-rounded p-button-sm" />
      <Button icon="pi pi-minus" @click="zoomOut" class="p-button-rounded p-button-sm" />
      <Button icon="pi pi-refresh" @click="resetZoom" class="p-button-rounded p-button-sm" />
    </div>
  </div>
</template>

<script setup>
import * as d3 from 'd3';
import Button from 'primevue/button';
import { createApp, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ClusterNode from './ClusterNode.vue';

const props = defineProps({
  dataset: {
    type: Object,
    required: true
  },
  config: {
    type: Object,
    default: () => ({
      nodeWidth: 250,
      nodeHeight: 140,
      levelHeight: 200
    })
  },
  collapseEnabled: {
    type: Boolean,
    default: false
  },
  linkStyle: {
    type: String,
    default: 'curve', // 'curve' or 'straight'
    validator: (value) => ['curve', 'straight'].includes(value)
  }
});

const emit = defineEmits(['scale', 'node-click']);

const treeContainer = ref(null);
let svg = null;
let g = null;
let zoomInstance = null;
let root = null;
let linkGenerator = null;
let renderTimeout = null;
let lastZoomTime = 0;
let zoomDebounceDelay = 100; // ms

// Track mounted Vue apps for cleanup
const mountedApps = ref({});

// Scale for zooming
const currentScale = ref(1);

// Expose methods for parent components
defineExpose({
  zoomIn,
  zoomOut,
  resetZoom
});

// Set up the tree layout when component is mounted
onMounted(() => {
  initializeTree();
  window.addEventListener('resize', handleResize);
});

// Clean up when component is unmounted
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (renderTimeout) clearTimeout(renderTimeout);
  
  // Unmount all Vue apps created by this component
  console.log('[VueTree Unmount] Cleaning up mounted Vue apps');
  Object.keys(mountedApps.value).forEach(nodeId => {
    try {
      mountedApps.value[nodeId]?.unmount();
    } catch (e) {
      console.warn(`[VueTree Unmount] Error unmounting app for node ${nodeId}:`, e);
    }
  });
  mountedApps.value = {};

  // Clean up D3 elements and listeners
  if (zoomInstance && svg) {
    svg.on('.zoom', null);
    if (svg) svg.selectAll('*').remove();
    svg = null;
    g = null;
    zoomInstance = null;
  }
});

// Watch for changes in the dataset and update the tree
watch(() => props.dataset, (newValue, oldValue) => {
  // Skip if the data is exactly the same
  if (JSON.stringify(newValue) === JSON.stringify(oldValue)) return;
  
  // Clear existing timeout to prevent multiple renders
  if (renderTimeout) clearTimeout(renderTimeout);
  
  // Debounce the tree update to prevent excessive renders
  renderTimeout = setTimeout(() => {
    nextTick(() => {
      updateTree();
    });
  }, 200); // 200ms debounce delay
}, { deep: true });

// Watch for changes in the link style
watch(() => props.linkStyle, () => {
  updateLinkGenerator();
  if (g && root) {
    // Only update the links, not the whole tree
    updateLinks();
  }
}, { immediate: false });

function initializeTree() {
  if (!treeContainer.value) return;
  
  // Clear any existing SVG
  d3.select(treeContainer.value).select('svg').remove();
  
  // Get container dimensions
  const width = treeContainer.value.clientWidth;
  const height = treeContainer.value.clientHeight;

  // Create SVG element
  svg = d3.select(treeContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'vue-tree-svg');

  // Create a group for the tree that can be transformed
  g = svg.append('g')
    .attr('class', 'vue-tree-g');

  // Set up zoom behavior
  zoomInstance = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      
      // Debounce scale event to reduce performance impact
      const now = Date.now();
      if (now - lastZoomTime > zoomDebounceDelay) {
        currentScale.value = event.transform.k;
        emit('scale', currentScale.value);
        lastZoomTime = now;
      }
    });

  // Apply zoom behavior to the SVG
  svg.call(zoomInstance);
  
  // Create the link generator based on the chosen style
  updateLinkGenerator();
  
  // Process and render the tree
  updateTree();
}

function updateLinkGenerator() {
  const nodeWidth = props.config.nodeWidth;
  //const nodeHeight = props.config.nodeHeight; // Not needed for horizontal links

  if (props.linkStyle === 'curve') {
    linkGenerator = d3.linkHorizontal()
      .source(d => [d.source.y + nodeWidth / 2, d.source.x]) // [startX, startY]
      .target(d => [d.target.y - nodeWidth / 2, d.target.x]); // [endX, endY]
  } else { // straight
    linkGenerator = d => {
      const startX = d.source.y + nodeWidth / 2;
      const startY = d.source.x;
      const endX = d.target.y - nodeWidth / 2;
      const endY = d.target.x;
      // Use d3.line() to generate the path string for a straight line
      // Need to format the points correctly for d3.line: [[x0, y0], [x1, y1]]
      const lineData = [[startX, startY], [endX, endY]];
      return d3.line()(lineData); 
    };
  }
}

function updateTree() {
  if (!svg || !props.dataset || !treeContainer.value) {
    console.warn('Cannot update tree - missing required elements:', { 
      svg: !!svg, 
      dataset: !!props.dataset, 
      treeContainer: !!treeContainer.value 
    });
    return;
  }
  root = d3.hierarchy(props.dataset, d => d.children);
  const treeLayout = d3.tree()
    .nodeSize([props.config.nodeHeight + 40, props.config.nodeWidth + 60])
    .separation((a, b) => a.parent === b.parent ? 1.5 : 2);
  treeLayout(root);
  updateNodes();
  updateLinks();
  centerTree();
}

function updateNodes() {
  if (!g || !root) return;
  
  const allNodes = root.descendants();
  
  const nodesSelection = g.selectAll('.vue-tree-node')
    .data(allNodes, d => d.data.id || (d.data.id = `node-${Math.random().toString(36).substr(2, 9)}`));
    
  nodesSelection.exit().each(function(d) {
      const nodeId = d.data.id;
      if (mountedApps.value[nodeId]) {
        try {
            mountedApps.value[nodeId].unmount();
        } catch (e) {
            console.warn('Error during unmount:', e);
        }
        delete mountedApps.value[nodeId];
      }
    }).remove();
  
  const nodeEnter = nodesSelection.enter()
    .append('foreignObject')
    .attr('class', 'vue-tree-node')
    .attr('width', props.config.nodeWidth)
    .attr('height', props.config.nodeHeight)
    .style('cursor', d => (d.data && d.data.kind === 'ManagementCluster') || !d.data?.id ? 'default' : 'pointer')
    .on('click', handleNodeClick)
    .attr('x', d => d.parent ? d.parent.y : d.y) 
    .attr('y', d => d.parent ? d.parent.x - props.config.nodeHeight / 2 : d.x - props.config.nodeHeight / 2)
    .style('opacity', 0);

  nodeEnter.each(function(d) {
      const nodeId = d.data.id;
      const mountPoint = d3.select(this).append('xhtml:div')
          .attr('id', `vue-mount-${nodeId}`)
          .attr('class', 'vue-node-mount-point'); 
          
      if (mountPoint.node()) {
          try {
              const app = createApp(h(ClusterNode, { node: d.data })); 
              app.mount(mountPoint.node()); 
              mountedApps.value[nodeId] = app; 
          } catch (e) {
              console.error(`[VueTree UpdateNodes Enter] Error mounting Vue app for node ${nodeId}:`, e);
          }
      } else {
           console.error(`[VueTree UpdateNodes Enter] Mount point div not found for node ${nodeId}`);
      }
  });
    
  const mergedNodes = nodeEnter.merge(nodesSelection);

  mergedNodes.style('cursor', d => (d.data && d.data.kind === 'ManagementCluster') || !d.data?.id ? 'default' : 'pointer');

  mergedNodes.transition('nodeMove')
    .duration(750)
    .attr('x', d => d.y)
    .attr('y', d => d.x - props.config.nodeHeight / 2)
    .style('opacity', 1)
    .on('end', () => {});
}

function updateLinks() {
  if (!g || !root) return;
  
  const allLinks = root.links();

  const linksSelection = g.selectAll('.vue-tree-link')
    .data(allLinks, d => d.source.data.id + '-' + d.target.data.id);
    
  linksSelection.exit().remove();
  
  linksSelection.enter()
    .append('path')
    .attr('class', 'vue-tree-link')
    .merge(linksSelection)
    .transition('linkDraw')
    .duration(300)
    .attr('d', linkGenerator)
    .on('end', () => {});
}

function centerTree() {
  if (!svg || !g || !root || !treeContainer.value) return;
  
  const width = treeContainer.value.clientWidth;
  const height = treeContainer.value.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  
  const initialX = centerX - (root.y || 0);
  const initialY = centerY - (root.x || 0);
  const defaultScale = 0.8;
  
  const calculatedTransform = d3.zoomIdentity.translate(initialX, initialY).scale(defaultScale);
  
  svg.transition('center')
    .duration(750)
    .call(zoomInstance.transform, calculatedTransform);
}

function zoomIn() {
  if (!svg || !zoomInstance) return;
  svg.transition().duration(300).call(zoomInstance.scaleBy, 1.2);
}

function zoomOut() {
  if (!svg || !zoomInstance) return;
  svg.transition().duration(300).call(zoomInstance.scaleBy, 0.8);
}

function resetZoom() {
  if (!svg) return;
  centerTree();
}

// Debounced resize handler to improve performance
function handleResize() {
  if (renderTimeout) clearTimeout(renderTimeout);
  
  renderTimeout = setTimeout(() => {
    if (treeContainer.value && svg) {
      svg.attr('width', treeContainer.value.clientWidth)
         .attr('height', treeContainer.value.clientHeight);
      centerTree();
    }
  }, 100);
}

// Function to handle node clicks emitted from D3
function handleNodeClick(event, d) {
  // Prevent click on management cluster or if no data
  if (!d || !d.data || d.data.isManagement || d.data.kind === 'Management') {
    console.log('[VueTree Click] Ignored click on management node or node without data.');
    return;
  }
  
  console.log('[VueTree Click] Node clicked:', d.data);
  // Emit an event with the original node data object
  emit('node-click', d.data);
}
</script>

<style scoped>
.vue-tree {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.vue-tree-container {
  width: 100%;
  height: 100%;
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

:deep(.vue-tree-svg) {
    display: block; 
    width: 100%;
    height: 100%;
}

:deep(.vue-tree-link) {
  fill: none;
  stroke: #6c757d; /* Use a darker gray, e.g., Bootstrap's secondary color */
  stroke-width: 2px; /* Make slightly thicker */
}

:deep(.vue-tree-node-container) {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

:deep(.vue-tree-node-content) {
  color: var(--text-color, #495057);
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 6px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

:deep(.vue-tree-node) {
}

/* Add style for the mount point div if needed, e.g., ensure it fills the foreignObject */
:deep(.vue-node-mount-point) {
    width: 100%;
    height: 100%;
}
</style> 