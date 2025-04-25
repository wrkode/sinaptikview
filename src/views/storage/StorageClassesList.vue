<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
            <h2 class="text-xl font-semibold">Storage Classes</h2>
        </div>
        <DataTable :value="storageClasses" :loading="loadingSC" tableStyle="min-width: 50rem">
            <template #empty> 
                <div v-if="scError">Error loading Storage Classes: {{ scError }}</div>
                <div v-else>No Storage Classes found.</div> 
            </template>
            <template #loading> Loading Storage Classes data. Please wait. </template>
            <Column field="metadata.name" header="Name">
                <template #body="slotProps">
                    <router-link 
                        :to="{ 
                            name: 'storage-class-detail', 
                            params: { 
                                name: slotProps.data.metadata.name 
                            }
                        }" 
                        class="text-primary hover:underline">
                        {{ slotProps.data.metadata.name }}
                    </router-link>
                    <Tag v-if="slotProps.data.metadata.annotations && slotProps.data.metadata.annotations['storageclass.kubernetes.io/is-default-class'] === 'true'"
                        severity="info" class="ml-2">
                        default
                    </Tag>
                </template>
            </Column>
            <Column header="Provisioner">
                <template #body="slotProps">
                    {{ slotProps.data.provisioner }}
                </template>
            </Column>
            <Column header="Reclaim Policy">
                <template #body="slotProps">
                    {{ slotProps.data.reclaimPolicy || 'Delete' }}
                </template>
            </Column>
            <Column header="Volume Binding Mode">
                <template #body="slotProps">
                    {{ slotProps.data.volumeBindingMode || 'Immediate' }}
                </template>
            </Column>
            <Column header="Allow Volume Expansion">
                <template #body="slotProps">
                    {{ slotProps.data.allowVolumeExpansion ? 'Yes' : 'No' }}
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
import Tag from 'primevue/tag';

import { onMounted, ref } from 'vue';

// StorageClass refs
const storageClasses = ref([]);
const loadingSC = ref(false);
const scError = ref(null);

// Fetch StorageClasses
const fetchStorageClasses = async () => {
  loadingSC.value = true;
  scError.value = null;
  storageClasses.value = []; 
  
  try {
    const response = await fetch('/api/v1/storageclasses');
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("StorageClass fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    storageClasses.value = data.items || [];
  } catch (err) {
    console.error("Error fetching StorageClasses:", err);
    scError.value = err.message;
  } finally {
    loadingSC.value = false;
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
  fetchStorageClasses(); 
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 