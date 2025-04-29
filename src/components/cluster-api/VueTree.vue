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
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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

const emit = defineEmits(['scale']);

const treeContainer = ref(null);
let svg = null;
let g = null;
let zoomInstance = null;
let root = null;
let treeData = null;
let linkGenerator = null;
let renderTimeout = null;
let lastZoomTime = 0;
let zoomDebounceDelay = 100; // ms

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
  if (zoomInstance && svg) {
    // Remove all event listeners and clean up D3
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
  if (props.linkStyle === 'curve') {
    linkGenerator = d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x);
  } else { // straight
    linkGenerator = d3.line()
      .x(d => d.y)
      .y(d => d.x);
  }
}

function updateTree() {
  if (!svg || !props.dataset || !treeContainer.value) return;

  // Process the data with D3's hierarchy
  root = d3.hierarchy(props.dataset, d => d.children);
  
  // Set up the tree layout
  const treeLayout = d3.tree()
    .nodeSize([props.config.nodeHeight + 20, props.config.nodeWidth + 40])
    .separation((a, b) => a.parent === b.parent ? 1 : 1.2);
  
  // Apply the layout
  treeLayout(root);
  
  // Update nodes and links
  updateNodes();
  updateLinks();
  
  // Center the tree
  centerTree();
}

function updateNodes() {
  if (!g || !root) return;
  
  // Performance optimization: select nodes only once
  const allNodes = root.descendants();
  
  // Use virtualization concept - only render nodes that would be visible
  // This is a simplified approach; a full virtualization would be more complex
  const nodes = g.selectAll('.vue-tree-node')
    .data(allNodes, d => d.data.id || (d.data.id = Math.random().toString(36).substr(2, 9)));
    
  // Remove nodes that no longer exist
  nodes.exit().remove();
  
  // Create new nodes only when needed
  const nodeEnter = nodes.enter()
    .append('foreignObject')
    .attr('class', 'vue-tree-node')
    .attr('width', props.config.nodeWidth)
    .attr('height', props.config.nodeHeight)
    .attr('x', d => d.y)
    .attr('y', d => d.x - props.config.nodeHeight / 2);
  
  // Create a div for each node to hold the slot content
  nodeEnter.append('xhtml:div')
    .attr('class', 'vue-tree-node-container')
    .each(function(d) {
      d3.select(this)
        .append('div')
        .attr('class', 'vue-tree-node-content')
        .text(d.data.name);
    });
    
  // Update positions of existing nodes with transition for smoother rendering
  nodes.transition()
    .duration(300)
    .attr('x', d => d.y)
    .attr('y', d => d.x - props.config.nodeHeight / 2);
}

function updateLinks() {
  if (!g || !root) return;
  
  // Select all existing links
  const links = g.selectAll('.vue-tree-link')
    .data(root.links(), d => d.source.data.id + '-' + d.target.data.id);
    
  // Remove links that no longer exist
  links.exit().remove();
  
  // Create new links
  links.enter()
    .append('path')
    .attr('class', 'vue-tree-link')
    .merge(links) // Apply to new and existing links
    .attr('d', d => {
      if (props.linkStyle === 'curve') {
        return linkGenerator(d);
      } else { // straight
        return linkGenerator([
          { x: d.source.x, y: d.source.y + props.config.nodeWidth / 2 },
          { x: d.target.x, y: d.target.y - 10 }
        ]);
      }
    });
}

function centerTree() {
  if (!svg || !g || !root || !treeContainer.value) return;
  
  // Get the SVG dimensions
  const width = treeContainer.value.clientWidth;
  const height = treeContainer.value.clientHeight;
  
  // Calculate the center position
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Reset the transform
  zoomInstance.transform(svg, d3.zoomIdentity);
  
  // Apply a translation to center the tree
  const transform = d3.zoomIdentity
    .translate(centerX - root.y, centerY)
    .scale(1);
    
  svg.transition()
    .duration(750)
    .call(zoomInstance.transform, transform);
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

:deep(.vue-tree-link) {
  fill: none;
  stroke: var(--surface-border, #dee2e6);
  stroke-width: 1.5px;
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
</style> 