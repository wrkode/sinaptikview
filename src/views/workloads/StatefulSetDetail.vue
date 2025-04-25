<template>
  <div class="card">
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else-if="statefulset">
      <!-- Header with StatefulSet info -->
      <div class="flex align-items-center justify-content-between mb-3">
        <div>
          <h1 class="text-2xl font-bold">{{ statefulset.metadata.name }}</h1>
          <div class="text-md text-gray-500">Namespace: {{ statefulset.metadata.namespace }}</div>
        </div>
        <div>
          <span :class="{
            'status-badge': true,
            'status-running': statefulset.status.replicas === statefulset.spec.replicas && statefulset.status.readyReplicas === statefulset.spec.replicas,
            'status-failed': !statefulset.status.replicas,
            'status-other': statefulset.status.replicas !== statefulset.spec.replicas || statefulset.status.readyReplicas !== statefulset.spec.replicas
          }">
            {{ getStatusText(statefulset) }}
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
                  <h3 class="text-xl font-bold mb-3">StatefulSet Details</h3>
                  <DataTable :value="[statefulsetDetails]" tableStyle="min-width: 50rem">
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
                  <div class="flex justify-content-between mb-3">
                    <div>Current: {{ statefulset.status.replicas || 0 }}</div>
                    <div>Desired: {{ statefulset.spec.replicas }}</div>
                    <div>Ready: {{ statefulset.status.readyReplicas || 0 }}</div>
                  </div>
                  <ProgressBar :value="getReplicaPercentage(statefulset)" :class="getReplicaStatusClass(statefulset)" />
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
                <div>No pods found for this StatefulSet.</div>
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
                <div>No events found for this StatefulSet.</div>
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
const statefulset = ref(null);
const loading = ref(true);
const error = ref(null);

// Data for tabs
const pods = ref([]);
const loadingPods = ref(false);
const events = ref([]);
const loadingEvents = ref(false);

// Fetch the StatefulSet details
const fetchStatefulSet = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/statefulsets/${route.params.name}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    statefulset.value = await response.json();
    // After getting StatefulSet, fetch related resources
    fetchRelatedPods();
    fetchRelatedEvents();
  } catch (err) {
    console.error('Error fetching StatefulSet details:', err);
    error.value = `Failed to fetch StatefulSet: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// Fetch pods for this StatefulSet
const fetchRelatedPods = async () => {
  if (!statefulset.value) return;
  
  loadingPods.value = true;
  try {
    // We need to get all pods from the namespace then filter by the owner reference
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/pods`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // Filter pods that belong to this StatefulSet based on label selector
    const stsName = statefulset.value.metadata.name;
    pods.value = data.items.filter(pod => 
      pod.metadata.name.startsWith(stsName + '-') ||
      (pod.metadata.ownerReferences && 
        pod.metadata.ownerReferences.some(ref => 
          ref.kind === 'StatefulSet' && ref.name === stsName))
    );
  } catch (err) {
    console.error('Error fetching pods:', err);
  } finally {
    loadingPods.value = false;
  }
};

// Fetch events for this StatefulSet
const fetchRelatedEvents = async () => {
  if (!statefulset.value) return;
  
  loadingEvents.value = true;
  try {
    // Field selector to get events related to this StatefulSet
    const fieldSelector = `involvedObject.kind=StatefulSet,involvedObject.name=${route.params.name}`;
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

// Helper to get status text
const getStatusText = (statefulset) => {
  const { status, spec } = statefulset;
  if (!status.replicas) return 'Stopped';
  if (status.replicas === spec.replicas && status.readyReplicas === spec.replicas) return 'Running';
  return `Scaling (${status.readyReplicas || 0}/${spec.replicas})`;
};

// Helper to get replica percentage for progress bar
const getReplicaPercentage = (statefulset) => {
  if (!statefulset.spec.replicas) return 0;
  const readyReplicas = statefulset.status.readyReplicas || 0;
  return (readyReplicas / statefulset.spec.replicas) * 100;
};

// Helper to get class for replica progress bar
const getReplicaStatusClass = (statefulset) => {
  const percentage = getReplicaPercentage(statefulset);
  if (percentage === 100) return 'status-running-progress';
  if (percentage === 0) return 'status-failed-progress';
  return 'status-other-progress';
};

// Format StatefulSet details for overview table
const statefulsetDetails = computed(() => {
  if (!statefulset.value) return {};
  
  const data = statefulset.value;
  return {
    name: 'Name',
    value: data.metadata.name,
    namespace: 'Namespace',
    namespaceValue: data.metadata.namespace,
    serviceName: 'Service Name',
    serviceNameValue: data.spec.serviceName,
    podManagementPolicy: 'Pod Management Policy',
    podManagementPolicyValue: data.spec.podManagementPolicy || 'OrderedReady',
    updateStrategy: 'Update Strategy',
    updateStrategyValue: data.spec.updateStrategy?.type || 'RollingUpdate',
    selector: 'Selector',
    selectorValue: Object.entries(data.spec.selector.matchLabels || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', '),
    creationTimestamp: 'Created',
    creationTimestampValue: getAge(data.metadata.creationTimestamp),
  };
});

// Convert StatefulSet to YAML for YAML tab
const yamlContent = computed(() => {
  if (!statefulset.value) return '';
  try {
    return yaml.dump(statefulset.value);
  } catch (err) {
    console.error('Error converting to YAML:', err);
    return 'Error converting to YAML';
  }
});

// Fetch data on component mount
onMounted(() => {
  fetchStatefulSet();
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