<template>
  <div>
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-error">
      Error loading Pod Disruption Budget: {{ error }}
    </div>
    <div v-else class="card">
      <div class="flex align-items-center mb-3">
        <h2 class="text-xl font-semibold m-0">
          {{ pdb.metadata.name }}
          <span class="text-500 font-normal ml-2">in namespace {{ pdb.metadata.namespace }}</span>
        </h2>
        <Tag :severity="getStatusSeverity(pdb)" class="ml-2">
          {{ getStatusLabel(pdb) }}
        </Tag>
      </div>

      <TabView>
        <!-- Overview Tab -->
        <TabPanel header="Overview">
          <div class="grid">
            <div class="col-12 lg:col-6">
              <DataTable :value="pdbDetails" stripedRows>
                <Column field="key" header="Property"></Column>
                <Column field="value" header="Value"></Column>
              </DataTable>
            </div>
            <div class="col-12 lg:col-6">
              <Card>
                <template #title>Status</template>
                <template #content>
                  <div v-if="pdb.status">
                    <div class="mb-2">
                      <div class="text-500 mb-1">Current Healthy: {{ pdb.status.currentHealthy || 0 }}</div>
                      <div class="text-500 mb-1">Desired Healthy: {{ pdb.status.desiredHealthy || 0 }}</div>
                      <div class="text-500 mb-1">Expected Pods: {{ pdb.status.expectedPods || 0 }}</div>
                      <div class="text-500">Disruptions Allowed: {{ pdb.status.disruptionsAllowed || 0 }}</div>
                    </div>
                    <ProgressBar 
                      :value="getHealthPercentage()" 
                      :class="getHealthBarClass()"
                    ></ProgressBar>
                  </div>
                  <div v-else>
                    Status information is not available
                  </div>
                </template>
              </Card>
            </div>
          </div>
          <div class="mt-3">
            <Card v-if="pdb.spec.selector">
              <template #title>Pod Selector</template>
              <template #content>
                <div v-if="pdb.spec.selector.matchLabels" class="mb-2">
                  <h4 class="mt-0 mb-2">Match Labels</h4>
                  <div>
                    <span v-for="(value, key) in pdb.spec.selector.matchLabels" :key="key" class="mr-2 mb-2 inline-block">
                      <Tag>{{ key }}: {{ value }}</Tag>
                    </span>
                  </div>
                </div>
                <div v-if="pdb.spec.selector.matchExpressions && pdb.spec.selector.matchExpressions.length > 0">
                  <h4 class="mt-0 mb-2">Match Expressions</h4>
                  <div>
                    <span v-for="(expr, index) in pdb.spec.selector.matchExpressions" :key="index" class="mr-2 mb-2 inline-block">
                      <Tag severity="warning">
                        {{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}
                      </Tag>
                    </span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </TabPanel>

        <!-- YAML Tab -->
        <TabPanel header="YAML">
          <div class="card">
            <pre class="p-2 border-1 border-round surface-ground text-sm">{{ pdbYaml }}</pre>
          </div>
        </TabPanel>

        <!-- Pods Tab -->
        <TabPanel header="Pods">
          <div v-if="loadingPods" class="flex justify-content-center">
            <ProgressSpinner />
          </div>
          <div v-else-if="podsError" class="p-error">
            Error loading Pods: {{ podsError }}
          </div>
          <div v-else-if="affectedPods.length === 0" class="p-3 text-center">
            No pods found that match this Pod Disruption Budget's selector
          </div>
          <div v-else>
            <DataTable :value="affectedPods" stripedRows responsiveLayout="scroll"
              :paginator="affectedPods.length > 10" :rows="10">
              <Column field="metadata.name" header="Name">
                <template #body="slotProps">
                  <router-link :to="`/namespaces/${slotProps.data.metadata.namespace}/pods/${slotProps.data.metadata.name}`">
                    {{ slotProps.data.metadata.name }}
                  </router-link>
                </template>
              </Column>
              <Column field="status.phase" header="Status">
                <template #body="slotProps">
                  <Tag :severity="getPodStatusSeverity(slotProps.data.status.phase)">
                    {{ slotProps.data.status.phase }}
                  </Tag>
                </template>
              </Column>
              <Column header="Ready">
                <template #body="slotProps">
                  {{ getPodReadyCount(slotProps.data) }}
                </template>
              </Column>
              <Column header="Restarts">
                <template #body="slotProps">
                  {{ getPodRestarts(slotProps.data) }}
                </template>
              </Column>
              <Column header="Age">
                <template #body="slotProps">
                  {{ calculateAge(slotProps.data.metadata.creationTimestamp) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- Events Tab -->
        <TabPanel header="Events">
          <div v-if="loadingEvents" class="flex justify-content-center">
            <ProgressSpinner />
          </div>
          <div v-else-if="eventsError" class="p-error">
            Error loading Events: {{ eventsError }}
          </div>
          <div v-else-if="events.length === 0" class="p-3 text-center">
            No events found for this Pod Disruption Budget
          </div>
          <div v-else>
            <DataTable :value="events" stripedRows responsiveLayout="scroll"
              :paginator="events.length > 10" :rows="10">
              <Column field="metadata.creationTimestamp" header="Time">
                <template #body="slotProps">
                  {{ formatEventTime(slotProps.data.metadata.creationTimestamp) }}
                </template>
              </Column>
              <Column field="type" header="Type">
                <template #body="slotProps">
                  <Tag :severity="getEventTypeSeverity(slotProps.data.type)">
                    {{ slotProps.data.type }}
                  </Tag>
                </template>
              </Column>
              <Column field="reason" header="Reason"></Column>
              <Column field="message" header="Message"></Column>
              <Column field="involvedObject.kind" header="Object Kind"></Column>
              <Column field="involvedObject.name" header="Object Name"></Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import yaml from 'js-yaml';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const toast = useToast();
const namespace = route.params.namespace;
const name = route.params.name;

// Reactive state
const pdb = ref({});
const loading = ref(true);
const error = ref(null);
const affectedPods = ref([]);
const loadingPods = ref(false);
const podsError = ref(null);
const events = ref([]);
const loadingEvents = ref(false);
const eventsError = ref(null);

// Computed properties
const pdbDetails = computed(() => {
  if (!pdb.value || !pdb.value.metadata) return [];

  const details = [
    { key: 'Name', value: pdb.value.metadata.name },
    { key: 'Namespace', value: pdb.value.metadata.namespace },
    { key: 'Creation Time', value: new Date(pdb.value.metadata.creationTimestamp).toLocaleString() },
    { key: 'Age', value: calculateAge(pdb.value.metadata.creationTimestamp) },
    { key: 'Min Available', value: pdb.value.spec.minAvailable || 'N/A' },
    { key: 'Max Unavailable', value: pdb.value.spec.maxUnavailable || 'N/A' },
  ];

  if (pdb.value.metadata.labels) {
    details.push({ key: 'Labels', value: formatLabels(pdb.value.metadata.labels) });
  }

  if (pdb.value.metadata.ownerReferences && pdb.value.metadata.ownerReferences.length > 0) {
    const owners = pdb.value.metadata.ownerReferences.map(ref => 
      `${ref.kind} ${ref.name}`
    ).join(', ');
    details.push({ key: 'Controlled By', value: owners });
  }

  return details;
});

const pdbYaml = computed(() => {
  if (!pdb.value || !pdb.value.metadata) return '';
  try {
    // Remove managed fields to make the YAML cleaner
    const pdbCopy = JSON.parse(JSON.stringify(pdb.value));
    if (pdbCopy.metadata) {
      delete pdbCopy.metadata.managedFields;
    }
    return yaml.dump(pdbCopy);
  } catch (e) {
    console.error('Error converting PDB to YAML:', e);
    return 'Error converting to YAML';
  }
});

// Methods
const fetchPodDisruptionBudget = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get(`/api/v1/namespaces/${namespace}/poddisruptionbudgets/${name}`);
    pdb.value = response.data;
    fetchAffectedPods();
    fetchEvents();
  } catch (err) {
    console.error('Error fetching Pod Disruption Budget:', err);
    error.value = err.message || 'Failed to load Pod Disruption Budget';
    toast.add({ 
      severity: 'error', 
      summary: 'Error loading Pod Disruption Budget', 
      detail: err.message || 'Failed to load Pod Disruption Budget',
      life: 5000 
    });
  } finally {
    loading.value = false;
  }
};

const fetchAffectedPods = async () => {
  if (!pdb.value || !pdb.value.spec || !pdb.value.spec.selector) {
    affectedPods.value = [];
    return;
  }

  loadingPods.value = true;
  podsError.value = null;
  
  try {
    // Fetch pods in the same namespace
    const response = await axios.get(`/api/v1/pods`, {
      params: { namespace: namespace }
    });
    
    // Filter pods based on the PDB selector
    if (pdb.value.spec.selector.matchLabels) {
      affectedPods.value = response.data.items.filter(pod => {
        if (!pod.metadata.labels) return false;
        
        // Check if all matchLabels match the pod's labels
        return Object.entries(pdb.value.spec.selector.matchLabels).every(([key, value]) => 
          pod.metadata.labels[key] === value
        );
      });
    } else {
      // If there's no matchLabels, we can't easily filter on the client side
      // In a real app, this filtering should be done server-side
      affectedPods.value = [];
    }
  } catch (err) {
    console.error('Error fetching pods:', err);
    podsError.value = err.message || 'Failed to load pods';
  } finally {
    loadingPods.value = false;
  }
};

const fetchEvents = async () => {
  loadingEvents.value = true;
  eventsError.value = null;
  
  try {
    // Fetch events related to this PDB
    const response = await axios.get('/api/v1/events', {
      params: { 
        namespace: namespace,
        fieldSelector: `involvedObject.name=${name},involvedObject.kind=PodDisruptionBudget`
      }
    });
    events.value = response.data.items || [];
  } catch (err) {
    console.error('Error fetching events:', err);
    eventsError.value = err.message || 'Failed to load events';
  } finally {
    loadingEvents.value = false;
  }
};

// Helper functions
const getStatusLabel = (pdb) => {
  if (!pdb.status) {
    return 'Unknown';
  }

  const disruptionsAllowed = pdb.status.disruptionsAllowed || 0;
  const currentHealthy = pdb.status.currentHealthy || 0;
  const desiredHealthy = pdb.status.desiredHealthy || 0;
  
  if (disruptionsAllowed === 0 && currentHealthy <= desiredHealthy) {
    return 'No Disruptions Allowed';
  } else if (currentHealthy > desiredHealthy) {
    return 'Healthy';
  } else {
    return `${disruptionsAllowed} Disruptions Allowed`;
  }
};

const getStatusSeverity = (pdb) => {
  if (!pdb.status) {
    return 'secondary';
  }

  const disruptionsAllowed = pdb.status.disruptionsAllowed || 0;
  const currentHealthy = pdb.status.currentHealthy || 0;
  const desiredHealthy = pdb.status.desiredHealthy || 0;
  
  if (disruptionsAllowed === 0 && currentHealthy <= desiredHealthy) {
    return 'warning';
  } else if (currentHealthy > desiredHealthy) {
    return 'success';
  } else {
    return 'info';
  }
};

const getHealthPercentage = () => {
  if (!pdb.value.status) return 0;
  
  const currentHealthy = pdb.value.status.currentHealthy || 0;
  const expectedPods = pdb.value.status.expectedPods || 0;
  
  if (expectedPods === 0) return 0;
  return Math.min(Math.round((currentHealthy / expectedPods) * 100), 100);
};

const getHealthBarClass = () => {
  const percentage = getHealthPercentage();
  if (percentage >= 90) return 'health-bar-success';
  if (percentage >= 50) return 'health-bar-warning';
  return 'health-bar-danger';
};

const getPodStatusSeverity = (phase) => {
  switch (phase) {
    case 'Running':
      return 'success';
    case 'Pending':
      return 'warning';
    case 'Failed':
      return 'danger';
    case 'Succeeded':
      return 'info';
    default:
      return 'secondary';
  }
};

const getPodReadyCount = (pod) => {
  if (!pod.status || !pod.status.containerStatuses) {
    return '0/0';
  }
  
  const total = pod.status.containerStatuses.length;
  const ready = pod.status.containerStatuses.filter(status => status.ready).length;
  
  return `${ready}/${total}`;
};

const getPodRestarts = (pod) => {
  if (!pod.status || !pod.status.containerStatuses) {
    return 0;
  }
  
  return pod.status.containerStatuses.reduce((total, status) => 
    total + (status.restartCount || 0), 0);
};

const getEventTypeSeverity = (type) => {
  switch (type) {
    case 'Normal':
      return 'info';
    case 'Warning':
      return 'warning';
    default:
      return 'secondary';
  }
};

const formatLabels = (labels) => {
  if (!labels) return 'None';
  return Object.entries(labels)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
};

const formatEventTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString();
};

const calculateAge = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours > 0) {
    return `${diffHours}h`;
  }
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${diffMinutes}m`;
};

// Lifecycle hooks
onMounted(() => {
  fetchPodDisruptionBudget();
});
</script>

<style scoped>
.health-bar-success {
  background: linear-gradient(to right, #34d399, #10b981);
}

.health-bar-warning {
  background: linear-gradient(to right, #fbbf24, #f59e0b);
}

.health-bar-danger {
  background: linear-gradient(to right, #f87171, #ef4444);
}
</style> 