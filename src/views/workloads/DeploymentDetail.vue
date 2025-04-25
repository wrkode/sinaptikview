<template>
    <div class="card">
        <div v-if="loading" class="text-center p-4">Loading deployment details...</div>
        <div v-else-if="error" class="p-4">
            <Message severity="error">Error loading deployment details: {{ error }}</Message>
        </div>
        <div v-else-if="deploymentDetails">
            <h2 class="text-2xl font-bold mb-1">Deployment: {{ deploymentName }}</h2>
            <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

            <TabView>
                <TabPanel header="Overview">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <Panel header="Metadata">
                                <p><strong>UID:</strong> {{ deploymentDetails.metadata?.uid }}</p>
                                <p><strong>Created:</strong> {{ getAge(deploymentDetails.metadata?.creationTimestamp) }} ago ({{ new Date(deploymentDetails.metadata?.creationTimestamp).toLocaleString() }})</p>
                                
                                <div class="mt-3">
                                    <strong>Labels:</strong>
                                    <div v-if="deploymentDetails.metadata?.labels && Object.keys(deploymentDetails.metadata.labels).length" class="mt-1">
                                        <Tag v-for="(value, key) in deploymentDetails.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                                    </div>
                                    <div v-else class="text-color-secondary">None</div>
                                </div>
                                <div class="mt-3">
                                    <strong>Annotations:</strong>
                                     <div v-if="annotationCount > 0" class="mt-1">
                                         <Tag v-for="(value, key) in deploymentDetails.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                                         <!-- <p>({{ annotationCount }} total)</p> -->
                                    </div>
                                     <div v-else class="text-color-secondary">None</div>
                                </div>
                            </Panel>
                        </div>
                        <div>
                            <Panel header="Status">
                                <p><strong>Strategy:</strong> {{ deploymentDetails.spec?.strategy?.type }}</p>
                                <p><strong>Replicas:</strong> {{ deploymentDetails.status?.readyReplicas || 0 }} ready / {{ deploymentDetails.spec?.replicas }} desired</p>
                                <p><strong>Updated:</strong> {{ deploymentDetails.status?.updatedReplicas || 0 }}</p>
                                <p><strong>Available:</strong> {{ deploymentDetails.status?.availableReplicas || 0 }}</p>
                                <p><strong>Unavailable:</strong> {{ deploymentDetails.status?.unavailableReplicas || 0 }}</p>
                            </Panel>
                        </div>
                    </div>
                     <Fieldset legend="Conditions" class="mt-4" :toggleable="true">
                         <DataTable :value="deploymentDetails.status?.conditions" tableStyle="min-width: 50rem">
                            <template #empty>No conditions reported.</template>
                            <Column field="type" header="Type"></Column>
                            <Column field="status" header="Status"></Column>
                            <Column field="lastTransitionTime" header="Last Transition">
                                <template #body="slotProps">
                                    {{ getAge(slotProps.data.lastTransitionTime) }} ago
                                </template>
                            </Column>
                            <Column field="reason" header="Reason"></Column>
                            <Column field="message" header="Message" style="white-space: pre-wrap;"></Column>
                        </DataTable>
                     </Fieldset>
                </TabPanel>

                 <TabPanel header="Pod Template">
                    <Panel header="Labels" :toggleable="true" class="mt-4">
                         <div v-if="deploymentDetails.spec?.template?.metadata?.labels && Object.keys(deploymentDetails.spec.template.metadata.labels).length" class="mt-1">
                            <Tag v-for="(value, key) in deploymentDetails.spec.template.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                        </div>
                        <div v-else class="text-color-secondary">None</div>
                    </Panel>
                    <Fieldset legend="Containers" class="mt-4" :toggleable="true" :collapsed="true">
                        <DataTable :value="deploymentDetails.spec?.template?.spec?.containers" tableStyle="min-width: 50rem">
                            <template #empty>No containers defined in template.</template>
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
                             <Column header="Env Vars">
                                 <template #body="slotProps">
                                     <div v-if="slotProps.data.env && slotProps.data.env.length > 0">
                                        {{ slotProps.data.env.length }} vars
                                         <!-- Could show in a dialog -->
                                     </div>
                                     <div v-else>None</div>
                                 </template>
                             </Column>
                             <Column header="Mounts">
                                 <template #body="slotProps">
                                     <div v-if="slotProps.data.volumeMounts && slotProps.data.volumeMounts.length > 0">
                                        {{ slotProps.data.volumeMounts.length }} mounts
                                         <!-- Could show in a dialog -->
                                     </div>
                                     <div v-else>None</div>
                                 </template>
                             </Column>
                        </DataTable>
                   </Fieldset>
                    <Fieldset legend="Volumes" class="mt-4" :toggleable="true" :collapsed="true">
                        <DataTable :value="deploymentDetails.spec?.template?.spec?.volumes" tableStyle="min-width: 30rem">
                            <template #empty>No volumes defined in template.</template>
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
                   </Fieldset>
                 </TabPanel>

                <TabPanel header="Events">
                     <DataTable :value="deploymentEvents" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
                        <template #empty>No events found for this deployment.</template>
                        <Column field="lastTimestamp" header="Time">
                             <template #body="slotProps">
                                {{ getAge(slotProps.data.lastTimestamp) }} ago
                             </template>
                         </Column>
                        <Column field="type" header="Type"></Column>
                        <Column field="reason" header="Reason"></Column>
                         <Column field="regarding.fieldPath" header="Object"></Column> 
                        <Column field="message" header="Message"></Column>
                    </DataTable>
                 </TabPanel>

                <TabPanel header="YAML">
                    <pre class="mt-4">{{ deploymentYaml }}</pre>
                 </TabPanel>

            </TabView>
        </div>
        <div v-else class="p-4">
            Deployment not found.
        </div>
    </div>
