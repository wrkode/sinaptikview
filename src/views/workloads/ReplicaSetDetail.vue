<template>
  <div class="card">
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else-if="replicaset">
      <!-- Header with ReplicaSet info -->
      <div class="flex align-items-center justify-content-between mb-3">
        <div>
          <h1 class="text-2xl font-bold">{{ replicaset.metadata.name }}</h1>
          <div class="text-md text-gray-500">Namespace: {{ replicaset.metadata.namespace }}</div>
        </div>
        <div>
          <span :class="{
            'status-badge': true,
            'status-running': isReplicaSetReady(replicaset),
            'status-failed': !replicaset.status.availableReplicas,
            'status-other': !isReplicaSetReady(replicaset) && replicaset.status.availableReplicas > 0
          }">
            {{ getReplicaSetStatusText(replicaset) }}
          </span>
        </div>
      </div>

      <!-- Tabs -->
      <TabView>
        <!-- Overview Tab -->
        <TabPanel header="Overview">
          <div class="grid">
            <div class="col-12 md:col-6">
              <div class="p-card mb-3">
                <div class="p-card-body">
                  <h3 class="text-xl font-bold mb-3">ReplicaSet Details</h3>
                  <DataTable :value="[replicasetDetails]" tableStyle="min-width: 50rem">
                    <Column field="name" header="Property"></Column>
                    <Column field="value" header="Value"></Column>
                  </DataTable>
                </div>
              </div>
            </div>
            <div class="col-12 md:col-6">
              <div class="p-card">
                <div class="p-card-body">
                  <h3 class="text-xl font-bold mb-3">Replicas</h3>
                  <div class="grid">
                    <div class="col-6 mb-3">
                      <span class="font-medium">Desired: </span>
                      <span>{{ replicaset.spec.replicas || 0 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Current: </span>
                      <span>{{ replicaset.status.replicas || 0 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Ready: </span>
                      <span>{{ replicaset.status.readyReplicas || 0 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Available: </span>
                      <span>{{ replicaset.status.availableReplicas || 0 }}</span>
                    </div>
                    <div class="col-12">
                      <ProgressBar :value="getReadyPercentage(replicaset)" :class="getStatusClass(replicaset)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="ownerReference" class="p-card mt-3">
            <div class="p-card-body">
              <h3 class="text-xl font-bold mb-3">Owner</h3>
              <div class="flex">
                <div class="w-6rem font-medium">Kind:</div>
                <div>{{ ownerReference.kind }}</div>
              </div>
              <div class="flex mt-2">
                <div class="w-6rem font-medium">Name:</div>
                <div>
                  <router-link 
                    v-if="ownerReference.kind === 'Deployment'" 
                    :to="{ 
                      name: 'deployment-detail', 
                      params: { 
                        namespace: replicaset.metadata.namespace, 
                        name: ownerReference.name 
                      }
                    }" 
                    class="text-primary hover:underline">
                    {{ ownerReference.name }}
                  </router-link>
                  <span v-else>{{ ownerReference.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- YAML Tab -->
        <TabPanel header="YAML">
          <div class="yaml-container">
            <pre class="yaml-content">{{ yamlContent }}</pre>
          </div>
        </TabPanel>

        <!-- Pods Tab -->
        <TabPanel header="Pods">
          <div class="p-3">
            <h3 class="text-xl font-bold mb-3">Pods</h3>
            <DataTable :value="pods" :loading="loadingPods" tableStyle="min-width: 50rem">
              <template #empty>
                <div>No pods found for this ReplicaSet.</div>
              </template>
              <template #loading>Loading pods data. Please wait.</template>
              <Column field="metadata.name" header="Name">
                <template #body="slotProps">
                  <router-link 
                    :to="{ 
                      name: 'pod-detail', 
                      params: { 
                        namespace: slotProps.data.metadata.namespace, 
                        name: slotProps.data.metadata.name 
                      }
                    }" 
                    class="text-primary hover:underline">
                    {{ slotProps.data.metadata.name }}
                  </router-link>
                </template>
              </Column>
              <Column field="status.phase" header="Status">
                <template #body="slotProps">
                  <span :class="{
                    'status-badge': true,
                    'status-running': slotProps.data.status.phase === 'Running',
                    'status-failed': slotProps.data.status.phase === 'Failed',
                    'status-other': !['Running', 'Failed'].includes(slotProps.data.status.phase)
                  }">
                    {{ slotProps.data.status.phase }}
                  </span>
                </template>
              </Column>
              <Column field="status.podIP" header="Pod IP"></Column>
              <Column field="spec.nodeName" header="Node"></Column>
              <Column header="Age">
                <template #body="slotProps">
                  {{ getAge(slotProps.data.metadata.creationTimestamp) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- Events Tab -->
        <TabPanel header="Events">
          <div class="p-3">
            <h3 class="text-xl font-bold mb-3">Events</h3>
            <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem">
              <template #empty>
                <div>No events found for this ReplicaSet.</div>
              </template>
              <template #loading>Loading events data. Please wait.</template>
              <Column field="type" header="Type"></Column>
              <Column field="reason" header="Reason"></Column>
              <Column field="message" header="Message"></Column>
              <Column field="metadata.creationTimestamp" header="Age">
                <template #body="slotProps">
                  {{ getAge(slotProps.data.metadata.creationTimestamp) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabView>

    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const replicaset = ref(null);
const loading = ref(true);
const error = ref(null);

// Data for tabs
const pods = ref([]);
const loadingPods = ref(false);
const events = ref([]);
const loadingEvents = ref(false);

// Fetch the ReplicaSet details
const fetchReplicaSet = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/replicasets/${route.params.name}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    replicaset.value = await response.json();
    // After getting ReplicaSet, fetch related resources
    fetchRelatedPods();
    fetchRelatedEvents();
  } catch (err) {
    console.error('Error fetching ReplicaSet details:', err);
    error.value = `Failed to fetch ReplicaSet: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// Fetch pods for this ReplicaSet
const fetchRelatedPods = async () => {
  if (!replicaset.value) return;
  
  loadingPods.value = true;
  try {
    // We need to get all pods from the namespace then filter by the owner reference
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/pods`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // Filter pods that belong to this ReplicaSet based on owner reference
    const rsName = replicaset.value.metadata.name;
    pods.value = data.items.filter(pod => 
      (pod.metadata.ownerReferences && 
        pod.metadata.ownerReferences.some(ref => 
          ref.kind === 'ReplicaSet' && ref.name === rsName))
    );
  } catch (err) {
    console.error('Error fetching pods:', err);
  } finally {
    loadingPods.value = false;
  }
};

// Fetch events for this ReplicaSet
const fetchRelatedEvents = async () => {
  if (!replicaset.value) return;
  
  loadingEvents.value = true;
  try {
    // Field selector to get events related to this ReplicaSet
    const fieldSelector = `involvedObject.kind=ReplicaSet,involvedObject.name=${route.params.name}`;
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    events.value = data.items || [];
  } catch (err) {
    console.error('Error fetching events:', err);
  } finally {
    loadingEvents.value = false;
  }
};

// Get owner reference if exists
const ownerReference = computed(() => {
  if (!replicaset.value || !replicaset.value.metadata.ownerReferences) {
    return null;
  }
  return replicaset.value.metadata.ownerReferences[0];
});

// Helper function to check if ReplicaSet is ready
const isReplicaSetReady = (replicaset) => {
  const { status, spec } = replicaset;
  return status.availableReplicas === spec.replicas && 
         spec.replicas > 0;
};

// Helper function to determine status text
const getReplicaSetStatusText = (replicaset) => {
  const { status, spec } = replicaset;
  if (!status.availableReplicas) return 'Not Ready';
  if (isReplicaSetReady(replicaset)) return 'Ready';
  return `Scaling (${status.availableReplicas}/${spec.replicas})`;
};

// Get the percentage of ready pods for the progress bar
const getReadyPercentage = (replicaset) => {
  const { status, spec } = replicaset;
  if (!spec.replicas) return 0;
  return ((status.availableReplicas || 0) / spec.replicas) * 100;
};

// Helper to get status class for progress bar
const getStatusClass = (replicaset) => {
  if (isReplicaSetReady(replicaset)) return 'status-running-progress';
  if (!replicaset.status.availableReplicas) return 'status-failed-progress';
  return 'status-other-progress';
};

// Helper to get age from timestamp
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

// Format ReplicaSet details for overview table
const replicasetDetails = computed(() => {
  if (!replicaset.value) return {};
  
  const data = replicaset.value;
  return {
    name: 'Name',
    value: data.metadata.name,
    namespace: 'Namespace',
    namespaceValue: data.metadata.namespace,
    selector: 'Selector',
    selectorValue: Object.entries(data.spec.selector.matchLabels || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', '),
    creationTimestamp: 'Created',
    creationTimestampValue: getAge(data.metadata.creationTimestamp),
  };
});

// Convert ReplicaSet to YAML for YAML tab
const yamlContent = computed(() => {
  if (!replicaset.value) return '';
  try {
    return yaml.dump(replicaset.value);
  } catch (err) {
    console.error('Error converting to YAML:', err);
    return 'Error converting to YAML';
  }
});

// Fetch data on component mount
onMounted(() => {
  fetchReplicaSet();
});
</script>

<style scoped>
.yaml-container {
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 1rem;
  overflow: auto;
  max-height: 500px;
}

.yaml-content {
  white-space: pre-wrap;
  font-family: monospace;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-weight: 500;
  display: inline-block;
}

.status-running {
  background-color: rgba(80, 200, 120, 0.2);
  color: #2c8c51;
}

.status-failed {
  background-color: rgba(240, 80, 80, 0.2);
  color: #e01e1e;
}

.status-other {
  background-color: rgba(240, 180, 0, 0.2);
  color: #cb9303;
}

.status-running-progress .p-progressbar-value {
  background: #2c8c51;
}

.status-failed-progress .p-progressbar-value {
  background: #e01e1e;
}

.status-other-progress .p-progressbar-value {
  background: #cb9303;
}
</style> 