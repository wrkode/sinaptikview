<template>
  <div>
    <div v-if="loading" class="flex justify-content-center">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="surface-card p-4 border-round shadow-2">
      <div class="text-3xl text-900 font-medium mb-3">Error Loading Endpoint</div>
      <div class="text-500 mb-5">{{ error }}</div>
      <Button label="Retry" @click="fetchEndpoint" />
    </div>
    <div v-else-if="!endpoint" class="surface-card p-4 border-round shadow-2">
      <div class="text-3xl text-900 font-medium mb-3">Endpoint Not Found</div>
      <div class="text-500 mb-5">The endpoint could not be found. It may have been deleted.</div>
    </div>
    <div v-else>
      <div class="surface-card p-4 border-round shadow-2 mb-3">
        <div class="flex align-items-center justify-content-between">
          <div>
            <div class="text-3xl text-900 font-medium">{{ endpoint.metadata.name }}</div>
            <div class="text-500">Namespace: {{ endpoint.metadata.namespace }}</div>
          </div>
          <div>
            <div class="text-sm">Created: {{ formatDate(endpoint.metadata.creationTimestamp) }}</div>
          </div>
        </div>
      </div>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid">
            <div class="col-12 lg:col-6">
              <Card>
                <template #title>Endpoint Details</template>
                <template #content>
                  <DataTable :value="endpointDetails" :rowHover="true" v-if="endpointDetails.length > 0">
                    <Column field="key" header="Property"></Column>
                    <Column field="value" header="Value"></Column>
                  </DataTable>
                  <div v-else class="p-3 text-center text-500">No endpoint details available</div>
                </template>
              </Card>
            </div>
            
            <div class="col-12">
              <Card>
                <template #title>Subsets</template>
                <template #content>
                  <div v-if="endpoint.subsets && endpoint.subsets.length > 0">
                    <Accordion :multiple="true">
                      <AccordionTab v-for="(subset, i) in endpoint.subsets" :key="i" :header="`Subset ${i + 1}`">
                        <h3>Addresses</h3>
                        <DataTable :value="subset.addresses || []" :rowHover="true" v-if="subset.addresses && subset.addresses.length > 0">
                          <Column field="ip" header="IP"></Column>
                          <Column field="hostname" header="Hostname"></Column>
                          <Column field="nodeName" header="Node"></Column>
                          <Column header="Target Reference">
                            <template #body="slotProps">
                              <div v-if="slotProps.data.targetRef">
                                {{ slotProps.data.targetRef.kind }}: {{ slotProps.data.targetRef.name }}
                              </div>
                              <div v-else>-</div>
                            </template>
                          </Column>
                        </DataTable>
                        <div v-else class="p-3 text-center text-500">No addresses available</div>

                        <h3 class="mt-4">Not Ready Addresses</h3>
                        <DataTable :value="subset.notReadyAddresses || []" :rowHover="true" v-if="subset.notReadyAddresses && subset.notReadyAddresses.length > 0">
                          <Column field="ip" header="IP"></Column>
                          <Column field="hostname" header="Hostname"></Column>
                          <Column field="nodeName" header="Node"></Column>
                          <Column header="Target Reference">
                            <template #body="slotProps">
                              <div v-if="slotProps.data.targetRef">
                                {{ slotProps.data.targetRef.kind }}: {{ slotProps.data.targetRef.name }}
                              </div>
                              <div v-else>-</div>
                            </template>
                          </Column>
                        </DataTable>
                        <div v-else class="p-3 text-center text-500">No not-ready addresses available</div>

                        <h3 class="mt-4">Ports</h3>
                        <DataTable :value="subset.ports || []" :rowHover="true" v-if="subset.ports && subset.ports.length > 0">
                          <Column field="name" header="Name"></Column>
                          <Column field="port" header="Port"></Column>
                          <Column field="protocol" header="Protocol"></Column>
                        </DataTable>
                        <div v-else class="p-3 text-center text-500">No ports available</div>
                      </AccordionTab>
                    </Accordion>
                  </div>
                  <div v-else class="p-3 text-center text-500">No subsets available</div>
                </template>
              </Card>
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="YAML">
          <Card>
            <template #content>
              <pre class="yaml-content">{{ endpointYaml }}</pre>
            </template>
          </Card>
        </TabPanel>
        
        <TabPanel header="Events">
          <Card>
            <template #title>Events</template>
            <template #content>
              <div v-if="loading" class="flex justify-content-center">
                <ProgressSpinner />
              </div>
              <DataTable :value="events" :rowHover="true" v-else-if="events && events.length > 0" class="p-datatable-sm" stripedRows>
                <Column field="type" header="Type" :style="{ width: '100px' }">
                  <template #body="slotProps">
                    <Tag :severity="getEventSeverity(slotProps.data.type)" :value="slotProps.data.type" />
                  </template>
                </Column>
                <Column field="reason" header="Reason" :style="{ width: '150px' }"></Column>
                <Column field="message" header="Message"></Column>
                <Column field="count" header="Count" :style="{ width: '80px' }"></Column>
                <Column field="lastTimestamp" header="Last Seen" :style="{ width: '200px' }">
                  <template #body="slotProps">
                    {{ formatDate(slotProps.data.lastTimestamp) }}
                  </template>
                </Column>
              </DataTable>
              <div v-else class="p-3 text-center text-500">No events found</div>
            </template>
          </Card>
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import yaml from 'js-yaml';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

