<template>
  <div class="card p-fluid">
    <!-- Remove Cluster Overview Title if Pods are the main focus now -->
    <!-- <h1 class="text-2xl font-bold mb-4">Cluster Overview</h1> -->

    <!-- Remove Nodes Section -->
    <!-- 
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-2">Nodes</h2>
      <DataTable :value="nodes" :loading="loadingNodes" tableStyle="min-width: 50rem">
         ...
      </DataTable>
    </div> 
    -->

    <!-- Keep Pods Section -->
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Pods ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingPods"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="pods" :loading="loadingPods" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="podError">Error loading pods: {{ podError }}</div>
            <div v-else>No pods found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading pods data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'pod-detail', 
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
         <Column field="status.phase" header="Status"></Column>
         <Column field="status.podIP" header="Pod IP"></Column>
         <Column field="spec.nodeName" header="Node"></Column>
         <Column header="Age">
             <template #body="slotProps">
                 {{ getAge(slotProps.data.metadata.creationTimestamp) }}
             </template>
         </Column>
         <!-- Add more columns as needed -->
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

// Remove node refs
// const nodes = ref([]);
// const loadingNodes = ref(false);
// const nodeError = ref(null);

// Keep pod refs
const pods = ref([]);
const loadingPods = ref(false);
const podError = ref(null);

// Keep namespace refs
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); 

// Keep namespaceOptions computed property
const namespaceOptions = computed(() => {
    const options = namespaces.value.map(ns => ({ name: ns.metadata.name, value: ns.metadata.name }));
    return [{ name: 'All Namespaces', value: 'all' }, ...options];
});

// Keep fetchNamespaces function
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

// Remove fetchNodes function
/*
const fetchNodes = async () => {
  ...
};
*/

// Keep fetchPods function
const fetchPods = async () => {
  loadingPods.value = true;
  podError.value = null;
  pods.value = []; 
  const ns = selectedNamespace.value; 
  const url = ns ? `/api/v1/pods?namespace=${ns}` : '/api/v1/pods';
  console.log(`Fetching pods from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Pod fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    pods.value = data.items || [];
  } catch (error) {
    console.error("Error fetching pods:", error);
    podError.value = error.message;
  } finally {
    loadingPods.value = false;
  }
};

// Remove getNodeStatus helper function
/*
const getNodeStatus = (node) => {
  ...
};
*/

// Keep getAge helper function
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

// Keep namespace watcher
watch(selectedNamespace, (newNamespace, oldNamespace) => {
    if (newNamespace !== oldNamespace) {
        console.log(`Namespace changed to: ${newNamespace}`);
        fetchPods(); 
    }
});

// Fetch initial data when component mounts
onMounted(() => {
  // Remove fetchNodes()
  fetchNamespaces(); 
  fetchPods(); 
});
</script>

<style scoped>
/* Add any specific styles for this view here */
</style> 