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
                <Button
                  icon="pi pi-align-justify"
                  class="p-button-sm p-button-secondary mr-2"
                  label="Logs"
                  @click="showLogs(slotProps.data.name)"
                  v-tooltip.bottom="'View Container Logs'"
                />
                <Button
                  icon="pi pi-terminal"
                  class="p-button-sm p-button-secondary"
                  label="Exec"
                  @click="openTerminalDialog(namespace, podName, slotProps.data.name)"
                  v-tooltip.bottom="'Exec into Container'"
                />
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

    <!-- ADDED: Log Dialog -->
    <Dialog
      v-model:visible="logDialogVisible"
      :header="`Logs: ${logTarget.podName} / ${logTarget.containerName}`"
      :modal="true"
      :draggable="false"
      position="top"
      @hide="handleLogDialogClose"
      style="width: 90vw; height: 80vh;"
      contentStyle="height: calc(100% - 5rem); display: flex; flex-direction: column;"
      :dismissableMask="true"
      :closable="true"
    >
      <div class="log-controls p-2 surface-section border-bottom-1 surface-border flex align-items-center gap-3">
         <label for="tailLines" class="font-semibold">Lines:</label>
         <InputNumber v-model="logOptions.tailLines" inputId="tailLines" :min="10" :max="5000" :step="100" showButtons style="width: 8rem;" />

         <div class="flex align-items-center">
             <Checkbox v-model="logOptions.previous" inputId="previousLogs" :binary="true" />
             <label for="previousLogs" class="ml-2"> Show previous container logs</label>
         </div>

         <Button icon="pi pi-refresh" label="Refresh" @click="fetchLogs" :loading="loadingLogs" class="p-button-sm" />
      </div>

      <div class="log-content flex-grow-1 overflow-auto p-2" style="background-color: var(--surface-ground); font-family: monospace;">
        <div v-if="loadingLogs" class="text-center p-4">Loading logs...</div>
        <div v-else-if="logError" class="p-4">
          <Message severity="error" :closable="false">Error loading logs: {{ logError }}</Message>
        </div>
        <pre v-else-if="logContent">{{ logContent }}</pre>
        <div v-else class="text-center p-4 text-color-secondary">No log content available.</div>
      </div>
    </Dialog>

    <!-- ADDED: Terminal Dialog -->
    <Dialog 
      v-model:visible="terminalDialogVisible" 
      :header="`Terminal: ${terminalTarget.podName} / ${terminalTarget.containerName}`" 
      :modal="true" 
      :draggable="false"
      position="top"
      @hide="handleTerminalDialogClose"
      style="width: 80vw; height: 70vh;"
      contentStyle="padding: 0; height: calc(100% - 4rem); display: flex; flex-direction: column;"
      :dismissableMask="true" 
      :closable="true"
      >
        <WebTerminal 
          v-if="terminalDialogVisible" 
          :namespace="terminalTarget.namespace" 
          :podName="terminalTarget.podName" 
          :containerName="terminalTarget.containerName"
          class="terminal-component"
        />
    </Dialog>

  </div>
</template>

<script setup>
import WebTerminal from '@/components/WebTerminal.vue'; // Import the WebTerminal component
import axios from 'axios';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox'; // Added
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog'; // Added Dialog import
import InputNumber from 'primevue/inputnumber'; // Added
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import Tooltip from 'primevue/tooltip'; // Added Tooltip import
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

// Directives
const vTooltip = Tooltip; 

const route = useRoute();
const podName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const podDetails = shallowRef(null);
const podEvents = ref([]);
const podYaml = ref('');
const loading = ref(true); // Changed initial state to true
const error = ref(null);
const loadingEvents = ref(false);

// --- State for Log Dialog ---
const logDialogVisible = ref(false);
const logTarget = ref({ namespace: '', podName: '', containerName: '' });
const logContent = ref('');
const loadingLogs = ref(false);
const logError = ref(null);
const logOptions = ref({
  tailLines: 500,
  previous: false,
});
// --- End Log Dialog State ---

