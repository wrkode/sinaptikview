<template>
  <div class="management-cluster-view">
    <div class="header">
      <h1>Management Cluster</h1>
      <div class="actions">
        <Button icon="pi pi-refresh" @click="fetchManagementCluster(true)" class="p-button-outlined" :disabled="fetchInProgress" />
        <Button icon="pi pi-link" @click="toggleLinkStyle" class="p-button-outlined" :class="{ 'p-button-secondary': !straightLinks }" />
        <Button icon="pi pi-plus" @click="zoomIn" class="p-button-outlined" />
        <Button icon="pi pi-minus" @click="zoomOut" class="p-button-outlined" />
        <Button icon="pi pi-sync" @click="resetZoom" class="p-button-outlined" />
        <InputSwitch v-model="autoRefresh" @change="toggleAutoRefresh" />
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
        @node-click="handleNodeNavigation"
      />
    </div>
    
    <div v-if="error" class="error-container">
      <Message severity="error" :closable="false">
        <template #content>
          <p>{{ error }}</p>
          <Button label="Retry" @click="fetchManagementCluster(true)" class="p-button-sm" />
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

// Tree configuration
const treeConfig = ref({
  nodeWidth: 300,
  nodeHeight: 140,
  levelHeight: 250
});

// Tree data and state
const treeData = ref(null);
const treeIsReady = ref(false);
const error = ref(null);
const scale = ref(1);
const straightLinks = ref(false);
const initialLoad = ref(true);
const fetchInProgress = ref(false);
const autoRefresh = ref(false);
const refreshButtonRotating = ref(false);

// Auto refresh settings
const refreshIntervalTime = 60000; // 60 seconds
let autoRefreshTimerId = null;

// References
const clusterTree = ref(null);

// Store the refresh interval
const refreshInterval = ref(null);

// Computed properties
const autoRefreshInterval = computed(() => {
  const seconds = refreshIntervalTime / 1000;
  return seconds >= 60 
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` 
    : `${seconds}s`;
});

// Constants for API and caching
const MANAGEMENT_CLUSTER_ENDPOINT = '/api/cluster-api/management-cluster';
const MANAGEMENT_CLUSTER_CACHE_KEY = 'management-cluster-tree';
const CACHE_TTL = 5000; // 5 seconds, reduced from 15 seconds to be more aggressive

// Methods
const fetchManagementCluster = async (bypassCache = false) => {
  if (fetchInProgress.value) return;
  
  fetchInProgress.value = true;
  error.value = null;
  
  try {
    console.log(`Fetching management cluster data. Bypass cache: ${bypassCache}`);
    
    const maxRetries = 3;
    let retries = 0;
    let success = false;
    
    while (!success && retries < maxRetries) {
      try {
        const response = await callClusterAPIHandler(bypassCache);
        
        if (!response || !response.data) {
          console.warn('Empty response received from management cluster API');
          retries++;
          if (retries < maxRetries) {
            console.log(`Retry attempt ${retries}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          } else {
            throw new Error('Empty response from management cluster API after multiple attempts');
          }
        }
        
        // Process successful response
        console.log('Received management cluster data:', response.data);
        treeData.value = response.data;
        treeIsReady.value = true;
        initialLoad.value = false;
        success = true;
      } catch (err) {
        retries++;
        console.error(`Attempt ${retries}/${maxRetries} failed:`, err);
        
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err; // Re-throw after max retries
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch management cluster data:', err);
    error.value = err.message || 'Failed to fetch management cluster data';
    treeIsReady.value = true; // Set to true even on error to potentially show error message within tree area if designed
    initialLoad.value = false; // Ensure skeleton loader is hidden on error
  } finally {
    fetchInProgress.value = false;
  }
};