// Component props
const props = defineProps({
  namespace: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  }
});

// Reactive state
const route = useRoute();
const endpoint = ref(null);
const loading = ref(true);
const error = ref(null);
const events = ref([]);
const loadingEvents = ref(true);

// Fetch the endpoint data
const fetchEndpoint = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get(`/api/v1/namespaces/${props.namespace}/endpoints/${props.name}`);
    endpoint.value = response.data;
  } catch (err) {
    console.error('Error fetching endpoint details:', err);
    error.value = err.response?.data?.error || 'Failed to load endpoint details';
  } finally {
    loading.value = false;
  }
  
  fetchEvents();
};

// Fetch related events
const fetchEvents = async () => {
  loadingEvents.value = true;
  
  try {
    const fieldSelector = `involvedObject.name=${props.name},involvedObject.kind=Endpoints`;
    const response = await axios.get(`/api/v1/namespaces/${props.namespace}/events?fieldSelector=${fieldSelector}`);
    events.value = response.data.items || [];
  } catch (err) {
    console.error('Error fetching events:', err);
  } finally {
    loadingEvents.value = false;
  }
};

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

// Event severity based on type
const getEventSeverity = (type) => {
  switch (type) {
    case 'Warning':
      return 'warning';
    case 'Normal':
      return 'success';
    default:
      return 'info';
  }
};

// Computed properties
const endpointDetails = computed(() => {
  if (!endpoint.value) return [];

  const metadata = endpoint.value.metadata;
  const details = [
    { key: 'Name', value: metadata.name },
    { key: 'Namespace', value: metadata.namespace },
    { key: 'UID', value: metadata.uid },
    { key: 'Creation Time', value: formatDate(metadata.creationTimestamp) },
    { key: 'Resource Version', value: metadata.resourceVersion },
  ];

  // Add labels if they exist
  if (metadata.labels) {
    const labelEntries = Object.entries(metadata.labels);
    if (labelEntries.length > 0) {
      details.push({ 
        key: 'Labels', 
        value: labelEntries.map(([k, v]) => `${k}: ${v}`).join(', ') 
      });
    }
  }

  // Add annotations if they exist
  if (metadata.annotations) {
    const annotationEntries = Object.entries(metadata.annotations);
    if (annotationEntries.length > 0) {
      details.push({ 
        key: 'Annotations', 
        value: annotationEntries.map(([k, v]) => `${k}: ${v}`).join(', ') 
      });
    }
  }
  
  return details;
});

// YAML representation of the endpoint
const endpointYaml = computed(() => {
  if (!endpoint.value) return '';
  try {
    return yaml.dump(endpoint.value);
  } catch (e) {
    console.error('Error converting endpoint to YAML:', e);
    return 'Error converting endpoint to YAML format';
  }
});

// Load data when component is mounted
onMounted(() => {
  fetchEndpoint();
});
</script>

<style scoped>
.yaml-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9rem;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  overflow: auto;
}
</style> 