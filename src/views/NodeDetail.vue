<template>
  <div class="card p-fluid">
    <h2 class="text-2xl font-bold mb-4">Node Details: {{ nodeName }}</h2>

    <div v-if="loading">Loading node details...</div>
    <div v-else-if="error">Error loading node details: {{ error }}</div>
    
    <div v-else-if="nodeDetails">
      <Fieldset legend="Metadata" :toggleable="true">
        <p><strong>UID:</strong> {{ nodeDetails.metadata?.uid }}</p>
        <p><strong>Created:</strong> {{ getAge(nodeDetails.metadata?.creationTimestamp) }} ago ({{ new Date(nodeDetails.metadata?.creationTimestamp).toLocaleString() }})</p>
         <div class="mt-2">
            <strong>Labels:</strong>
            <div v-if="nodeDetails.metadata?.labels">
                <Tag v-for="(value, key) in nodeDetails.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
            </div>
            <div v-else>None</div>
        </div>
         <div class="mt-2">
            <strong>Annotations:</strong>
             <div v-if="annotationCount > 0">
                 <Tag v-for="(value, key) in nodeDetails.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                 <!-- Full annotations could be shown in a dialog or separate section if needed -->
                 <p>({{ annotationCount }} total)</p>
            </div>
             <div v-else>None</div>
        </div>
      </Fieldset>

      <Fieldset legend="Status" class="mt-4" :toggleable="true">
        <p><strong>Phase:</strong> {{ nodeDetails.status?.phase || 'N/A' }}</p> <!-- Although nodes don't really have a phase -->
        <p><strong>Kubelet Version:</strong> {{ nodeDetails.status?.nodeInfo?.kubeletVersion }}</p>
        <p><strong>OS:</strong> {{ nodeDetails.status?.nodeInfo?.operatingSystem }} / {{ nodeDetails.status?.nodeInfo?.architecture }}</p>
        <p><strong>Container Runtime:</strong> {{ nodeDetails.status?.nodeInfo?.containerRuntimeVersion }}</p>
        <h4 class="text-lg font-semibold mt-3 mb-2">Conditions:</h4>
        <DataTable :value="nodeDetails.status?.conditions" tableStyle="min-width: 30rem">
           <Column field="type" header="Type"></Column>
           <Column field="status" header="Status"></Column>
           <Column field="lastTransitionTime" header="Last Transition">
                 <template #body="slotProps">
                    {{ getAge(slotProps.data.lastTransitionTime) }} ago
                 </template>
           </Column>
           <Column field="reason" header="Reason"></Column>
           <Column field="message" header="Message"></Column>
        </DataTable>

         <h4 class="text-lg font-semibold mt-3 mb-2">Addresses:</h4>
         <DataTable :value="nodeDetails.status?.addresses" tableStyle="min-width: 30rem">
            <Column field="type" header="Type"></Column>
            <Column field="address" header="Address"></Column>
         </DataTable>
        
         <h4 class="text-lg font-semibold mt-3 mb-2">Capacity:</h4>
         <pre>{{ nodeDetails.status?.capacity }}</pre> 
         <h4 class="text-lg font-semibold mt-3 mb-2">Allocatable:</h4>
         <pre>{{ nodeDetails.status?.allocatable }}</pre>
        
      </Fieldset>

      <!-- Add more sections for Spec, etc. as needed -->

    </div>
    <div v-else>
        Node not found.
    </div>
  </div>
</template>

<script setup>
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Fieldset from 'primevue/fieldset'; // For grouping sections
import Tag from 'primevue/tag'; // For labels/annotations
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const nodeName = computed(() => route.params.name);
const nodeDetails = ref(null);
const loading = ref(false);
const error = ref(null);

const annotationCount = computed(() => nodeDetails.value?.metadata?.annotations ? Object.keys(nodeDetails.value.metadata.annotations).length : 0);

// Helper function to calculate age (reuse from Overview)
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

const fetchNodeDetails = async () => {
  if (!nodeName.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/nodes/${encodeURIComponent(nodeName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Node '${nodeName.value}' not found.`;
           nodeDetails.value = null;
       } else {
           const errorData = await response.text();
           console.error("Node detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        nodeDetails.value = data; // Assuming backend sends the node object directly
    }
  } catch (err) {
    console.error("Error fetching node details:", err);
    error.value = err.message;
    nodeDetails.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchNodeDetails();
});
</script>

<style scoped>
pre {
    background-color: #f5f5f5;
    padding: 1em;
    overflow-x: auto;
    white-space: pre-wrap; 
    word-wrap: break-word;
}
</style> 