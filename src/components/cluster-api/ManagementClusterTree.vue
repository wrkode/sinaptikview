<template>
  <div class="tree-container">
    <VueTree
      v-if="treeIsReady"
      ref="tree"
      :dataset="treeData"
      :config="treeConfig"
      :collapse-enabled="false"
      :linkStyle="straightLinks ? 'straight' : 'curve'"
      @scale="onScaleChange"
    >
      <template #node="{ node }">
        <ClusterNode :node="node" />
      </template>
    </VueTree>
    
    <div v-else class="loading-container">
      <ProgressSpinner />
      <p>Loading cluster data...</p>
    </div>
  </div>
</template>

<script setup>
import ProgressSpinner from 'primevue/progressspinner';
import { ref } from 'vue';
import ClusterNode from './ClusterNode.vue';
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

const emit = defineEmits(['scale']);

const tree = ref(null);
const scale = ref(1);

const onScaleChange = (newScale) => {
  scale.value = newScale;
  emit('scale', newScale);
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

.loading-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.node {
  width: 250px;
  height: 140px;
}
</style> 