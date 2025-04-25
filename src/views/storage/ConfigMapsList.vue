<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">ConfigMaps ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingConfigMaps"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="configMaps" :loading="loadingConfigMaps" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="configMapError">Error loading ConfigMaps: {{ configMapError }}</div>
            <div v-else>No ConfigMaps found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading ConfigMaps data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'configmap-detail', 
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
         <Column v-if="selectedNamespace === 'all'" field="metadata.namespace" header="Namespace"></Column> <!-- Show namespace if listing all -->
         <Column header="Data">
             <template #body="slotProps">
                <span v-if="slotProps.data.data">
                    {{ Object.keys(slotProps.data.data).length }} items
                </span>
                <span v-else>No data</span>
             </template>
         </Column>
         <Column header="Age">
             <template #body="slotProps">
                 {{ getAge(slotProps.data.metadata.creationTimestamp) }}
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

import { computed, onMounted, ref, watch } from 'vue';

// ConfigMap refs
const configMaps = ref([]);
const loadingConfigMaps = ref(false);
const configMapError = ref(null);

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
    const response = await fetch('/api/v1/namespaces');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    namespaces.value = data.items || [];
  } catch (error) {
    console.error("Error fetching namespaces:", error);
    namespaceError.value = error.message;
  } finally {
    loadingNamespaces.value = false;
  }
};

// Fetch ConfigMaps
const fetchConfigMaps = async () => {
  loadingConfigMaps.value = true;
  configMapError.value = null;
  configMaps.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/configmaps?namespace=${ns}`; 
  console.log(`Fetching ConfigMaps from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("ConfigMap fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    configMaps.value = data.items || [];
  } catch (err) {
    console.error("Error fetching ConfigMaps:", err);
    configMapError.value = err.message;
  } finally {
    loadingConfigMaps.value = false;
  }
};

// getAge helper function
const getAge = (timestamp) => {
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
        fetchConfigMaps(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchConfigMaps(); // Fetch initial ConfigMaps for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 