// Add state for Terminal Dialog
const terminalDialogVisible = ref(false);
const terminalTarget = ref({ namespace: '', podName: '', containerName: '' });

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
    return details; // Return the object itself for <pre> tag
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
        // Delay YAML generation until tab is clicked
        // podYaml.value = yaml.dump(data); 
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
        // Using axios now for consistency
        const response = await axios.get(`/api/v1/namespaces/${encodeURIComponent(eventNamespace)}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        podEvents.value = response.data.items || [];
        // Sort events by last timestamp descending
        podEvents.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching pod events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

// --- Log Viewing Functions ---
const showLogs = (containerName) => {
  console.log(`Opening logs for: ${namespace.value}/${podName.value}/${containerName}`);
  logTarget.value = {
    namespace: namespace.value,
    podName: podName.value,
    containerName: containerName
  };
  logContent.value = ''; // Clear previous logs
  logError.value = null; // Clear previous error
  logDialogVisible.value = true;
  fetchLogs(); // Fetch initial logs
};

const fetchLogs = async () => {
  if (!logTarget.value.containerName) return;
  loadingLogs.value = true;
  logError.value = null;
  logContent.value = ''; // Clear content before fetching

  const params = new URLSearchParams({
      container: logTarget.value.containerName,
      tailLines: logOptions.value.tailLines || 500,
      previous: logOptions.value.previous || false,
  });

  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(logTarget.value.namespace)}/pods/${encodeURIComponent(logTarget.value.podName)}/logs?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ details: response.statusText })); // Try to parse JSON error, fallback to status text
      throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
    }

    // Read logs as text
    logContent.value = await response.text();
    if (!logContent.value) {
         logContent.value = "[No log output received]";
    }

  } catch (err) {
    console.error("Error fetching pod logs:", err);
    logError.value = err.message;
  } finally {
    loadingLogs.value = false;
  }
};

const handleLogDialogClose = () => {
  console.log("Log dialog closed");
  // Reset state if needed, but might be useful to keep options
  // logTarget.value = { namespace: '', podName: '', containerName: '' };
};
// --- End Log Viewing Functions ---

// *** Updated function to open the terminal dialog ***
const openTerminalDialog = (targetNamespace, targetPodName, targetContainerName) => {
  console.log(`Opening terminal for: ${targetNamespace}/${targetPodName}/${targetContainerName}`);
  terminalTarget.value = { 
    namespace: targetNamespace,
    podName: targetPodName,
    containerName: targetContainerName
  };
  terminalDialogVisible.value = true;
};

// Method to handle dialog close
const handleTerminalDialogClose = () => {
  console.log("Terminal dialog closed");
  // Optional: Reset target when dialog closes to ensure clean state for next open
  terminalTarget.value = { namespace: '', podName: '', containerName: '' };
};

// Handle tab change to load data lazily
const onTabChange = (event) => {
  const index = event.index;
  // activeTabIndex.value = index; // Need to define activeTabIndex if used
  console.log(`Tab changed to index: ${index}`);
  
  // Assuming 0=Overview, 1=Conditions, 2=Containers, 3=Volumes, 4=Events, 5=YAML
  // Also assuming tabsLoaded ref exists
  // if (index === 4 && !tabsLoaded.value[4]) { // Events Tab
  //   fetchPodEvents(); // Events might need a refresh or initial load here
  //   tabsLoaded.value[4] = true;
  // }
  // else if (index === 5 && !tabsLoaded.value[5]) { // YAML Tab
  //   if (podDetails.value && !podYaml.value) { // Generate YAML only if not already done
  //     try {
  //       podYaml.value = yaml.dump(podDetails.value);
  //     } catch(e) {
  //       console.error("Error generating YAML:", e);
  //       podYaml.value = "Error generating YAML.";
  //     }
  //   }
  //   tabsLoaded.value[5] = true; 
  // }
};

onMounted(() => {
  fetchPodDetails();
});

// Cleanup on component destroy (e.g., clear intervals if any were used)
onBeforeUnmount(() => {
  // Add any cleanup logic if necessary
});

</script>

<style scoped>
.cluster-detail-view {
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.content {
  flex: 1; 
  overflow: auto; 
  min-height: 0; 
}

.loading-container,
.error-container,
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 1rem;
  flex: 1; 
}

.error-container .p-button-sm {
  margin-top: 0.5rem;
}

.overview-section, .machines-section, .pods-section, .yaml-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metadata-panel, .conditions-panel {
  background-color: var(--surface-card);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.metadata-panel h2, .conditions-panel h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 0.5rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
  gap: 1rem 1.5rem; 
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.metadata-value {
  font-size: 0.95rem;
}

.provider-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-icon {
  font-size: 1.2rem;
}

pre, .yaml-content {
  background-color: var(--surface-ground); 
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  padding: 1em;
  overflow-x: auto;
  white-space: pre-wrap; 
  word-wrap: break-word;
  font-family: var(--font-family-monospace);
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-color);
  max-height: 600px; /* Limit height and allow scroll */
}

.loading-machines, .no-machines,
.loading-pods, .no-pods {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-color-secondary);
  min-height: 200px; 
}

.loading-machines i, .no-machines i,
.loading-pods i, .no-pods i {
  font-size: 2rem;
}

.container-item {
  display: flex;
  align-items: center;
  justify-content: space-between; 
  padding: 2px 0; 
}

.container-item span {
  margin-right: 0.5rem; 
  word-break: break-all; 
}

.terminal-component {
  flex-grow: 1; 
  min-height: 0; 
}

/* Adjust TabView panel padding */
:deep(.p-tabview .p-tabview-panels) {
  padding: 1.5rem 0 0 0; 
}

/* Adjust DataTable header style */
:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: var(--surface-b); /* Lighter background for header */
  color: var(--text-color);
  font-weight: 600;
}

/* Ensure terminal dialog content area stretches */
:deep(.p-dialog .p-dialog-content) {
    padding: 0; /* Remove default padding */
    height: 100%; /* Take full height passed from style */
    display: flex;
    flex-direction: column;
}

.log-content pre {
  white-space: pre-wrap; /* Allow logs to wrap */
  word-wrap: break-word;
  margin: 0; /* Remove default pre margin */
  font-size: 0.875rem;
  line-height: 1.5;
}

.log-controls {
  flex-shrink: 0; /* Prevent controls from shrinking */
}

.log-content {
  flex-grow: 1; /* Allow content area to fill space */
  min-height: 0; /* Needed for flex-grow in column layout */
}

</style> 