<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading ConfigMap details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading ConfigMap details: {{ error }}</Message>
    </div>
    <div v-else-if="configMap">
      <h2 class="text-2xl font-bold mb-1">ConfigMap: {{ configMapName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ configMap.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(configMap.metadata?.creationTimestamp) }} ago ({{ new Date(configMap.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="configMap.metadata?.labels && Object.keys(configMap.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in configMap.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in configMap.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Summary">
                <p><strong>Number of Data Items:</strong> {{ dataItemsCount }}</p>
                <p><strong>Number of Binary Data Items:</strong> {{ binaryDataItemsCount }}</p>
                <p><strong>Total Size:</strong> {{ getTotalDataSize() }} bytes</p>
              </Panel>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Data">
          <div v-if="dataItemsCount > 0" class="mt-4">
            <TabView>
              <TabPanel v-for="(value, key) in configMap.data" :key="key" :header="key">
                <pre class="data-content">{{ value }}</pre>
              </TabPanel>
            </TabView>
          </div>
          <div v-else-if="binaryDataItemsCount > 0" class="mt-4">
            <p class="font-semibold text-lg">Binary Data (not shown):</p>
            <ul class="mt-2 list-disc pl-6">
              <li v-for="(value, key) in configMap.binaryData" :key="key" class="mb-1">
                {{ key }} ({{ Buffer.from(value, 'base64').length }} bytes)
              </li>
            </ul>
          </div>
          <div v-else class="mt-4">
            <Message severity="info">This ConfigMap doesn't contain any data.</Message>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this ConfigMap.</template>
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
          <pre class="mt-4">{{ configMapYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      ConfigMap not found.
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
const configMapName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const configMap = ref(null);
const events = ref([]);
const configMapYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => configMap.value?.metadata?.annotations ? Object.keys(configMap.value.metadata.annotations).length : 0);
const dataItemsCount = computed(() => configMap.value?.data ? Object.keys(configMap.value.data).length : 0);
const binaryDataItemsCount = computed(() => configMap.value?.binaryData ? Object.keys(configMap.value.binaryData).length : 0);

// Calculate the total size of all data values
const getTotalDataSize = () => {
  let size = 0;
  
  // Add regular data size
  if (configMap.value?.data) {
    Object.values(configMap.value.data).forEach(value => {
      size += value.length; // String length is a good approximation for text data
    });
  }
  
  // Add binary data size (base64 encoded)
  if (configMap.value?.binaryData) {
    Object.values(configMap.value.binaryData).forEach(value => {
      // For base64 encoded data, we need to calculate the actual binary size
      // This is done by decoding base64 to get the actual binary length
      try {
        const binaryLength = window.atob(value).length;
        size += binaryLength;
      } catch (e) {
        // If there's an error decoding, just use the encoded length
        size += value.length;
      }
    });
  }
  
  return size;
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

// Fetch ConfigMap Details
const fetchConfigMapDetails = async () => {
  if (!configMapName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/configmaps/${encodeURIComponent(configMapName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `ConfigMap '${configMapName.value}' in namespace '${namespace.value}' not found.`;
           configMap.value = null;
       } else {
           const errorData = await response.text();
           console.error("ConfigMap detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        configMap.value = data; 
        configMapYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents(); // Fetch events after getting ConfigMap details
    }
  } catch (err) {
    console.error("Error fetching ConfigMap details:", err);
    error.value = err.message;
    configMap.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch ConfigMap Events
const fetchEvents = async () => {
    if (!configMap.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const configMapUID = configMap.value.metadata.uid;
    const eventNamespace = configMap.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<configMapUID>,involvedObject.namespace=<configMapNamespace>
    const fieldSelector = `involvedObject.uid=${configMapUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching ConfigMap events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchConfigMapDetails();
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

.data-content {
    font-family: 'Courier New', Courier, monospace;
    line-height: 1.5;
    padding: 1em;
    background-color: #f8f8f8;
    border: 1px solid #eaeaea;
    border-radius: 4px;
}
</style> 