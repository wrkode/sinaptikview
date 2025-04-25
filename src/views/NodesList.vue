<template>
  <div class="card">
    <h2 class="text-2xl font-bold mb-4">Nodes</h2>
    
     <DataTable :value="nodes" :loading="loading" tableStyle="min-width: 50rem">
        <template #empty> 
            <div v-if="error">Error loading nodes: {{ error }}</div>
            <div v-else>No nodes found.</div> 
        </template>
        <template #loading> Loading nodes data. Please wait. </template>
        <Column field="metadata.name" header="Name" sortable>
            <template #body="slotProps">
                 <router-link :to="{ name: 'node-detail', params: { name: slotProps.data.metadata.name } }" class="text-primary hover:underline">
                     {{ slotProps.data.metadata.name }}
                 </router-link>
             </template>
        </Column>
        <Column header="Status">
            <template #body="slotProps">
                <Tag :severity="getStatusSeverity(getNodeStatus(slotProps.data))">{{ getNodeStatus(slotProps.data) }}</Tag>
            </template>
        </Column>
        <Column field="status.nodeInfo.kubeletVersion" header="Kubelet Version" sortable></Column>
        <Column field="status.nodeInfo.operatingSystem" header="OS"></Column>
        <Column field="status.nodeInfo.architecture" header="Architecture"></Column>
         <Column header="Age">
           <template #body="slotProps">
               {{ getAge(slotProps.data.metadata.creationTimestamp) }}
           </template>
      </Column>
        <!-- Add more columns as needed -->
      </DataTable>

  </div>
</template>

<script setup>
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Tag from 'primevue/tag';
import { onMounted, ref } from 'vue';

const nodes = ref([]);
const loading = ref(false);
const error = ref(null);

// Fetch Nodes
const fetchNodes = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/v1/nodes');
    if (!response.ok) {
        const errorData = await response.text();
        console.error("Node list fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    nodes.value = data.items || [];
  } catch (err) {
    console.error("Error fetching nodes:", err);
    error.value = err.message;
    nodes.value = []; // Clear nodes on error
  } finally {
    loading.value = false;
  }
};

// Helper to get Node Status
const getNodeStatus = (node) => {
  const readyCondition = node.status?.conditions?.find(c => c.type === 'Ready');
  return readyCondition ? readyCondition.status : 'Unknown';
};

// Helper to get status severity for Tag component
const getStatusSeverity = (status) => {
  switch (status?.toLowerCase()) {
    case 'true':
      return 'success';
    case 'false':
      return 'danger';
    default:
      return 'warning'; // For Unknown/other statuses
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

onMounted(() => {
  fetchNodes();
});

</script> 