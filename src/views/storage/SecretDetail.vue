<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading Secret details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading Secret details: {{ error }}</Message>
    </div>
    <div v-else-if="secret">
      <h2 class="text-2xl font-bold mb-1">Secret: {{ secretName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ secret.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(secret.metadata?.creationTimestamp) }} ago ({{ new Date(secret.metadata?.creationTimestamp).toLocaleString() }})</p>
                <p><strong>Type:</strong> <Tag :severity="getSecretTypeSeverity(secret.type)">{{ secret.type }}</Tag></p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="secret.metadata?.labels && Object.keys(secret.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in secret.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in secret.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Summary">
                <p><strong>Number of Data Items:</strong> {{ dataItemsCount }}</p>
                <p><strong>Total Size:</strong> {{ getTotalDataSize() }} bytes</p>
                <div class="mt-4">
                  <Message severity="warning">
                    Secret values are sensitive data. When viewing Secret data, be cautious about who might be able to see your screen.
                  </Message>
                </div>
              </Panel>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Data">
          <div class="flex justify-between mb-4">
            <h3 class="text-lg font-semibold">Secret Data</h3>
            <div>
              <InputSwitch v-model="showSecretData" />
              <span class="ml-2">{{ showSecretData ? 'Hide' : 'Show' }} Secret Values</span>
            </div>
          </div>
          <div v-if="dataItemsCount > 0" class="mt-2">
            <DataTable :value="secretDataEntries" tableStyle="min-width: 50rem">
              <Column field="key" header="Key"></Column>
              <Column header="Value">
                <template #body="slotProps">
                  <div v-if="showSecretData">
                    <pre class="data-value">{{ decodeBase64(slotProps.data.value) }}</pre>
                  </div>
                  <div v-else>
                    <div class="data-masked">●●●●●●●●●●●●</div>
                  </div>
                </template>
              </Column>
              <Column header="Size">
                <template #body="slotProps">
                  {{ getValueSize(slotProps.data.value) }} bytes
                </template>
              </Column>
            </DataTable>
          </div>
          <div v-else class="mt-4">
            <Message severity="info">This Secret doesn't contain any data.</Message>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this Secret.</template>
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
          <div class="flex justify-between mb-4">
            <h3 class="text-lg font-semibold">Secret YAML</h3>
            <div>
              <InputSwitch v-model="showSecretYaml" />
              <span class="ml-2">{{ showSecretYaml ? 'Show' : 'Hide' }} Secret Data in YAML</span>
            </div>
          </div>
          <pre class="mt-2">{{ showSecretYaml ? secretYaml : secretYamlRedacted }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Secret not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml'; // Import js-yaml
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputSwitch from 'primevue/inputswitch';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const secretName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const secret = ref(null);
const events = ref([]);
const secretYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);
const showSecretData = ref(false);
const showSecretYaml = ref(false);

const annotationCount = computed(() => secret.value?.metadata?.annotations ? Object.keys(secret.value.metadata.annotations).length : 0);
const dataItemsCount = computed(() => secret.value?.data ? Object.keys(secret.value.data).length : 0);

// Convert secret data object to array for DataTable
const secretDataEntries = computed(() => {
  if (!secret.value?.data) return [];
  return Object.entries(secret.value.data).map(([key, value]) => ({ key, value }));
});

// Create a redacted version of the YAML
const secretYamlRedacted = computed(() => {
  if (!secret.value) return '';
  
  // Clone the secret to avoid modifying the original
  const redactedSecret = JSON.parse(JSON.stringify(secret.value));
  
  // Replace data values with redacted message
  if (redactedSecret.data) {
    for (const key in redactedSecret.data) {
      redactedSecret.data[key] = "[REDACTED]";
    }
  }
  
  return yaml.dump(redactedSecret);
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

// Calculate the total size of all data values
const getTotalDataSize = () => {
  let size = 0;
  
  if (secret.value?.data) {
    Object.values(secret.value.data).forEach(value => {
      size += getValueSize(value);
    });
  }
  
  return size;
};

// Calculate the size of a base64 value when decoded
const getValueSize = (base64Value) => {
  try {
    return window.atob(base64Value).length;
  } catch (e) {
    return base64Value.length; // Fallback to encoded length
  }
};

// Decode base64 to string
const decodeBase64 = (value) => {
  try {
    return window.atob(value);
  } catch (e) {
    return `[Error decoding: ${e.message}]`;
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

// Fetch Secret Details
const fetchSecretDetails = async () => {
  if (!secretName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/secrets/${encodeURIComponent(secretName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Secret '${secretName.value}' in namespace '${namespace.value}' not found.`;
           secret.value = null;
       } else {
           const errorData = await response.text();
           console.error("Secret detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        secret.value = data; 
        secretYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents(); // Fetch events after getting Secret details
    }
  } catch (err) {
    console.error("Error fetching Secret details:", err);
    error.value = err.message;
    secret.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Secret Events
const fetchEvents = async () => {
    if (!secret.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const secretUID = secret.value.metadata.uid;
    const eventNamespace = secret.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<secretUID>,involvedObject.namespace=<secretNamespace>
    const fieldSelector = `involvedObject.uid=${secretUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching Secret events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchSecretDetails();
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

.data-value {
    font-family: 'Courier New', Courier, monospace;
    line-height: 1.5;
    padding: 0.5em;
    margin: 0;
    background-color: #f8f8f8;
    border: 1px solid #eaeaea;
    border-radius: 4px;
}

.data-masked {
    font-family: monospace;
    padding: 0.5em;
    color: #888;
    letter-spacing: 0.1em;
}
</style> 