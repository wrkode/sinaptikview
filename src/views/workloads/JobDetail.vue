<template>
  <div class="card">
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else-if="job">
      <!-- Header with Job info -->
      <div class="flex align-items-center justify-content-between mb-3">
        <div>
          <h1 class="text-2xl font-bold">{{ job.metadata.name }}</h1>
          <div class="text-md text-gray-500">Namespace: {{ job.metadata.namespace }}</div>
        </div>
        <div>
          <span :class="{
            'status-badge': true,
            'status-running': isJobComplete(job),
            'status-failed': job.status.failed,
            'status-other': !isJobComplete(job) && !job.status.failed
          }">
            {{ getJobStatusText(job) }}
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
                  <h3 class="text-xl font-bold mb-3">Job Details</h3>
                  <DataTable :value="[jobDetails]" tableStyle="min-width: 50rem">
                    <Column field="name" header="Property"></Column>
                    <Column field="value" header="Value"></Column>
                  </DataTable>
                </div>
              </div>
            </div>
            <div class="col-12 md:col-6">
              <div class="p-card">
                <div class="p-card-body">
                  <h3 class="text-xl font-bold mb-3">Status</h3>
                  <div class="grid">
                    <div class="col-6 mb-3">
                      <span class="font-medium">Completions: </span>
                      <span>{{ job.status.succeeded || 0 }}/{{ job.spec.completions || 1 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Active: </span>
                      <span>{{ job.status.active || 0 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Failed: </span>
                      <span>{{ job.status.failed || 0 }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Duration: </span>
                      <span>{{ getDuration(job) }}</span>
                    </div>
                    <div class="col-12">
                      <ProgressBar :value="getCompletionPercentage(job)" :class="getStatusClass(job)" />
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
                    v-if="ownerReference.kind === 'CronJob'" 
                    :to="{ 
                      name: 'cronjob-detail', 
                      params: { 
                        namespace: job.metadata.namespace, 
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
                <div>No pods found for this Job.</div>
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
                <div>No events found for this Job.</div>
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
const job = ref(null);
const loading = ref(true);
const error = ref(null);

// Data for tabs
const pods = ref([]);
const loadingPods = ref(false);
const events = ref([]);
const loadingEvents = ref(false);

// Fetch the Job details
const fetchJob = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/jobs/${route.params.name}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    job.value = await response.json();
    // After getting Job, fetch related resources
    fetchRelatedPods();
    fetchRelatedEvents();
  } catch (err) {
    console.error('Error fetching Job details:', err);
    error.value = `Failed to fetch Job: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// Fetch pods for this Job
const fetchRelatedPods = async () => {
  if (!job.value) return;
  
  loadingPods.value = true;
  try {
    // We need to get all pods from the namespace then filter by the owner reference
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/pods`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // Filter pods that belong to this Job based on owner reference
    const jobName = job.value.metadata.name;
    pods.value = data.items.filter(pod => 
      (pod.metadata.ownerReferences && 
        pod.metadata.ownerReferences.some(ref => 
          ref.kind === 'Job' && ref.name === jobName))
    );
  } catch (err) {
    console.error('Error fetching pods:', err);
  } finally {
    loadingPods.value = false;
  }
};

// Fetch events for this Job
const fetchRelatedEvents = async () => {
  if (!job.value) return;
  
  loadingEvents.value = true;
  try {
    // Field selector to get events related to this Job
    const fieldSelector = `involvedObject.kind=Job,involvedObject.name=${route.params.name}`;
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
  if (!job.value || !job.value.metadata.ownerReferences) {
    return null;
  }
  return job.value.metadata.ownerReferences[0];
});

// Helper function to check if Job is complete
const isJobComplete = (job) => {
  const { status, spec } = job;
  return (status.succeeded || 0) === (spec.completions || 1);
};

// Helper function to determine status text
const getJobStatusText = (job) => {
  const { status } = job;
  if (status.succeeded && isJobComplete(job)) return 'Completed';
  if (status.failed) return 'Failed';
  if (status.active) return 'Running';
  return 'Pending';
};

// Get the percentage of completion for the progress bar
const getCompletionPercentage = (job) => {
  const { status, spec } = job;
  const completions = spec.completions || 1;
  return ((status.succeeded || 0) / completions) * 100;
};

// Helper function to get duration
const getDuration = (job) => {
  const { status } = job;
  if (!status.startTime) return 'N/A';
  
  const startTime = new Date(status.startTime);
  const endTime = status.completionTime ? new Date(status.completionTime) : new Date();
  
  const diffSeconds = Math.floor((endTime - startTime) / 1000);
  
  if (diffSeconds < 60) return `${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

// Helper to get status class for progress bar
const getStatusClass = (job) => {
  if (isJobComplete(job)) return 'status-running-progress';
  if (job.status.failed) return 'status-failed-progress';
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

// Format Job details for overview table
const jobDetails = computed(() => {
  if (!job.value) return {};
  
  const data = job.value;
  return {
    name: 'Name',
    value: data.metadata.name,
    namespace: 'Namespace',
    namespaceValue: data.metadata.namespace,
    completions: 'Completions',
    completionsValue: data.spec.completions || 1,
    parallelism: 'Parallelism',
    parallelismValue: data.spec.parallelism || 1,
    backoffLimit: 'Backoff Limit',
    backoffLimitValue: data.spec.backoffLimit !== undefined ? data.spec.backoffLimit : 'N/A',
    creationTimestamp: 'Created',
    creationTimestampValue: getAge(data.metadata.creationTimestamp),
  };
});

// Convert Job to YAML for YAML tab
const yamlContent = computed(() => {
  if (!job.value) return '';
  try {
    return yaml.dump(job.value);
  } catch (err) {
    console.error('Error converting to YAML:', err);
    return 'Error converting to YAML';
  }
});

// Fetch data on component mount
onMounted(() => {
  fetchJob();
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