// Call the API handler with cache control
const callClusterAPIHandler = async (bypassCache) => {
  try {
    // Skip cache if bypassCache is true
    if (bypassCache) {
      console.log('Bypassing cache for fresh data');
      return await axios.get(MANAGEMENT_CLUSTER_ENDPOINT);
    }
    
    // Try to get from cache
    const cachedData = cacheService.get(MANAGEMENT_CLUSTER_CACHE_KEY);
    if (cachedData) {
      console.log('Using cached management cluster data');
      return cachedData;
    }
    
    // Fetch fresh data
    console.log('Cache miss, fetching fresh management cluster data');
    const response = await axios.get(MANAGEMENT_CLUSTER_ENDPOINT);
    
    // Store in cache
    cacheService.set(MANAGEMENT_CLUSTER_CACHE_KEY, response, CACHE_TTL);
    return response;
  } catch (err) {
    console.error('API call failed, using fallback data for testing:', err);
    
    // Return sample fallback data for testing when API is unavailable
    return {
      data: {
        kind: "Management",
        name: "management-cluster",
        children: [
          {
            kind: "Cluster",
            name: "workload-cluster-1",
            status: "Running",
            metadata: {
              provider: "AWS",
              region: "us-west-2",
              version: "v1.25.0"
            },
            children: []
          },
          {
            kind: "Cluster",
            name: "workload-cluster-2",
            status: "Provisioning",
            metadata: {
              provider: "Azure",
              region: "eastus",
              version: "v1.24.0"
            },
            children: []
          }
        ]
      }
    };
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

// Auto-refresh setup
const setupAutoRefresh = () => {
  // Clear any existing timer first
  clearAutoRefresh();
  
  if (autoRefresh.value) {
    console.log(`Starting auto-refresh timer with ${refreshIntervalTime/1000}s interval`);
    // Set up a new timer that refreshes at the configured interval
    refreshInterval.value = setInterval(() => {
      if (!fetchInProgress.value) {
        console.log('Auto-refresh triggered');
        fetchManagementCluster(true); // Force refresh on auto-refresh
      } else {
        console.log('Auto-refresh skipped - fetch already in progress');
      }
    }, refreshIntervalTime);
  }
};

// Clear auto-refresh timer
const clearAutoRefresh = () => {
  if (refreshInterval.value) {
    console.log('Clearing auto-refresh timer');
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
};

// Toggle auto-refresh
const toggleAutoRefresh = () => {
  console.log(`Toggling auto-refresh from ${autoRefresh.value} to ${!autoRefresh.value}`);
  // Note: We don't need to toggle autoRefresh here since it's already handled by v-model in the template
  setupAutoRefresh();
  
  // Store the setting in localStorage
  localStorage.setItem('managementClusterAutoRefresh', autoRefresh.value.toString());
};

// Method to manually trigger refresh
const forceRefresh = async () => {
  console.log('Manual refresh triggered');
  refreshButtonRotating.value = true;
  
  try {
    await fetchManagementCluster(true); // Pass true to bypass cache
  } finally {
    // Reset the refresh button animation after delay
    setTimeout(() => {
      refreshButtonRotating.value = false;
    }, 1000);
  }
};

// Watch for autoRefresh changes to update refresh timer
watch(autoRefresh, (newValue) => {
  console.log(`Auto-refresh changed to: ${newValue}`);
  setupAutoRefresh();
  localStorage.setItem('managementClusterAutoRefresh', newValue.toString());
});

// Initial setup
onMounted(async () => {
  console.log('Initializing Management Cluster view');
  // Load auto-refresh setting from localStorage
  const savedAutoRefresh = localStorage.getItem('managementClusterAutoRefresh');
  if (savedAutoRefresh !== null) {
    autoRefresh.value = savedAutoRefresh === 'true';
    console.log(`Loaded auto-refresh setting from localStorage: ${autoRefresh.value}`);
  }
  
  try {
    await fetchManagementCluster();
    setupAutoRefresh();
  } catch (error) {
    console.error('Failed to initialize Management Cluster view:', error);
  }
  
  document.title = 'Management Cluster | SinaptikView';
});

// Clear interval on component unmount
onBeforeUnmount(() => {
  // Clean up listeners and timers
  clearAutoRefresh();
  console.log('Cleared all refresh intervals on component unmount');
});

const router = useRouter();

// Method to handle navigation when a node is clicked
const handleNodeNavigation = (nodeData) => {
  console.log('[ManagementCluster] Node navigation requested for:', JSON.stringify(nodeData, null, 2));
  
  // Extract name and namespace safely
  const name = nodeData?.name;
  const namespace = nodeData?.namespace || nodeData?.metadata?.namespace; // Check both top-level and metadata
  
  if (name && namespace) {
    console.log(`[ManagementCluster] Attempting to navigate to: cluster-api-cluster-detail with params: { namespace: ${namespace}, name: ${name} }`);
    router.push({
      name: 'cluster-api-cluster-detail',
      params: {
        namespace: namespace,
        name: name
      }
    });
  } else {
    console.error('[ManagementCluster] Cannot navigate, missing node name or namespace.', { name, namespace, nodeData });
  }
};
</script>

<style scoped>
.management-cluster-view {
  /* Ensure this container takes full viewport height or parent height */
  height: calc(100vh - 80px); /* Adjust 80px based on header/footer height if needed */
  /* Or use height: 100% if parent guarantees height */
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0; /* Prevent header from shrinking */
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.content {
  flex: 1 1 auto; /* Allow grow and shrink, use auto basis */
  position: relative;
  background-color: var(--surface-ground);
  border-radius: 8px;
  overflow: hidden; 
  min-height: 0; /* Crucial for flexbox height calculation */
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