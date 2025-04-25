<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">ReplicaSets ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingReplicaSets"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="replicasets" :loading="loadingReplicaSets" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="replicasetError">Error loading replicasets: {{ replicasetError }}</div>
            <div v-else>No replicasets found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading replicasets data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'replicaset-detail', 
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
                 <span>{{ slotProps.data.status.availableReplicas || 0 }}/{{ slotProps.data.spec.replicas }}</span>
             </template>
         </Column>
         <Column header="Status">
             <template #body="slotProps">
                 <span :class="{
                     'status-badge': true,
                     'status-running': isReplicaSetReady(slotProps.data),
                     'status-failed': !slotProps.data.status.availableReplicas,
                     'status-other': !isReplicaSetReady(slotProps.data) && slotProps.data.status.availableReplicas > 0
                 }">
                     {{ getReplicaSetStatusText(slotProps.data) }}
                 </span>
             </template>
         </Column>
         <Column header="Owner">
             <template #body="slotProps">
                <span>{{ getOwnerText(slotProps.data) }}</span>
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

// ReplicaSet refs
const replicasets = ref([]);
const loadingReplicaSets = ref(false);
const replicasetError = ref(null);

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

// Fetch ReplicaSets
const fetchReplicaSets = async () => {
  loadingReplicaSets.value = true;
  replicasetError.value = null;
  replicasets.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/namespaces/${ns}/replicasets`; 
  console.log(`Fetching replicasets from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("ReplicaSet fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    replicasets.value = data.items || [];
  } catch (error) {
    console.error("Error fetching replicasets:", error);
    replicasetError.value = error.message;
  } finally {
    loadingReplicaSets.value = false;
  }
};

// Helper function to check if ReplicaSet is ready
const isReplicaSetReady = (replicaset) => {
  const { status, spec } = replicaset;
  return status.availableReplicas === spec.replicas && 
         spec.replicas > 0;
};

// Helper function to determine status text
const getReplicaSetStatusText = (replicaset) => {
  const { status, spec } = replicaset;
  if (!status.availableReplicas) return 'Not Ready';
  if (isReplicaSetReady(replicaset)) return 'Ready';
  return `Scaling (${status.availableReplicas}/${spec.replicas})`;
};

// Helper function to get owner information
const getOwnerText = (replicaset) => {
  if (!replicaset.metadata.ownerReferences || replicaset.metadata.ownerReferences.length === 0) {
    return 'None';
  }
  
  const owner = replicaset.metadata.ownerReferences[0];
  return `${owner.kind}/${owner.name}`;
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
        fetchReplicaSets(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchReplicaSets(); // Fetch initial replicasets for default namespace
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