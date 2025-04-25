<template>
  <div>
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-error">
      Error loading Limit Range: {{ error }}
    </div>
    <div v-else class="card">
      <div class="flex align-items-center mb-3">
        <h2 class="text-xl font-semibold m-0">
          {{ limitRange.metadata.name }}
          <span class="text-500 font-normal ml-2">in namespace {{ limitRange.metadata.namespace }}</span>
        </h2>
      </div>

      <TabView>
        <!-- Overview Tab -->
        <TabPanel header="Overview">
          <div class="grid">
            <div class="col-12 lg:col-6">
              <DataTable :value="limitRangeDetails" stripedRows>
                <Column field="key" header="Property"></Column>
                <Column field="value" header="Value"></Column>
              </DataTable>
            </div>
          </div>
          
          <div class="mt-4">
            <h3 class="text-lg font-medium mb-2">Limit Specifications</h3>
            <div v-for="(limit, index) in getLimitSpecs()" :key="index" class="mb-4">
              <Card>
                <template #title>{{ limit.type || 'Unknown Type' }}</template>
                <template #content>
                  <div v-if="limit.max && Object.keys(limit.max).length > 0" class="mb-3">
                    <h4 class="font-medium mb-2">Maximum Limits</h4>
                    <div class="flex flex-wrap gap-2">
                      <Tag v-for="(value, resource) in limit.max" :key="`max-${resource}`" severity="danger">
                        {{ resource }}: {{ value }}
                      </Tag>
                    </div>
                  </div>
                  
                  <div v-if="limit.min && Object.keys(limit.min).length > 0" class="mb-3">
                    <h4 class="font-medium mb-2">Minimum Limits</h4>
                    <div class="flex flex-wrap gap-2">
                      <Tag v-for="(value, resource) in limit.min" :key="`min-${resource}`" severity="info">
                        {{ resource }}: {{ value }}
                      </Tag>
                    </div>
                  </div>
                  
                  <div v-if="limit.default && Object.keys(limit.default).length > 0" class="mb-3">
                    <h4 class="font-medium mb-2">Default Limits</h4>
                    <div class="flex flex-wrap gap-2">
                      <Tag v-for="(value, resource) in limit.default" :key="`default-${resource}`" severity="success">
                        {{ resource }}: {{ value }}
                      </Tag>
                    </div>
                  </div>
                  
                  <div v-if="limit.defaultRequest && Object.keys(limit.defaultRequest).length > 0" class="mb-3">
                    <h4 class="font-medium mb-2">Default Requests</h4>
                    <div class="flex flex-wrap gap-2">
                      <Tag v-for="(value, resource) in limit.defaultRequest" :key="`defaultRequest-${resource}`" severity="warning">
                        {{ resource }}: {{ value }}
                      </Tag>
                    </div>
                  </div>
                  
                  <div v-if="limit.maxLimitRequestRatio && Object.keys(limit.maxLimitRequestRatio).length > 0">
                    <h4 class="font-medium mb-2">Max Limit/Request Ratio</h4>
                    <div class="flex flex-wrap gap-2">
                      <Tag v-for="(value, resource) in limit.maxLimitRequestRatio" :key="`ratio-${resource}`" severity="secondary">
                        {{ resource }}: {{ value }}
                      </Tag>
                    </div>
                  </div>
                </template>
              </Card>
            </div>
          </div>
        </TabPanel>

        <!-- YAML Tab -->
        <TabPanel header="YAML">
          <div class="card">
            <pre class="p-2 border-1 border-round surface-ground text-sm">{{ limitRangeYaml }}</pre>
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
            No events found for this Limit Range
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
const limitRange = ref({});
const loading = ref(true);
const error = ref(null);
const events = ref([]);
const loadingEvents = ref(false);
const eventsError = ref(null);

// Computed properties
const limitRangeDetails = computed(() => {
  if (!limitRange.value || !limitRange.value.metadata) return [];

  const details = [
    { key: 'Name', value: limitRange.value.metadata.name },
    { key: 'Namespace', value: limitRange.value.metadata.namespace },
    { key: 'Creation Time', value: new Date(limitRange.value.metadata.creationTimestamp).toLocaleString() },
    { key: 'Age', value: calculateAge(limitRange.value.metadata.creationTimestamp) }
  ];

  if (limitRange.value.metadata.labels) {
    details.push({ key: 'Labels', value: formatLabels(limitRange.value.metadata.labels) });
  }

  if (limitRange.value.metadata.annotations) {
    details.push({ key: 'Annotations', value: formatLabels(limitRange.value.metadata.annotations) });
  }

  if (limitRange.value.metadata.ownerReferences && limitRange.value.metadata.ownerReferences.length > 0) {
    const owners = limitRange.value.metadata.ownerReferences.map(ref => 
      `${ref.kind} ${ref.name}`
    ).join(', ');
    details.push({ key: 'Controlled By', value: owners });
  }

  return details;
});

const limitRangeYaml = computed(() => {
  if (!limitRange.value || !limitRange.value.metadata) return '';
  try {
    // Remove managed fields to make the YAML cleaner
    const limitRangeCopy = JSON.parse(JSON.stringify(limitRange.value));
    if (limitRangeCopy.metadata) {
      delete limitRangeCopy.metadata.managedFields;
    }
    return yaml.dump(limitRangeCopy);
  } catch (e) {
    console.error('Error converting Limit Range to YAML:', e);
    return 'Error converting to YAML';
  }
});

// Methods
const fetchLimitRange = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get(`/api/v1/namespaces/${namespace}/limitranges/${name}`);
    limitRange.value = response.data;
    fetchEvents();
  } catch (err) {
    console.error('Error fetching Limit Range:', err);
    error.value = err.message || 'Failed to load Limit Range';
    toast.add({ 
      severity: 'error', 
      summary: 'Error loading Limit Range', 
      detail: err.message || 'Failed to load Limit Range',
      life: 5000 
    });
  } finally {
    loading.value = false;
  }
};

const fetchEvents = async () => {
  loadingEvents.value = true;
  eventsError.value = null;
  
  try {
    // Fetch events related to this Limit Range
    const response = await axios.get('/api/v1/events', {
      params: { 
        namespace: namespace,
        fieldSelector: `involvedObject.name=${name},involvedObject.kind=LimitRange`
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
const getLimitSpecs = () => {
  if (!limitRange.value.spec || !limitRange.value.spec.limits) {
    return [];
  }
  return limitRange.value.spec.limits;
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
  fetchLimitRange();
});
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 500px;
  overflow-y: auto;
}
</style> 