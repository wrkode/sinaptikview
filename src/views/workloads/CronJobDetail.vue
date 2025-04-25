<template>
  <div class="card">
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else-if="cronjob">
      <!-- Header with CronJob info -->
      <div class="flex align-items-center justify-content-between mb-3">
        <div>
          <h1 class="text-2xl font-bold">{{ cronjob.metadata.name }}</h1>
          <div class="text-md text-gray-500">Namespace: {{ cronjob.metadata.namespace }}</div>
        </div>
        <div>
          <span :class="{
            'status-badge': true,
            'status-running': isCronJobActive(cronjob),
            'status-failed': isCronJobSuspended(cronjob),
            'status-other': !isCronJobActive(cronjob) && !isCronJobSuspended(cronjob)
          }">
            {{ getCronJobStatusText(cronjob) }}
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
                  <h3 class="text-xl font-bold mb-3">CronJob Details</h3>
                  <DataTable :value="[cronjobDetails]" tableStyle="min-width: 50rem">
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
                      <span class="font-medium">Schedule: </span>
                      <span>{{ cronjob.spec.schedule }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Concurrency Policy: </span>
                      <span>{{ cronjob.spec.concurrencyPolicy || 'Allow' }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Last Schedule: </span>
                      <span>{{ getLastScheduleTime(cronjob) }}</span>
                    </div>
                    <div class="col-6 mb-3">
                      <span class="font-medium">Active Jobs: </span>
                      <span>{{ (cronjob.status && cronjob.status.active) ? cronjob.status.active.length : 0 }}</span>
                    </div>
                  </div>
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

        <!-- Jobs Tab -->
        <TabPanel header="Jobs">
          <div class="p-3">
            <h3 class="text-xl font-bold mb-3">Jobs</h3>
            <DataTable :value="jobs" :loading="loadingJobs" tableStyle="min-width: 50rem">
              <template #empty>
                <div>No jobs found for this CronJob.</div>
              </template>
              <template #loading>Loading jobs data. Please wait.</template>
              <Column field="metadata.name" header="Name">
                <template #body="slotProps">
                  <router-link 
                    :to="{ 
                      name: 'job-detail', 
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
              <Column header="Status">
                <template #body="slotProps">
                  <span :class="{
                    'status-badge': true,
                    'status-running': isJobComplete(slotProps.data),
                    'status-failed': slotProps.data.status.failed,
                    'status-other': !isJobComplete(slotProps.data) && !slotProps.data.status.failed
                  }">
                    {{ getJobStatusText(slotProps.data) }}
                  </span>
                </template>
              </Column>
              <Column header="Completions">
                <template #body="slotProps">
                  <span>{{ slotProps.data.status.succeeded || 0 }}/{{ slotProps.data.spec.completions || 1 }}</span>
                </template>
              </Column>
              <Column header="Duration">
                <template #body="slotProps">
                  {{ getDuration(slotProps.data) }}
                </template>
              </Column>
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
                <div>No events found for this CronJob.</div>
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
import ProgressSpinner from 'primevue/progressspinner';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const cronjob = ref(null);
const loading = ref(true);
const error = ref(null);

// Data for tabs
const jobs = ref([]);
const loadingJobs = ref(false);
const events = ref([]);
const loadingEvents = ref(false);

// Fetch the CronJob details
const fetchCronJob = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/cronjobs/${route.params.name}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    cronjob.value = await response.json();
    // After getting CronJob, fetch related resources
    fetchRelatedJobs();
    fetchRelatedEvents();
  } catch (err) {
    console.error('Error fetching CronJob details:', err);
    error.value = `Failed to fetch CronJob: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// Fetch jobs for this CronJob
const fetchRelatedJobs = async () => {
  if (!cronjob.value) return;
  
  loadingJobs.value = true;
  try {
    // We need to get all jobs from the namespace then filter by the owner reference
    const response = await fetch(`/api/v1/namespaces/${route.params.namespace}/jobs`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // Filter jobs that belong to this CronJob based on owner reference
    const cronJobName = cronjob.value.metadata.name;
    jobs.value = data.items.filter(job => 
      (job.metadata.ownerReferences && 
        job.metadata.ownerReferences.some(ref => 
          ref.kind === 'CronJob' && ref.name === cronJobName))
    );
  } catch (err) {
    console.error('Error fetching jobs:', err);
  } finally {
    loadingJobs.value = false;
  }
};

// Fetch events for this CronJob
const fetchRelatedEvents = async () => {
  if (!cronjob.value) return;
  
  loadingEvents.value = true;
  try {
    // Field selector to get events related to this CronJob
    const fieldSelector = `involvedObject.kind=CronJob,involvedObject.name=${route.params.name}`;
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

// Helper functions for CronJob status
const isCronJobActive = (cronjob) => {
  return !cronjob.spec.suspend;
};

const isCronJobSuspended = (cronjob) => {
  return cronjob.spec.suspend === true;
};

const getCronJobStatusText = (cronjob) => {
  if (isCronJobSuspended(cronjob)) return 'Suspended';
  return 'Active';
};

// Helper function to format last schedule time
const getLastScheduleTime = (cronjob) => {
  if (!cronjob.status || !cronjob.status.lastScheduleTime) return 'Never';
  return getAge(cronjob.status.lastScheduleTime);
};

// Helper functions for Job status
const isJobComplete = (job) => {
  const { status, spec } = job;
  return (status.succeeded || 0) === (spec.completions || 1);
};

const getJobStatusText = (job) => {
  const { status } = job;
  if (status.succeeded && isJobComplete(job)) return 'Completed';
  if (status.failed) return 'Failed';
  if (status.active) return 'Running';
  return 'Pending';
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

// Format CronJob details for overview table
const cronjobDetails = computed(() => {
  if (!cronjob.value) return {};
  
  const data = cronjob.value;
  return {
    name: 'Name',
    value: data.metadata.name,
    namespace: 'Namespace',
    namespaceValue: data.metadata.namespace,
    schedule: 'Schedule',
    scheduleValue: data.spec.schedule,
    concurrencyPolicy: 'Concurrency Policy',
    concurrencyPolicyValue: data.spec.concurrencyPolicy || 'Allow',
    suspend: 'Suspended',
    suspendValue: data.spec.suspend ? 'Yes' : 'No',
    successfulJobsHistoryLimit: 'Successful Jobs History Limit',
    successfulJobsHistoryLimitValue: data.spec.successfulJobsHistoryLimit !== undefined ? data.spec.successfulJobsHistoryLimit : 'N/A',
    failedJobsHistoryLimit: 'Failed Jobs History Limit',
    failedJobsHistoryLimitValue: data.spec.failedJobsHistoryLimit !== undefined ? data.spec.failedJobsHistoryLimit : 'N/A',
    creationTimestamp: 'Created',
    creationTimestampValue: getAge(data.metadata.creationTimestamp),
  };
});

// Convert CronJob to YAML for YAML tab
const yamlContent = computed(() => {
  if (!cronjob.value) return '';
  try {
    return yaml.dump(cronjob.value);
  } catch (err) {
    console.error('Error converting to YAML:', err);
    return 'Error converting to YAML';
  }
});

// Fetch data on component mount
onMounted(() => {
  fetchCronJob();
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
</style> 