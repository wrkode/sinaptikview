<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading pod details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading pod details: {{ error }}</Message>
    </div>
    <div v-else-if="podDetails">
      <h2 class="text-2xl font-bold mb-1">Pod: {{ podName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ podDetails.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(podDetails.metadata?.creationTimestamp) }} ago ({{ new Date(podDetails.metadata?.creationTimestamp).toLocaleString() }})</p>
                <p v-if="podDetails.metadata?.ownerReferences"><strong>Owner:</strong> {{ podDetails.metadata.ownerReferences[0].kind }}/{{ podDetails.metadata.ownerReferences[0].name }}</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="podDetails.metadata?.labels && Object.keys(podDetails.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in podDetails.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in podDetails.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                    <!-- <p>({{ annotationCount }} total)</p> -->
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Status">
                <p><strong>Phase:</strong> <Tag :severity="getStatusSeverity(podDetails.status?.phase)">{{ podDetails.status?.phase }}</Tag></p>
                <p><strong>Pod IP:</strong> {{ podDetails.status?.podIP || 'N/A' }}</p>
                <p><strong>Node:</strong> {{ podDetails.spec?.nodeName || 'N/A' }}</p>
                <p><strong>Service Account:</strong> {{ podDetails.spec?.serviceAccountName || 'N/A' }}</p>
                <p><strong>QoS Class:</strong> {{ podDetails.status?.qosClass || 'N/A' }}</p>
              </Panel>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Conditions">
          <DataTable :value="podDetails.status?.conditions" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No conditions reported.</template>
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
        </TabPanel>
        
        <TabPanel header="Containers">
          <DataTable :value="podDetails.spec?.containers" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No containers defined.</template>
            <Column field="name" header="Name"></Column>
            <Column field="image" header="Image"></Column>
            <Column header="Ports">
              <template #body="slotProps">
                <div v-if="slotProps.data.ports && slotProps.data.ports.length > 0">
                  <Tag v-for="port in slotProps.data.ports" :key="port.containerPort" class="mr-1">{{ port.containerPort }}/{{ port.protocol }}</Tag>
                </div>
                <div v-else>None</div>
              </template>
            </Column>
            <Column header="Ready">
              <template #body="slotProps">
                <Tag :severity="getContainerStatus(slotProps.data.name)?.ready ? 'success' : 'danger'">{{ getContainerStatus(slotProps.data.name)?.ready ? 'Yes' : 'No' }}</Tag>
              </template>
            </Column>
            <Column header="Restarts">
              <template #body="slotProps">
                {{ getContainerStatus(slotProps.data.name)?.restartCount || 0 }}
              </template>
            </Column>
            <Column header="Status">
              <template #body="slotProps">
                {{ getContainerState(slotProps.data.name) }}
              </template>
            </Column>
            <Column header="Actions">
              <template #body="slotProps">
                <Button icon="pi pi-align-justify" class="p-button-sm p-button-secondary mr-2" label="Logs" @click="showLogs(slotProps.data.name)" />
                <Button icon="pi pi-terminal" class="p-button-sm p-button-secondary" label="Exec" @click="execInto(slotProps.data.name)" />
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="Volumes">
          <DataTable :value="podDetails.spec?.volumes" tableStyle="min-width: 30rem" class="mt-4">
            <template #empty>No volumes defined.</template>
            <Column field="name" header="Name"></Column>
            <Column header="Type">
              <template #body="slotProps">
                {{ Object.keys(slotProps.data).filter(k => k !== 'name')[0] }}
              </template>
            </Column>
            <Column header="Details">
              <template #body="slotProps">
                <pre>{{ getVolumeDetails(slotProps.data) }}</pre>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="podEvents" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this pod.</template>
            <Column field="lastTimestamp" header="Time">
              <template #body="slotProps">
                {{ getAge(slotProps.data.lastTimestamp) }} ago
              </template>
            </Column>
            <Column field="type" header="Type"></Column>
            <Column field="reason" header="Reason"></Column>
            <Column field="regarding.fieldPath" header="Object"></Column> <!-- Simplified -->
            <Column field="message" header="Message"></Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="YAML">
          <pre class="mt-4">{{ podYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Pod not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml'; // Import js-yaml
import Button from 'primevue/button';
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
const podName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const podDetails = ref(null);
const podEvents = ref([]);
const podYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => podDetails.value?.metadata?.annotations ? Object.keys(podDetails.value.metadata.annotations).length : 0);

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
    case 'running':
    case 'succeeded':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
};

// Helper to find container status by name
const getContainerStatus = (containerName) => {
    return podDetails.value?.status?.containerStatuses?.find(cs => cs.name === containerName);
}

// Helper to describe container state
const getContainerState = (containerName) => {
    const status = getContainerStatus(containerName);
    if (!status?.state) return 'Unknown';
    const stateKey = Object.keys(status.state)[0]; // running, waiting, terminated
    const stateDetails = status.state[stateKey];
    let description = stateKey.charAt(0).toUpperCase() + stateKey.slice(1);
    if (stateDetails?.reason) {
        description += `: ${stateDetails.reason}`;
    }
     if (stateDetails?.exitCode !== undefined) {
        description += ` (Exit Code: ${stateDetails.exitCode})`;
    }
    return description;
}

// Helper for volume details
const getVolumeDetails = (volume) => {
    const details = { ...volume };
    delete details.name;
    return details;
}

// Fetch Pod Details
const fetchPodDetails = async () => {
  if (!podName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/pods/${encodeURIComponent(podName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Pod '${podName.value}' in namespace '${namespace.value}' not found.`;
           podDetails.value = null;
       } else {
           const errorData = await response.text();
           console.error("Pod detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        podDetails.value = data; 
        podYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchPodEvents(); // Fetch events after getting pod details (uses UID)
    }
  } catch (err) {
    console.error("Error fetching pod details:", err);
    error.value = err.message;
    podDetails.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Pod Events
const fetchPodEvents = async () => {
    if (!podDetails.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    podEvents.value = [];
    const podUID = podDetails.value.metadata.uid;
    const eventNamespace = podDetails.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<podUID>,involvedObject.namespace=<podNamespace>
    const fieldSelector = `involvedObject.uid=${podUID},involvedObject.namespace=${eventNamespace}`;

    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(eventNamespace)}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        podEvents.value = data.items || [];
        // Sort events by last timestamp descending
        podEvents.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching pod events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

// Placeholder functions for Logs/Exec
const showLogs = (containerName) => {
    alert(`TODO: Show logs for container: ${containerName}`);
}
const execInto = (containerName) => {
     alert(`TODO: Exec into container: ${containerName}`);
}

onMounted(() => {
  fetchPodDetails();
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