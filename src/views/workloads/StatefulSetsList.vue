<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">StatefulSets ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingStatefulSets"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="statefulsets" :loading="loadingStatefulSets" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="statefulsetError">Error loading statefulsets: {{ statefulsetError }}</div>
            <div v-else>No statefulsets found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading statefulsets data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'statefulset-detail', 
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
         <Column v-if="selectedNamespace === 'all'" field="metadata.namespace" header="Namespace"></Column>
         <Column header="Replicas">
             <template #body="slotProps">
                 <span>{{ slotProps.data.status.replicas || 0 }}/{{ slotProps.data.spec.replicas }}</span>
             </template>
         </Column>
         <Column header="Status">
             <template #body="slotProps">
                 <span :class="{
                     'status-badge': true,
                     'status-running': slotProps.data.status.replicas === slotProps.data.spec.replicas && slotProps.data.status.readyReplicas === slotProps.data.spec.replicas,
                     'status-failed': !slotProps.data.status.replicas,
                     'status-other': slotProps.data.status.replicas !== slotProps.data.spec.replicas || slotProps.data.status.readyReplicas !== slotProps.data.spec.replicas
                 }">
                     {{ getStatusText(slotProps.data) }}
                 </span>
             </template>
         </Column>
         <Column field="spec.serviceName" header="Service Name"></Column>
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

// StatefulSet refs
const statefulsets = ref([]);
const loadingStatefulSets = ref(false);
const statefulsetError = ref(null);

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

// Fetch StatefulSets
const fetchStatefulSets = async () => {
  loadingStatefulSets.value = true;
  statefulsetError.value = null;
  statefulsets.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/namespaces/${ns}/statefulsets`; 
  console.log(`Fetching statefulsets from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("StatefulSet fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    statefulsets.value = data.items || [];
  } catch (error) {
    console.error("Error fetching statefulsets:", error);
    statefulsetError.value = error.message;
  } finally {
    loadingStatefulSets.value = false;
  }
};

// Helper function to determine status text
const getStatusText = (statefulset) => {
  const { status, spec } = statefulset;
  if (!status.replicas) return 'Stopped';
  if (status.replicas === spec.replicas && status.readyReplicas === spec.replicas) return 'Running';
  return `Scaling (${status.readyReplicas || 0}/${spec.replicas})`;
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
        fetchStatefulSets(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchStatefulSets(); // Fetch initial statefulsets for default namespace
});
</script>

<style scoped>
/* Status badge styles */
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-weight: 500;
    display: inline-block;
}

.status-running {
    background-color: rgba(80, 200, 120, 0.2);
    color: #2c8c51;
}

.status-failed {
    background-color: rgba(240, 80, 80, 0.2);
    color: #e01e1e;
}

.status-other {
    background-color: rgba(240, 180, 0, 0.2);
    color: #cb9303;
}
</style> 