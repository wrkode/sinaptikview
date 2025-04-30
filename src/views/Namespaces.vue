<template>
  <div class="card">
    <Toolbar class="mb-4">
        <template #start>
            <h2 class="text-2xl font-bold my-0">Namespaces</h2>
        </template>

        <template #end>
            <Button label="Create Namespace" icon="pi pi-plus" @click="goToCreateNamespace" />
        </template>
    </Toolbar>
    
    <DataTable :value="namespaces" :loading="loading" tableStyle="min-width: 50rem">
      <template #empty> 
            <div v-if="error">Error loading namespaces: {{ error }}</div>
            <div v-else>No namespaces found.</div> 
      </template>
      <template #loading> Loading namespace data. Please wait. </template>
      
      <Column field="metadata.name" header="Name" sortable>
           <template #body="slotProps">
               <router-link :to="{ name: 'namespace-detail', params: { name: slotProps.data.metadata.name } }" class="text-primary hover:underline">
                    {{ slotProps.data.metadata.name }}
               </router-link>
           </template>
      </Column>
      <Column header="Status">
          <template #body="slotProps">
              <Tag :severity="getStatusSeverity(slotProps.data.status?.phase)">{{ slotProps.data.status?.phase }}</Tag>
          </template>
      </Column>
      <Column header="Age">
           <template #body="slotProps">
               {{ getAge(slotProps.data.metadata.creationTimestamp) }}
           </template>
      </Column>
       <!-- Add Labels/Annotations columns if needed -->
    </DataTable>

  </div>
</template>

<script setup>
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Tag from 'primevue/tag';
import Toolbar from 'primevue/toolbar';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const namespaces = ref([]);
const loading = ref(false);
const error = ref(null);

// Helper to get status severity for Tag component
const getStatusSeverity = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'terminating':
      return 'warning';
    default:
      return 'info';
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

// Fetch Namespaces
const fetchNamespaces = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/v1/namespaces');
    if (!response.ok) {
        const errorData = await response.text();
        console.error("Namespace fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    namespaces.value = data.items || [];
  } catch (err) {
    console.error("Error fetching namespaces:", err);
    error.value = err.message;
    namespaces.value = []; // Clear namespaces on error
  } finally {
    loading.value = false;
  }
};

const goToCreateNamespace = () => {
  // Implement the logic to navigate to the namespace creation page
  console.log("Navigating to create namespace");
  router.push({ name: 'namespace-create' });
};

onMounted(() => {
  fetchNamespaces();
});

</script> 