<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Secrets ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingSecrets"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="secrets" :loading="loadingSecrets" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="secretError">Error loading Secrets: {{ secretError }}</div>
            <div v-else>No Secrets found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Secrets data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'secret-detail', 
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
         <Column field="type" header="Type">
             <template #body="slotProps">
                 <Tag :severity="getSecretTypeSeverity(slotProps.data.type)">
                     {{ slotProps.data.type }}
                 </Tag>
             </template>
         </Column>
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
import Tag from 'primevue/tag';

import { computed, onMounted, ref, watch } from 'vue';

// Secret refs
const secrets = ref([]);
const loadingSecrets = ref(false);
const secretError = ref(null);

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

// Get appropriate severity for secret type
const getSecretTypeSeverity = (type) => {
    switch (type) {
        case 'kubernetes.io/tls':
            return 'success';
        case 'kubernetes.io/dockerconfigjson':
        case 'kubernetes.io/dockercfg':
            return 'info';
        case 'kubernetes.io/service-account-token':
            return 'warning';
        case 'bootstrap.kubernetes.io/token':
            return 'danger';
        default:
            return 'secondary';
    }
};

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

// Fetch Secrets
const fetchSecrets = async () => {
  loadingSecrets.value = true;
  secretError.value = null;
  secrets.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/secrets?namespace=${ns}`; 
  console.log(`Fetching Secrets from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Secret fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    secrets.value = data.items || [];
  } catch (err) {
    console.error("Error fetching Secrets:", err);
    secretError.value = err.message;
  } finally {
    loadingSecrets.value = false;
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
        fetchSecrets(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchSecrets(); // Fetch initial Secrets for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 