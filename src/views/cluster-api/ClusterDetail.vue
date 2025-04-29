<template>
  <div class="cluster-detail-view">
    <div class="header">
      <div class="title-container">
        <h1>{{ clusterName }}</h1>
        <StatusBadge v-if="cluster" :status="cluster.status?.phase || 'Unknown'" />
      </div>
      <div class="actions">
        <Button icon="pi pi-refresh" @click="fetchClusterData" class="p-button-outlined" />
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading cluster data...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <Message severity="error" :closable="false">
        <template #content>
          <p>{{ error }}</p>
          <Button label="Retry" @click="fetchClusterData" class="p-button-sm" />
        </template>
      </Message>
    </div>
    
    <div v-else-if="cluster" class="content">
      <TabView @tab-change="onTabChange">
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
            
            <div class="conditions-panel" v-if="cluster.status?.conditions">
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
                <Column field="message" header="Message" />
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
            <div class="yaml-actions">
              <Button icon="pi pi-copy" @click="copyYaml" class="p-button-text" />
            </div>
            <pre class="yaml-content">{{ clusterYaml }}</pre>
          </div>
        </TabPanel>
      </TabView>
    </div>
    
    <Toast />
  </div>
</template>

<script setup>
import cacheService from '@/services/CacheService';
import axios from 'axios';
import yaml from 'js-yaml';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Toast from 'primevue/toast';

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
let yamlGenerationTimeout = null;

// Tabs
const activeTabIndex = ref(0);
const tabsLoaded = ref({
  0: false, // Overview tab
  1: false, // Machines tab
  2: false  // YAML tab
});

// Toast
const toast = useToast();

// Cache keys
const clusterCacheKey = `cluster:${namespace}:${name}`;
const machinesCacheKey = `machines:${namespace}:${name}`;

// Computed properties
const clusterName = computed(() => {
  return cluster.value?.metadata?.name || name;
});

const infrastructureProvider = computed(() => {
  if (cluster.value?.spec?.infrastructureRef) {
    return cluster.value.spec.infrastructureRef.kind || 'Unknown';
  }
  return 'Unknown';
});

// Lazily compute YAML only when needed
const clusterYaml = computed(() => {
  if (!cluster.value || activeTabIndex.value !== 2 || !tabsLoaded.value[2]) return '';
  return ''; // Will be populated asynchronously
});

// Methods
const fetchClusterData = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    // Try to use cached data first
    const cachedData = cacheService.get(clusterCacheKey);
    if (cachedData) {
      cluster.value = cachedData;
      loading.value = false;
      tabsLoaded.value[0] = true;
      
      // Only fetch machines if we need them
      if (activeTabIndex.value === 1) {
        fetchMachines();
      }
      return;
    }
    
    const response = await axios.get(`/api/cluster-api/clusters/${namespace}/${name}`);
    cluster.value = response.data;
    
    // Cache the result (60 seconds TTL)
    cacheService.set(clusterCacheKey, response.data, 60000);
    
    // Mark overview tab as loaded
    tabsLoaded.value[0] = true;
    
    // Only fetch machines if we need them (user selects the tab)
    if (activeTabIndex.value === 1) {
      fetchMachines();
    }
  } catch (err) {
    console.error('Error fetching cluster details:', err);
    error.value = err.response?.data?.message || 'Failed to fetch cluster details';
  } finally {
    loading.value = false;
  }
};

const fetchMachines = async () => {
  if (tabsLoaded.value[1]) return; // Already loaded
  
  try {
    loadingMachines.value = true;
    
    // Try to use cached data first
    const cachedMachines = cacheService.get(machinesCacheKey);
    if (cachedMachines) {
      machines.value = cachedMachines;
      tabsLoaded.value[1] = true;
      loadingMachines.value = false;
      return;
    }
    
    const response = await axios.get(`/api/cluster-api/clusters/${namespace}/${name}/machines`);
    machines.value = response.data.items || [];
    
    // Cache the result (30 seconds TTL)
    cacheService.set(machinesCacheKey, response.data.items || [], 30000);
    
    // Mark machines tab as loaded
    tabsLoaded.value[1] = true;
  } catch (err) {
    console.error('Error fetching machines:', err);
    machines.value = [];
  } finally {
    loadingMachines.value = false;
  }
};

