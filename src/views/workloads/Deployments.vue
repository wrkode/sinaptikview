<template>
    <div class="card">
        <div class="flex justify-between items-center mb-4">
             <h2 class="text-2xl font-bold">Deployments</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingDeployments"
                style="width: 200px;"
             />
        </div>

        <DataTable :value="deployments" :loading="loadingDeployments" tableStyle="min-width: 50rem">
            <template #empty> 
                <div v-if="error">Error loading deployments: {{ error }}</div>
                <div v-else>No deployments found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
            </template>
            <template #loading> Loading deployment data. Please wait. </template>
            
            <Column field="metadata.name" header="Name" sortable>
                <template #body="slotProps">
                     <router-link 
                        :to="{ 
                            name: 'deployment-detail', 
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
            <Column v-if="selectedNamespace === 'all'" field="metadata.namespace" header="Namespace" sortable></Column>
             <Column header="Ready">
                <template #body="slotProps">
                     {{ slotProps.data.status?.readyReplicas || 0 }} / {{ slotProps.data.spec?.replicas || 0 }}
                </template>
            </Column>
            <Column field="status.updatedReplicas" header="Up-to-date" sortable></Column>
            <Column field="status.availableReplicas" header="Available" sortable></Column>
            <Column header="Age">
                <template #body="slotProps">
                    {{ getAge(slotProps.data.metadata.creationTimestamp) }}
                </template>
            </Column>
            <!-- Add more columns like strategy, selectors later -->
        </DataTable>
    </div>
</template>

<script setup>
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import { computed, onMounted, ref, watch } from 'vue';

const deployments = ref([]);
const loadingDeployments = ref(false);
const error = ref(null);

// Namespace selection refs and logic (copied from Dashboard.vue)
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); 

const namespaceOptions = computed(() => {
    const options = namespaces.value.map(ns => ({ name: ns.metadata.name, value: ns.metadata.name }));
    return [{ name: 'All Namespaces', value: 'all' }, ...options];
});

const fetchNamespaces = async () => {
  loadingNamespaces.value = true;
  namespaceError.value = null;
  try {
    const response = await fetch('/api/v1/namespaces');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    namespaces.value = data.items || [];
  } catch (err) {
    console.error("Error fetching namespaces:", err);
    namespaceError.value = err.message;
  } finally {
    loadingNamespaces.value = false;
  }
};

// Fetch Deployments
const fetchDeployments = async () => {
  loadingDeployments.value = true;
  error.value = null;
  deployments.value = []; 
  const ns = selectedNamespace.value; 
  // Use new endpoint, default to 'default' if nothing selected (or handle differently if preferred)
  const effectiveNs = ns || 'default'; 
  const url = `/api/v1/namespaces/${effectiveNs}/deployments`; 
  console.log(`Fetching deployments from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Deployment fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    deployments.value = data.items || [];
  } catch (err) {
    console.error("Error fetching deployments:", err);
    error.value = err.message;
  } finally {
    loadingDeployments.value = false;
  }
};

// Reusable getAge function
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
        fetchDeployments(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces();
  fetchDeployments(); // Fetch deployments for default namespace
});

</script> 