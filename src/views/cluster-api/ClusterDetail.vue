<template>
  <div class="cluster-detail-view">
    <div class="header">
      <div class="title-container">
        <h1>{{ clusterName }}</h1>
        <StatusBadge v-if="cluster?.status?.phase" :status="cluster.status.phase" />
      </div>
      <div class="actions">
        <Button icon="pi pi-refresh" @click="fetchClusterData" class="p-button-outlined" :disabled="loading" />
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading cluster details...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <Message severity="error" :closable="false">
        Failed to load cluster details for {{ namespace }}/{{ name }}: {{ error }}
      </Message>
      <Button label="Retry" @click="fetchClusterData" class="p-button-sm" />
    </div>
    
    <div v-else-if="cluster" class="content">
      <TabView v-model:activeIndex="activeTabIndex" @tab-change="onTabChange($event.index)">
        <TabPanel header="Overview">
          <div class="overview-section">
            <div class="metadata-panel">
              <h2>Cluster Details</h2>
              <div class="metadata-grid">
                <div class="metadata-item">
                  <div class="metadata-label">Name</div>
                  <div class="metadata-value">{{ cluster.metadata?.name }}</div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">Namespace</div>
                  <div class="metadata-value">{{ cluster.metadata?.namespace }}</div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">UID</div>
                  <div class="metadata-value">{{ cluster.metadata?.uid }}</div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">Created</div>
                  <div class="metadata-value">{{ formatDate(cluster.metadata?.creationTimestamp) }}</div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">Status</div>
                  <div class="metadata-value">
                    <StatusBadge :status="cluster.status?.phase || 'Unknown'" />
                  </div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">Infrastructure Provider</div>
                  <div class="metadata-value">
                    <span class="provider-value">
                      <i :class="getProviderIcon(infrastructureProvider)" class="provider-icon" />
                      {{ infrastructureProvider }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="conditions-panel" v-if="cluster.status?.conditions?.length > 0">
              <h2>Conditions</h2>
              <DataTable :value="cluster.status.conditions" stripedRows>
                <Column field="type" header="Type" />
                <Column field="status" header="Status" />
                <Column field="severity" header="Severity" />
                <Column field="lastTransitionTime" header="Last Transition">
                  <template #body="{ data }">
                    {{ formatDate(data.lastTransitionTime) }}
                  </template>
                </Column>
                <Column field="message" header="Message" style="white-space: pre-wrap; word-break: break-word;" />
              </DataTable>
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="Machines">
          <div class="machines-section">
            <DataTable 
              :value="machines" 
              :loading="loadingMachines"
              stripedRows
              v-if="machines.length > 0"
            >
              <Column field="metadata.name" header="Name" />
              <Column field="metadata.namespace" header="Namespace" />
              <Column field="status.phase" header="Status">
                <template #body="{ data }">
                  <StatusBadge :status="data.status?.phase || 'Unknown'" />
                </template>
              </Column>
              <Column field="spec.version" header="Version" />
              <Column field="metadata.creationTimestamp" header="Created">
                <template #body="{ data }">
                  {{ formatDate(data.metadata?.creationTimestamp) }}
                </template>
              </Column>
            </DataTable>
            
            <div v-else-if="loadingMachines" class="loading-machines">
              <i class="pi pi-spin pi-spinner"></i>
              <span>Loading machines...</span>
            </div>
            
            <div v-else class="no-machines">
              <i class="pi pi-info-circle"></i>
              <span>No machines found for this cluster</span>
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="YAML">
          <div class="yaml-section">
            <pre class="yaml-content">{{ clusterYaml }}</pre>
          </div>
        </TabPanel>
      </TabView>
    </div>
    
    <div v-else class="not-found">
      <Message severity="warn">Cluster data not found.</Message>
    </div>
  </div>
</template>

<script setup>
import cacheService from '@/services/CacheService';
import axios from 'axios';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';

import StatusBadge from '@/components/cluster-api/StatusBadge.vue';

// Get route params
const route = useRoute();
const { namespace, name } = route.params;

// Data
const cluster = shallowRef(null);
const machines = shallowRef([]);
const loading = ref(true);
const loadingMachines = ref(false);
const error = ref(null);

// Tabs
const activeTabIndex = ref(0);
const tabsLoaded = ref({
  0: false, // Overview tab
  1: false, // Machines tab
  2: false  // YAML tab
});

// Cache keys
const clusterCacheKey = `cluster:${namespace}:${name}`;
const machinesCacheKey = `machines:${namespace}:${name}`;

// Computed properties
const clusterName = computed(() => {
  return cluster.value?.metadata?.name || name;
});

const infrastructureProvider = computed(() => {
  return cluster.value?.spec?.infrastructureRef?.kind || cluster.value?.metadata?.infrastructureProvider || 'Unknown';
});

// Lazily compute YAML (show JSON for now)
const clusterYaml = computed(() => {
  if (!cluster.value || activeTabIndex.value !== 2 || !tabsLoaded.value[2]) return 'Loading YAML...';
  try {
    return JSON.stringify(cluster.value, null, 2); 
  } catch (err) {
    console.error("Error stringifying cluster data:", err);
    return "Error displaying cluster data.";
  }
});

// Methods
const fetchClusterData = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const cachedData = cacheService.get(clusterCacheKey);
    if (cachedData) {
      cluster.value = cachedData;
      loading.value = false;
      tabsLoaded.value[0] = true;
      if (activeTabIndex.value === 1) fetchMachines();
      if (activeTabIndex.value === 2) tabsLoaded.value[2] = true; // Mark YAML as loaded if viewing cached data
      return;
    }
    
    const response = await axios.get(`/api/cluster-api/clusters/${namespace}/${name}`);
    cluster.value = response.data;
    cacheService.set(clusterCacheKey, response.data, 60000);
    tabsLoaded.value[0] = true;
    if (activeTabIndex.value === 1) fetchMachines();
    if (activeTabIndex.value === 2) tabsLoaded.value[2] = true; // Mark YAML as loaded

  } catch (err) {
    console.error('Error fetching cluster details:', err);
    error.value = err.response?.data?.message || 'Failed to fetch cluster details';
  } finally {
    loading.value = false;
  }
};

