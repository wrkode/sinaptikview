<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading PVC details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading PVC details: {{ error }}</Message>
    </div>
    <div v-else-if="pvc">
      <h2 class="text-2xl font-bold mb-1">PVC: {{ pvcName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ pvc.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(pvc.metadata?.creationTimestamp) }} ago ({{ new Date(pvc.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="pvc.metadata?.labels && Object.keys(pvc.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in pvc.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in pvc.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Status">
                <p><strong>Phase:</strong> <Tag :severity="getStatusSeverity(pvc.status?.phase)">{{ pvc.status?.phase }}</Tag></p>
                <p><strong>Access Modes:</strong> {{ pvc.spec?.accessModes?.join(', ') || 'N/A' }}</p>
                <p><strong>Storage Class:</strong> {{ pvc.spec?.storageClassName || 'N/A' }}</p>
                <p><strong>Volume Name:</strong> {{ pvc.spec?.volumeName || 'N/A' }}</p>
                <p><strong>Capacity:</strong> {{ pvc.status?.capacity?.storage || 'N/A' }}</p>
                <p v-if="pvc.spec.resources.requests?.storage"><strong>Requested:</strong> {{ pvc.spec.resources.requests.storage }}</p>
                <p><strong>Volume Mode:</strong> {{ pvc.spec?.volumeMode || 'Filesystem' }}</p>
              </Panel>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this PVC.</template>
            <Column field="lastTimestamp" header="Time">
              <template #body="slotProps">
                {{ getAge(slotProps.data.lastTimestamp) }} ago
              </template>
            </Column>
            <Column field="type" header="Type"></Column>
            <Column field="reason" header="Reason"></Column>
            <Column field="message" header="Message"></Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="YAML">
          <pre class="mt-4">{{ pvcYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      PVC not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml'; // Import js-yaml
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const pvcName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const pvc = ref(null);
const events = ref([]);
const pvcYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => pvc.value?.metadata?.annotations ? Object.keys(pvc.value.metadata.annotations).length : 0);

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

// Helper to get status severity for Tag component
const getStatusSeverity = (status) => {
  switch (status?.toLowerCase()) {
    case 'bound':
      return 'success';
    case 'pending':
      return 'warning';
    case 'lost':
      return 'danger';
    default:
      return 'info';
  }
};

// Fetch PVC Details
const fetchPVCDetails = async () => {
  if (!pvcName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/persistentvolumeclaims/${encodeURIComponent(pvcName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `PVC '${pvcName.value}' in namespace '${namespace.value}' not found.`;
           pvc.value = null;
       } else {
           const errorData = await response.text();
           console.error("PVC detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        pvc.value = data; 
        pvcYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents(); // Fetch events after getting PVC details
    }
  } catch (err) {
    console.error("Error fetching PVC details:", err);
    error.value = err.message;
    pvc.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch PVC Events
const fetchEvents = async () => {
    if (!pvc.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const pvcUID = pvc.value.metadata.uid;
    const eventNamespace = pvc.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<pvcUID>,involvedObject.namespace=<pvcNamespace>
    const fieldSelector = `involvedObject.uid=${pvcUID},involvedObject.namespace=${eventNamespace}`;

    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(eventNamespace)}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        events.value = data.items || [];
        // Sort events by last timestamp descending
        events.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching PVC events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchPVCDetails();
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