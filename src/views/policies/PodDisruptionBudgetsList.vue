<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Pod Disruption Budgets ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingPdbs"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="pdbs" :loading="loadingPdbs" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="pdbsError">Error loading Pod Disruption Budgets: {{ pdbsError }}</div>
            <div v-else>No Pod Disruption Budgets found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Pod Disruption Budgets data. Please wait. </template>
         <Column field="metadata.name" header="Name" sortable>
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'poddisruptionbudget-detail', 
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
         <Column field="metadata.namespace" header="Namespace" sortable v-if="selectedNamespace === 'all'"></Column>
         <Column header="Min Available">
            <template #body="slotProps">
              {{ slotProps.data.spec.minAvailable || 'N/A' }}
            </template>
         </Column>
         <Column header="Max Unavailable">
            <template #body="slotProps">
              {{ slotProps.data.spec.maxUnavailable || 'N/A' }}
            </template>
         </Column>
         <Column header="Status">
            <template #body="slotProps">
              <Tag :severity="getStatusSeverity(slotProps.data)">
                {{ getStatusLabel(slotProps.data) }}
              </Tag>
            </template>
         </Column>
         <Column header="Selector">
            <template #body="slotProps">
              <div v-if="slotProps.data.spec.selector && slotProps.data.spec.selector.matchLabels">
                <span v-for="(value, key) in slotProps.data.spec.selector.matchLabels" :key="key" class="mr-2">
                  <Tag>{{ key }}: {{ value }}</Tag>
                </span>
              </div>
              <div v-else>None</div>
            </template>
         </Column>
         <Column header="Allowed Disruptions">
            <template #body="slotProps">
              {{ slotProps.data.status?.disruptionsAllowed || '0' }}
            </template>
         </Column>
         <Column header="Age">
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
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

const toast = useToast();

// Reactive state
const pdbs = ref([]);
const loadingPdbs = ref(true);
const pdbsError = ref(null);
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); // Default namespace

// Computed properties
const namespaceOptions = computed(() => {
  if (namespaceError.value) {
    return [{ name: 'All Namespaces', value: 'all' }];
  }
  
  return [
    { name: 'All Namespaces', value: 'all' },
    ...namespaces.value.map(ns => ({
      name: ns.metadata.name,
      value: ns.metadata.name
    }))
  ];
});

// Methods
const fetchNamespaces = async () => {
  loadingNamespaces.value = true;
  namespaceError.value = null;
  
  try {
    const response = await axios.get('/api/v1/namespaces');
    namespaces.value = response.data.items;
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    namespaceError.value = error.message || 'Failed to load namespaces';
    toast.add({ 
      severity: 'error', 
      summary: 'Error loading namespaces', 
      detail: error.message || 'Failed to load namespaces',
      life: 5000 
    });
  } finally {
    loadingNamespaces.value = false;
  }
};

const fetchPodDisruptionBudgets = async () => {
  loadingPdbs.value = true;
  pdbsError.value = null;
  
  try {
    const response = await axios.get('/api/v1/poddisruptionbudgets', {
      params: { namespace: selectedNamespace.value }
    });
    pdbs.value = response.data.items || [];
  } catch (error) {
    console.error('Error fetching pod disruption budgets:', error);
    pdbsError.value = error.message || 'Failed to load pod disruption budgets';
    toast.add({ 
      severity: 'error', 
      summary: 'Error loading Pod Disruption Budgets', 
      detail: error.message || 'Failed to load pod disruption budgets',
      life: 5000 
    });
  } finally {
    loadingPdbs.value = false;
  }
};

// Helpers
const calculateAge = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours > 0) {
    return `${diffHours}h`;
  }
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${diffMinutes}m`;
};

const getStatusLabel = (pdb) => {
  if (!pdb.status) {
    return 'Unknown';
  }

  const disruptionsAllowed = pdb.status.disruptionsAllowed || 0;
  const currentHealthy = pdb.status.currentHealthy || 0;
  const desiredHealthy = pdb.status.desiredHealthy || 0;
  
  if (disruptionsAllowed === 0 && currentHealthy <= desiredHealthy) {
    return 'No Disruptions Allowed';
  } else if (currentHealthy > desiredHealthy) {
    return 'Healthy';
  } else {
    return `${disruptionsAllowed} Disruptions Allowed`;
  }
};

const getStatusSeverity = (pdb) => {
  if (!pdb.status) {
    return 'secondary';
  }

  const disruptionsAllowed = pdb.status.disruptionsAllowed || 0;
  const currentHealthy = pdb.status.currentHealthy || 0;
  const desiredHealthy = pdb.status.desiredHealthy || 0;
  
  if (disruptionsAllowed === 0 && currentHealthy <= desiredHealthy) {
    return 'warning';
  } else if (currentHealthy > desiredHealthy) {
    return 'success';
  } else {
    return 'info';
  }
};

// Watchers
watch(selectedNamespace, (newNamespace, oldNamespace) => {
    if (newNamespace !== oldNamespace) {
        console.log(`Namespace changed to: ${newNamespace}`);
        fetchPodDisruptionBudgets(); 
    }
});

// Lifecycle hooks
onMounted(() => {
  fetchNamespaces();
  fetchPodDisruptionBudgets();
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 