const fetchMachines = async () => {
  if (tabsLoaded.value[1]) return;
  
  try {
    loadingMachines.value = true;
    const cachedMachines = cacheService.get(machinesCacheKey);
    if (cachedMachines) {
      machines.value = cachedMachines;
      tabsLoaded.value[1] = true;
      loadingMachines.value = false;
      return;
    }
    
    const response = await axios.get(`/api/cluster-api/clusters/${namespace}/${name}/machines`);
    machines.value = response.data.items || [];
    cacheService.set(machinesCacheKey, response.data.items || [], 30000);
    tabsLoaded.value[1] = true;
  } catch (err) {
    console.error('Error fetching machines:', err);
    machines.value = []; // Clear machines on error
    // Optionally set an error message specific to machines
  } finally {
    loadingMachines.value = false;
  }
};

// Handle tab change to lazy load content
const onTabChange = (index) => {
  console.log(`Tab changed to index: ${index}`);
  // No need to set activeTabIndex here, v-model handles it
  // activeTabIndex.value = index; 
  
  if (index === 1 && !tabsLoaded.value[1]) {
    fetchMachines();
  }
  else if (index === 2 && !tabsLoaded.value[2]) {
    // Mark YAML tab as loaded; computation is handled by computed property
    tabsLoaded.value[2] = true; 
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { /* Formatting options */ 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
  }).format(date);
};

const getProviderIcon = (provider) => {
  const providerLower = provider?.toString().toLowerCase() || '';
  if (providerLower.includes('azure')) return 'pi pi-microsoft';
  if (providerLower.includes('docker')) return 'pi pi-server'; 
  if (providerLower.includes('gcp')) return 'pi pi-google';
  if (providerLower.includes('aws')) return 'pi pi-amazon';
  if (providerLower.includes('vsphere')) return 'pi pi-desktop';
  // Add other providers as needed
  return 'pi pi-cloud';
};

// Lifecycle hooks
onMounted(() => {
  fetchClusterData();
  document.title = `Cluster: ${name} | SinaptikView`;
  tabsLoaded.value[0] = true; // Assume overview tab is loaded initially
});

onBeforeUnmount(() => {
  // Cleanup if needed
});
</script>

<style scoped>
.cluster-detail-view {
  height: 100%; /* Ensure it takes full height if needed */
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 1rem; /* Add gap between header and content */
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0; /* Prevent header shrinking */
}

.title-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.content {
  flex: 1; /* Allow content to grow */
  overflow: auto; /* Add scroll if content overflows */
  min-height: 0; /* Important for flex-grow in some contexts */
}

.loading-container,
.error-container,
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 1rem;
  flex: 1; /* Allow these states to take up space */
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metadata-panel, .conditions-panel {
  background-color: var(--surface-card);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.metadata-panel h2, .conditions-panel h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* Responsive grid */
  gap: 1rem 1.5rem; /* Row and column gap */
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.metadata-value {
  font-size: 1rem;
}

.provider-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-icon {
  font-size: 1.2rem;
  /* color: var(--primary-color); Optional: color the icon */
}

.yaml-section {
  position: relative;
}

.yaml-content {
  padding: 1rem;
  white-space: pre-wrap;
  word-break: break-all; /* Allow long strings to wrap */
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  background-color: var(--surface-card);
  border-radius: 6px;
  max-height: 600px; /* Limit height and allow scroll */
  overflow: auto;
}

.machines-section {
  /* Styles for machines section if needed */
}

.loading-machines, .no-machines {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-color-secondary);
  min-height: 200px; /* Ensure some space */
}

.loading-machines i, .no-machines i {
  font-size: 2rem;
}

/* Deep selectors might be needed if PrimeVue components encapsulate styles */
:deep(.p-tabview-panels) {
  padding: 1rem 0 0 0; /* Adjust padding for tab panels */
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: var(--surface-ground); /* Style datatable header */
}

</style> 