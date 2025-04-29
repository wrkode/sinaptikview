<template>
  <div class="management-cluster-view">
    <div class="header">
      <h1>Management Cluster</h1>
      <div class="actions">
        <Button icon="pi pi-refresh" @click="fetchManagementCluster" class="p-button-outlined" :disabled="fetchInProgress" />
        <Button icon="pi pi-link" @click="toggleLinkStyle" class="p-button-outlined" :class="{ 'p-button-secondary': !straightLinks }" />
        <Button icon="pi pi-plus" @click="zoomIn" class="p-button-outlined" />
        <Button icon="pi pi-minus" @click="zoomOut" class="p-button-outlined" />
        <Button icon="pi pi-sync" @click="resetZoom" class="p-button-outlined" />
        <InputSwitch v-model="autoRefresh" />
        <span>Auto-refresh: {{ autoRefreshInterval }}</span>
      </div>
    </div>
    
    <div class="content">
      <div v-if="initialLoad" class="skeleton-container">
        <Skeleton width="100%" height="200px" class="mb-2"></Skeleton>
        <div class="skeleton-nodes">
          <Skeleton width="300px" height="140px" class="mb-2"></Skeleton>
          <Skeleton width="300px" height="140px" class="mb-2"></Skeleton>
          <Skeleton width="300px" height="140px"></Skeleton>
        </div>
      </div>
      
      <ManagementClusterTree
        v-else
        ref="clusterTree"
        :treeData="treeData"
        :treeConfig="treeConfig"
        :treeIsReady="treeIsReady"
        :straightLinks="straightLinks"
        @scale="scale = $event"
      />
    </div>
    
    <div v-if="error" class="error-container">
      <Message severity="error" :closable="false">
        <template #content>
          <p>{{ error }}</p>
          <Button label="Retry" @click="fetchManagementCluster" class="p-button-sm" />
        </template>
      </Message>
    </div>
  </div>
</template>

<script setup>
import ManagementClusterTree from '@/components/cluster-api/ManagementClusterTree.vue';
import cacheService from '@/services/CacheService';
import axios from 'axios';
import Button from 'primevue/button';
import InputSwitch from 'primevue/inputswitch';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Tree configuration
const treeConfig = ref({
  nodeWidth: 300,
  nodeHeight: 140,
  levelHeight: 250
});

// Tree data and state
const treeData = ref({});
const treeIsReady = ref(false);
const error = ref(null);
const scale = ref(1);
const straightLinks = ref(false);
const initialLoad = ref(true);

// Auto refresh settings
const autoRefresh = ref(false);
const refreshIntervalTime = 60000; // Increased from 30s to 60s to reduce API load
let refreshTimer = null;
let fetchInProgress = false; // Track if a fetch is already in progress

// References
const clusterTree = ref(null);

// Computed properties
const autoRefreshInterval = computed(() => {
  const seconds = refreshIntervalTime / 1000;
  return seconds >= 60 
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` 
    : `${seconds}s`;
});

// Cache key
const MANAGEMENT_CLUSTER_CACHE_KEY = 'management-cluster-tree';
const CACHE_TTL = 45000; // 45 seconds

// Methods
const fetchManagementCluster = async (forceRedraw = true) => {
  // Prevent multiple concurrent API calls
  if (fetchInProgress) return;
  
  try {
    fetchInProgress = true;
    error.value = null;
    
    // Only show loading state on first load, not during refreshes
    if (initialLoad.value) {
      treeIsReady.value = false;
    }
    
    // Try to use cached data first if not forcing a redraw
    if (!forceRedraw) {
      const cachedData = cacheService.get(MANAGEMENT_CLUSTER_CACHE_KEY);
      if (cachedData) {
        console.log('Using cached management cluster data');
        treeData.value = cachedData;
        treeIsReady.value = true;
        initialLoad.value = false;
        return;
      }
    }
    
    const response = await axios.get('/api/cluster-api/management-cluster');
    
    if (!response.data) {
      error.value = "Couldn't find a management cluster";
      treeIsReady.value = true; // Set to true to display error
      initialLoad.value = false;
      return;
    }
    
    // Only update if data actually changed (reduces unnecessary re-renders)
    const newDataString = JSON.stringify(response.data);
    const oldDataString = JSON.stringify(treeData.value);
    
    if (forceRedraw || newDataString !== oldDataString) {
      // Use a more controlled update approach
      nextTick(() => {
        treeData.value = response.data;
        treeIsReady.value = true;
        initialLoad.value = false;
        
        // Cache the result
        cacheService.set(MANAGEMENT_CLUSTER_CACHE_KEY, response.data, CACHE_TTL);
      });
    } else {
      initialLoad.value = false;
    }
  } catch (err) {
    console.error('Error fetching management cluster:', err);
    error.value = err.response?.data?.message || 'Failed to fetch management cluster data';
    treeIsReady.value = true; // Set to true so we can show the error
    initialLoad.value = false;
  } finally {
    fetchInProgress = false;
  }
};

const toggleLinkStyle = () => {
  straightLinks.value = !straightLinks.value;
};

const zoomIn = () => {
  clusterTree.value?.zoomIn();
};

const zoomOut = () => {
  clusterTree.value?.zoomOut();
};

const resetZoom = () => {
  clusterTree.value?.resetZoom();
};

// Watch for autoRefresh changes
watch(autoRefresh, (newValue) => {
  clearInterval(refreshTimer); // Always clear existing timer
  
  if (newValue) {
    refreshTimer = setInterval(() => {
      // Only refresh if the tab is visible to reduce resource usage
      if (document.visibilityState === 'visible') {
        fetchManagementCluster(false);
      }
    }, refreshIntervalTime);
  }
});

// Add visibility change listener to pause refreshes when tab is not visible
onMounted(() => {
  fetchManagementCluster();
  document.title = 'Management Cluster | SinaptikView';
  
  // Add visibility change listener
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

// Handle tab visibility changes
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden' && refreshTimer) {
    // Pause refreshing when tab is not visible
    clearInterval(refreshTimer);
  } else if (document.visibilityState === 'visible' && autoRefresh.value) {
    // Resume refreshing when tab becomes visible again
    clearInterval(refreshTimer); // Clear any existing timer first
    refreshTimer = setInterval(() => {
      fetchManagementCluster(false);
    }, refreshIntervalTime);
  }
};
</script>

<style scoped>
.management-cluster-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.content {
  flex: 1;
  position: relative;
  background-color: var(--surface-ground);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

.skeleton-nodes {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.error-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}
</style> 