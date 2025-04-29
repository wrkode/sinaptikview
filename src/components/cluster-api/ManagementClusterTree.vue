<template>
  <div class="tree-container">
    <div v-if="treeIsReady && processedData" class="tree-ready">
      <VueTree
        ref="tree"
        :dataset="processedData"
        :config="treeConfig"
        :collapse-enabled="false"
        :linkStyle="straightLinks ? 'straight' : 'curve'"
        @scale="onScaleChange"
        @node-click="onNodeClick"
      />
    </div>
    
    <div v-else class="loading-container">
      <ProgressSpinner />
      <p>Loading cluster data...</p>
      <div v-if="processedData === null && treeData" class="error-message">
        Error processing tree data
      </div>
    </div>
  </div>
</template>

<script setup>
import ProgressSpinner from 'primevue/progressspinner';
import { onMounted, ref, watch } from 'vue';
import VueTree from './VueTree.vue';

const props = defineProps({
  treeData: {
    type: Object,
    required: true
  },
  treeConfig: {
    type: Object,
    default: () => ({
      nodeWidth: 250,
      nodeHeight: 140,
      levelHeight: 200
    })
  },
  treeIsReady: {
    type: Boolean,
    required: true
  },
  straightLinks: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['scale', 'node-click']);

const tree = ref(null);
const scale = ref(1);
const processedData = ref(null);

// Process the tree data when it changes
watch(() => props.treeData, (newValue) => {
  if (newValue) {
    try {
      processedData.value = processTreeData(newValue);
    } catch (err) {
      console.error('Error processing tree data:', err);
      processedData.value = null;
    }
  } else {
    processedData.value = null;
  }
}, { immediate: true, deep: true });

// Function to transform API data into format needed for D3 tree
function processTreeData(data) {
  if (!data) return null;
  
  const addIds = (node, parentId = null) => {
    const id = parentId ? `${parentId}-${node.name}` : `node-${node.name}`;
    node.id = id.replace(/\s+/g, '-').toLowerCase();
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => addIds(child, id));
    }
    
    return node;
  };
  
  return addIds({...data});
}

onMounted(() => {
});

const onScaleChange = (newScale) => {
  scale.value = newScale;
  emit('scale', newScale);
};

// Function to pass the click event up
const onNodeClick = (nodeData) => {
  console.log('[ManagementClusterTree] Node click received, emitting up:', nodeData);
  emit('node-click', nodeData);
};

// Expose zoom methods to parent components
defineExpose({
  zoomIn: () => tree.value?.zoomIn(),
  zoomOut: () => tree.value?.zoomOut(),
  resetZoom: () => tree.value?.resetZoom()
});
</script>

<style scoped>
.tree-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tree-ready {
  width: 100%;
  height: 100%;
}

.loading-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.error-message {
  color: red;
  font-weight: bold;
  margin-top: 1rem;
}

.node {
  width: 250px;
  height: 140px;
}
</style> 