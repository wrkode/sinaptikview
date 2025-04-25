<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading PersistentVolume details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading PersistentVolume details: {{ error }}</Message>
    </div>
    <div v-else-if="pv">
      <h2 class="text-2xl font-bold mb-1">PersistentVolume: {{ pvName }}</h2>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ pv.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(pv.metadata?.creationTimestamp) }} ago ({{ new Date(pv.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="pv.metadata?.labels && Object.keys(pv.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in pv.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in pv.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Status">
                <p><strong>Phase:</strong> <Tag :severity="getStatusSeverity(pv.status?.phase)">{{ pv.status?.phase }}</Tag></p>
                <p><strong>Capacity:</strong> {{ pv.spec?.capacity?.storage || 'N/A' }}</p>
                <p><strong>Access Modes:</strong> {{ pv.spec?.accessModes?.join(', ') || 'N/A' }}</p>
                <p><strong>Reclaim Policy:</strong> {{ pv.spec?.persistentVolumeReclaimPolicy || 'N/A' }}</p>
                <p><strong>Storage Class:</strong> {{ pv.spec?.storageClassName || 'N/A' }}</p>
                <p><strong>Volume Mode:</strong> {{ pv.spec?.volumeMode || 'Filesystem' }}</p>
                <div v-if="pv.spec.claimRef" class="mt-3">
                  <strong>Claim:</strong>
                  <p>{{ pv.spec.claimRef.namespace }}/{{ pv.spec.claimRef.name }}</p>
                </div>
              </Panel>
            </div>
          </div>

          <div class="mt-4">
            <Panel header="Source Details">
              <div v-if="getVolumeSource">
                <div v-for="(value, key) in getVolumeSource" :key="key">
                  <strong>{{ formatSourceName(key) }}:</strong>
                  <pre class="source-details mt-1">{{ JSON.stringify(value, null, 2) }}</pre>
                </div>
              </div>
              <div v-else class="text-color-secondary">No source details available</div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this PersistentVolume.</template>
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
          <pre class="mt-4">{{ pvYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      PersistentVolume not found.
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
const pvName = computed(() => route.params.name);
const pv = ref(null);
const events = ref([]);
const pvYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => pv.value?.metadata?.annotations ? Object.keys(pv.value.metadata.annotations).length : 0);

// Compute the volume source details
const getVolumeSource = computed(() => {
  if (!pv.value?.spec) return null;
  
  // Extract the volume source by filtering out known non-source fields
  const skipFields = ['accessModes', 'capacity', 'claimRef', 'persistentVolumeReclaimPolicy', 'storageClassName', 'volumeMode'];
  const source = {};
  
  for (const key in pv.value.spec) {
    if (!skipFields.includes(key)) {
      source[key] = pv.value.spec[key];
    }
  }
  
  return Object.keys(source).length ? source : null;
});

// Format the volume source name for display
const formatSourceName = (name) => {
  // Convert camelCase to Title Case with spaces
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
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

// Helper to get status severity for Tag component
const getStatusSeverity = (status) => {
  switch (status?.toLowerCase()) {
    case 'bound':
      return 'success';
    case 'available':
      return 'info';
    case 'released':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
};

// Fetch PV Details
const fetchPVDetails = async () => {
  if (!pvName.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/persistentvolumes/${encodeURIComponent(pvName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `PersistentVolume '${pvName.value}' not found.`;
           pv.value = null;
       } else {
           const errorData = await response.text();
           console.error("PV detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        pv.value = data; 
        pvYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents(); // Fetch events after getting PV details
    }
  } catch (err) {
    console.error("Error fetching PV details:", err);
    error.value = err.message;
    pv.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch PV Events
const fetchEvents = async () => {
    if (!pv.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const pvUID = pv.value.metadata.uid;

    // Construct field selector: involvedObject.uid=<pvUID>
    const fieldSelector = `involvedObject.uid=${pvUID}`;

    try {
        // For cluster-wide resources like PVs, we need to fetch events from all namespaces
        // Currently using default namespace for event querying - might need adjustment
        const response = await fetch(`/api/v1/namespaces/default/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        events.value = data.items || [];
        // Sort events by last timestamp descending
        events.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching PV events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchPVDetails();
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

.source-details {
    font-size: 0.85rem;
    padding: 0.5em;
    margin-bottom: 1em;
}
</style> 