</template>

<script setup>
import yaml from 'js-yaml';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Fieldset from 'primevue/fieldset';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const deploymentName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);

const deploymentDetails = ref(null);
const deploymentEvents = ref([]);
const deploymentYaml = ref('');

const loading = ref(false);
const loadingEvents = ref(false);
const error = ref(null);

const annotationCount = computed(() => deploymentDetails.value?.metadata?.annotations ? Object.keys(deploymentDetails.value.metadata.annotations).length : 0);

// Reusable helpers (getStatusSeverity, getAge, getVolumeDetails)
const getStatusSeverity = (status) => {
  // Basic severity for deployment status (can be refined)
  if (deploymentDetails.value?.status?.readyReplicas === deploymentDetails.value?.spec?.replicas) {
      return 'success';
  }
  if (deploymentDetails.value?.status?.unavailableReplicas > 0) {
      return 'danger';
  }
  return 'warning'; // Default for progressing or other states
};

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

const getVolumeDetails = (volume) => {
    const details = { ...volume };
    delete details.name;
    return details;
}

// Fetch Deployment Details
const fetchDeploymentDetails = async () => {
  if (!deploymentName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/deployments/${encodeURIComponent(deploymentName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Deployment '${deploymentName.value}' in namespace '${namespace.value}' not found.`;
           deploymentDetails.value = null;
       } else {
           const errorData = await response.text();
           console.error("Deployment detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        deploymentDetails.value = data; 
        deploymentYaml.value = yaml.dump(data);
        fetchDeploymentEvents(); // Fetch events after getting deployment details
    }
  } catch (err) {
    console.error("Error fetching deployment details:", err);
    error.value = err.message;
    deploymentDetails.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Deployment Events
const fetchDeploymentEvents = async () => {
    if (!deploymentDetails.value?.metadata?.uid) return;
    loadingEvents.value = true;
    deploymentEvents.value = [];
    const deploymentUID = deploymentDetails.value.metadata.uid;
    const eventNamespace = deploymentDetails.value.metadata.namespace;

    // Construct field selector for events related to this Deployment UID
    const fieldSelector = `involvedObject.uid=${deploymentUID},involvedObject.namespace=${eventNamespace}`;

    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(eventNamespace)}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        deploymentEvents.value = data.items || [];
        deploymentEvents.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching deployment events:", err);
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchDeploymentDetails();
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