// Handle tab change to lazy load content
const onTabChange = (index) => {
  activeTabIndex.value = index;
  
  if (index === 1 && !tabsLoaded.value[1]) {
    // Load machines data when Machines tab is selected
    fetchMachines();
  }
  else if (index === 2 && !tabsLoaded.value[2]) {
    // Load YAML data when YAML tab is selected
    tabsLoaded.value[2] = true;
    
    // Generate YAML asynchronously with a worker if available
    generateYamlAsync();
  }
};

const generateYamlAsync = () => {
  if (yamlGenerationTimeout) {
    clearTimeout(yamlGenerationTimeout);
  }
  
  // First show immediate feedback with a small JSON sample
  const yamlElement = document.querySelector('.yaml-content');
  if (yamlElement && cluster.value) {
    const previewData = {
      apiVersion: cluster.value.apiVersion,
      kind: cluster.value.kind,
      metadata: {
        name: cluster.value.metadata?.name,
        namespace: cluster.value.metadata?.namespace
      }
    };
    yamlElement.textContent = "Loading full YAML...\n\n" + JSON.stringify(previewData, null, 2);
  }
  
  // Then generate the full YAML asynchronously
  yamlGenerationTimeout = setTimeout(() => {
    try {
      if (!cluster.value) return;
      
      // This could be moved to a web worker for large objects
      const yamlData = yaml.dump(cluster.value);
      
      if (yamlElement) {
        yamlElement.textContent = yamlData;
      }
    } catch (err) {
      console.error('Error generating YAML:', err);
      if (yamlElement) {
        yamlElement.textContent = "Error generating YAML: " + err.message;
      }
    }
  }, 100);
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getProviderIcon = (provider) => {
  switch (provider) {
    case 'AzureCluster':
      return 'pi pi-microsoft';
    case 'DockerCluster':
      return 'pi pi-server';
    case 'GCPCluster':
      return 'pi pi-google';
    case 'AWSCluster':
      return 'pi pi-amazon';
    default:
      return 'pi pi-cloud';
  }
};

const copyYaml = () => {
  const yamlElement = document.querySelector('.yaml-content');
  if (yamlElement) {
    navigator.clipboard.writeText(yamlElement.textContent)
      .then(() => {
        toast.add({ severity: 'success', summary: 'Copied', detail: 'YAML copied to clipboard', life: 3000 });
      })
      .catch(err => {
        console.error('Error copying YAML:', err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to copy YAML', life: 3000 });
      });
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchClusterData();
  document.title = `Cluster: ${name} | SinaptikView`;
  
  // Set default tab to loaded
  tabsLoaded.value[0] = true;
});

// Cleanup on component destroy
onBeforeUnmount(() => {
  if (yamlGenerationTimeout) {
    clearTimeout(yamlGenerationTimeout);
  }
});
</script>

<style scoped>
.cluster-detail-view {
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
  flex: 1;
  overflow: auto;
}

.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.metadata-panel, .conditions-panel {
  background-color: var(--surface-card);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  color: var(--primary-color);
}

.yaml-section {
  position: relative;
  background-color: var(--surface-ground);
  border-radius: 8px;
  height: 100%;
}

.yaml-actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1;
}

.yaml-content {
  padding: 1.5rem;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  overflow: auto;
  max-height: 600px;
  background-color: var(--surface-card);
  border-radius: 8px;
}

.machines-section {
  height: 100%;
}

.loading-machines, .no-machines {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-color-secondary);
}

.loading-machines i, .no-machines i {
  font-size: 2rem;
}
</style> 