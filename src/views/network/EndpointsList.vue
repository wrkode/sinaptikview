<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Endpoints ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingEndpoints"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="endpoints" :loading="loadingEndpoints" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="endpointsError">Error loading Endpoints: {{ endpointsError }}</div>
            <div v-else>No Endpoints found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Endpoints data. Please wait. </template>
         <Column field="metadata.name" header="Name" :sortable="true">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'endpoint-detail', 
                        params: { 
                            namespace: slotProps.data.metadata.namespace, 
                            name: slotProps.data.metadata.name 
                        }
                    }" 
                    class="text-primary hover:underline">
                     {{ slotProps.data.metadata.name }}
                 </router-link>
             </template>
         </Column>
         <Column v-if="selectedNamespace === 'all'" field="metadata.namespace" header="Namespace" :sortable="true"></Column>
         <Column header="Addresses">
            <template #body="slotProps">
              <div v-if="getTotalAddresses(slotProps.data) > 0">
                <Tag severity="success">{{ getReadyAddresses(slotProps.data) }} Ready</Tag>
                <Tag v-if="getNotReadyAddresses(slotProps.data) > 0" severity="warning" class="ml-2">{{ getNotReadyAddresses(slotProps.data) }} Not Ready</Tag>
              </div>
              <div v-else>
                <Tag severity="info">No Addresses</Tag>
              </div>
            </template>
         </Column>
         <Column header="Ports">
            <template #body="slotProps">
              <div v-if="getPorts(slotProps.data).length > 0">
                <Tag v-for="(port, index) in getPortsForDisplay(slotProps.data)" :key="index" 
                  severity="info" 
                  class="mr-1 mb-1">
                  {{ port }}
                </Tag>
                <span v-if="getPorts(slotProps.data).length > 3">
                  +{{ getPorts(slotProps.data).length - 3 }} more
                </span>
              </div>
              <div v-else>
                <Tag severity="info">No Ports</Tag>
              </div>
            </template>
         </Column>
         <Column header="Age" :sortable="true">
             <template #body="slotProps">
                 {{ calculateAge(slotProps.data.metadata.creationTimestamp) }}
             </template>
         </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
// Import necessary components
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';

import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';

// Endpoints refs
const endpoints = ref([]);
const loadingEndpoints = ref(true);
const endpointsError = ref(null);

// Namespace refs
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); // Default namespace

// Computed property for dropdown options
const namespaceOptions = computed(() => {
    const options = namespaces.value.map(ns => ({ name: ns.metadata.name, value: ns.metadata.name }));
    return [{ name: 'All Namespaces', value: 'all' }, ...options];
});

// Fetch Namespaces
const fetchNamespaces = async () => {
  loadingNamespaces.value = true;
  namespaceError.value = null;
  try {
    const response = await axios.get('/api/v1/namespaces');
    if (!response.data) {
      throw new Error('Invalid response format');
    }
    namespaces.value = response.data.items || [];
  } catch (error) {
    console.error("Error fetching namespaces:", error);
    namespaceError.value = error.message;
  } finally {
    loadingNamespaces.value = false;
  }
};

// Fetch Endpoints
const fetchEndpoints = async () => {
  loadingEndpoints.value = true;
  endpointsError.value = null;
  endpoints.value = [];
  
  try {
    let url = '/api/v1/endpoints';
    if (selectedNamespace.value !== 'all') {
      url = `/api/v1/endpoints?namespace=${selectedNamespace.value}`;
    }
    
    const response = await axios.get(url);
    if (!response.data) {
      throw new Error('Invalid response format');
    }
    endpoints.value = response.data.items || [];
  } catch (err) {
    console.error("Error fetching endpoints:", err);
    endpointsError.value = err.message || 'Failed to load endpoints';
  } finally {
    loadingEndpoints.value = false;
  }
};

// Helper functions for endpoints data
const getTotalAddresses = (endpoint) => {
  let total = 0;
  if (endpoint.subsets) {
    endpoint.subsets.forEach(subset => {
      if (subset.addresses) {
        total += subset.addresses.length;
      }
      if (subset.notReadyAddresses) {
        total += subset.notReadyAddresses.length;
      }
    });
  }
  return total;
};

const getReadyAddresses = (endpoint) => {
  let total = 0;
  if (endpoint.subsets) {
    endpoint.subsets.forEach(subset => {
      if (subset.addresses) {
        total += subset.addresses.length;
      }
    });
  }
  return total;
};

const getNotReadyAddresses = (endpoint) => {
  let total = 0;
  if (endpoint.subsets) {
    endpoint.subsets.forEach(subset => {
      if (subset.notReadyAddresses) {
        total += subset.notReadyAddresses.length;
      }
    });
  }
  return total;
};

const getPorts = (endpoint) => {
  let ports = [];
  if (endpoint.subsets) {
    endpoint.subsets.forEach(subset => {
      if (subset.ports) {
        ports = ports.concat(subset.ports);
      }
    });
  }
  return ports;
};

const getPortsForDisplay = (endpoint) => {
  const ports = getPorts(endpoint);
  if (ports.length === 0) return [];
  
  // Return only first 3 ports for display
  return ports.slice(0, 3).map(port => {
    let display = `${port.port}/${port.protocol}`;
    if (port.name) {
      display = `${port.name}: ${display}`;
    }
    return display;
  });
};

// getAge helper function
const calculateAge = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const now = new Date();
  const created = new Date(timestamp);
  const diffSeconds = Math.floor((now - created) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

// Watch for namespace changes
watch(selectedNamespace, (newNamespace, oldNamespace) => {
    if (newNamespace !== oldNamespace) {
        console.log(`Namespace changed to: ${newNamespace}`);
        fetchEndpoints(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchEndpoints(); // Fetch initial Endpoints
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 