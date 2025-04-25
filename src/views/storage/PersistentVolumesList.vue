<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Persistent Volumes</h2>
        </div>
       <DataTable :value="persistentVolumes" :loading="loadingPVs" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="pvError">Error loading Persistent Volumes: {{ pvError }}</div>
            <div v-else>No Persistent Volumes found.</div> 
         </template>
         <template #loading> Loading Persistent Volumes data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'persistent-volume-detail', 
                        params: { 
                            name: slotProps.data.metadata.name 
                        }
                    }" 
                    class="text-primary hover:underline">
                     {{ slotProps.data.metadata.name }}
                 </router-link>
             </template>
         </Column>
         <Column header="Capacity">
             <template #body="slotProps">
                 {{ slotProps.data.spec.capacity?.storage || '-' }}
             </template>
         </Column>
         <Column header="Access Modes">
             <template #body="slotProps">
                 {{ slotProps.data.spec.accessModes?.join(', ') || '-' }}
             </template>
         </Column>
         <Column header="Reclaim Policy">
             <template #body="slotProps">
                 {{ slotProps.data.spec.persistentVolumeReclaimPolicy || '-' }}
             </template>
         </Column>
         <Column header="Status">
             <template #body="slotProps">
                 <span :class="{
                     'status-badge': true,
                     'status-bound': slotProps.data.status.phase === 'Bound',
                     'status-available': slotProps.data.status.phase === 'Available',
                     'status-released': slotProps.data.status.phase === 'Released',
                     'status-failed': slotProps.data.status.phase === 'Failed'
                 }">
                     {{ slotProps.data.status.phase }}
                 </span>
             </template>
         </Column>
         <Column header="Claim">
             <template #body="slotProps">
                 <span v-if="slotProps.data.spec.claimRef">
                     {{ slotProps.data.spec.claimRef.namespace }}/{{ slotProps.data.spec.claimRef.name }}
                 </span>
                 <span v-else>-</span>
             </template>
         </Column>
         <Column header="Storage Class">
             <template #body="slotProps">
                 {{ slotProps.data.spec.storageClassName || '-' }}
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

import { onMounted, ref } from 'vue';

// PV refs
const persistentVolumes = ref([]);
const loadingPVs = ref(false);
const pvError = ref(null);

// Fetch PVs
const fetchPVs = async () => {
  loadingPVs.value = true;
  pvError.value = null;
  persistentVolumes.value = []; 
  
  try {
    const response = await fetch('/api/v1/persistentvolumes');
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("PV fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    persistentVolumes.value = data.items || [];
  } catch (err) {
    console.error("Error fetching PVs:", err);
    pvError.value = err.message;
  } finally {
    loadingPVs.value = false;
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

// Fetch initial data
onMounted(() => {
  fetchPVs(); 
});
</script>

<style scoped>
/* Add specific styles if needed */
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-weight: 500;
    display: inline-block;
}

.status-bound {
    background-color: rgba(80, 200, 120, 0.2);
    color: #2c8c51;
}

.status-available {
    background-color: rgba(60, 160, 240, 0.2);
    color: #3478bd;
}

.status-released {
    background-color: rgba(240, 180, 0, 0.2);
    color: #cb9303;
}

.status-failed {
    background-color: rgba(240, 80, 80, 0.2);
    color: #e01e1e;
}
</style> 