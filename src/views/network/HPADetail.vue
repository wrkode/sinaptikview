<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading HorizontalPodAutoscaler details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading HorizontalPodAutoscaler details: {{ error }}</Message>
    </div>
    <div v-else-if="hpa">
      <h2 class="text-2xl font-bold mb-1">HorizontalPodAutoscaler: {{ hpaName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ hpa.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(hpa.metadata?.creationTimestamp) }} ago ({{ new Date(hpa.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="hpa.metadata?.labels && Object.keys(hpa.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in hpa.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in hpa.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Target">
                <p v-if="hpa.spec?.scaleTargetRef">
                  <strong>Kind:</strong> {{ hpa.spec.scaleTargetRef.kind || '-' }}<br>
                  <strong>Name:</strong> {{ hpa.spec.scaleTargetRef.name || '-' }}<br>
                  <strong>API Version:</strong> {{ hpa.spec.scaleTargetRef.apiVersion || '-' }}
                </p>
                <div v-else class="text-color-secondary">No target reference specified</div>
              </Panel>
              
              <Panel header="Scale Limits" class="mt-4">
                <p><strong>Min Replicas:</strong> {{ hpa.spec?.minReplicas || 1 }}</p>
                <p><strong>Max Replicas:</strong> {{ hpa.spec?.maxReplicas || '-' }}</p>
              </Panel>
            </div>
          </div>
          
          <div class="mt-4">
            <Panel header="Metrics">
              <div v-if="hasMetrics">
                <!-- v2 API Metrics -->
                <div v-if="hpa.spec?.metrics && hpa.spec.metrics.length > 0">
                  <DataTable :value="hpa.spec.metrics" tableStyle="min-width: 50rem">
                    <Column header="Type">
                      <template #body="slotProps">
                        <Tag :severity="getMetricSeverity(slotProps.data.type)">{{ slotProps.data.type }}</Tag>
                      </template>
                    </Column>
                    <Column header="Details">
                      <template #body="slotProps">
                        <!-- Resource Metric -->
                        <div v-if="slotProps.data.type === 'Resource' && slotProps.data.resource">
                          <p><strong>Resource:</strong> {{ slotProps.data.resource.name }}</p>
                          <div v-if="slotProps.data.resource.target">
                            <p><strong>Target Type:</strong> {{ slotProps.data.resource.target.type }}</p>
                            <p v-if="slotProps.data.resource.target.averageUtilization">
                              <strong>Average Utilization:</strong> {{ slotProps.data.resource.target.averageUtilization }}%
                            </p>
                            <p v-if="slotProps.data.resource.target.averageValue">
                              <strong>Average Value:</strong> {{ slotProps.data.resource.target.averageValue }}
                            </p>
                            <p v-if="slotProps.data.resource.target.value">
                              <strong>Value:</strong> {{ slotProps.data.resource.target.value }}
                            </p>
                          </div>
                        </div>
                        
                        <!-- Pods Metric -->
                        <div v-else-if="slotProps.data.type === 'Pods' && slotProps.data.pods">
                          <p><strong>Metric Name:</strong> {{ slotProps.data.pods.metric.name }}</p>
                          <div v-if="slotProps.data.pods.target">
                            <p><strong>Target Type:</strong> {{ slotProps.data.pods.target.type }}</p>
                            <p v-if="slotProps.data.pods.target.averageValue">
                              <strong>Average Value:</strong> {{ slotProps.data.pods.target.averageValue }}
                            </p>
                          </div>
                        </div>
                        
                        <!-- Object Metric -->
                        <div v-else-if="slotProps.data.type === 'Object' && slotProps.data.object">
                          <p><strong>Metric Name:</strong> {{ slotProps.data.object.metric.name }}</p>
                          <p v-if="slotProps.data.object.describedObject">
                            <strong>Target:</strong> 
                            {{ slotProps.data.object.describedObject.kind }}/{{ slotProps.data.object.describedObject.name }}
                          </p>
                          <div v-if="slotProps.data.object.target">
                            <p><strong>Target Type:</strong> {{ slotProps.data.object.target.type }}</p>
                            <p v-if="slotProps.data.object.target.value">
                              <strong>Value:</strong> {{ slotProps.data.object.target.value }}
                            </p>
                            <p v-if="slotProps.data.object.target.averageValue">
                              <strong>Average Value:</strong> {{ slotProps.data.object.target.averageValue }}
                            </p>
                          </div>
                        </div>
                        
                        <!-- External Metric -->
                        <div v-else-if="slotProps.data.type === 'External' && slotProps.data.external">
                          <p><strong>Metric Name:</strong> {{ slotProps.data.external.metric.name }}</p>
                          <div v-if="slotProps.data.external.target">
                            <p><strong>Target Type:</strong> {{ slotProps.data.external.target.type }}</p>
                            <p v-if="slotProps.data.external.target.value">
                              <strong>Value:</strong> {{ slotProps.data.external.target.value }}
                            </p>
                            <p v-if="slotProps.data.external.target.averageValue">
                              <strong>Average Value:</strong> {{ slotProps.data.external.target.averageValue }}
                            </p>
                          </div>
                        </div>
                        
                        <div v-else>Unknown metric type</div>
                      </template>
                    </Column>
                  </DataTable>
                </div>
                
                <!-- v1 API CPU Target (for backward compatibility) -->
                <div v-if="hpa.spec?.targetCPUUtilizationPercentage !== undefined" class="mt-3">
                  <DataTable :value="[{ type: 'CPU', value: hpa.spec.targetCPUUtilizationPercentage }]" tableStyle="min-width: 50rem">
                    <Column header="Type">
                      <template #body>
                        <Tag severity="info">Resource</Tag>
                      </template>
                    </Column>
                    <Column header="Details">
                      <template #body="slotProps">
                        <p><strong>Resource:</strong> CPU</p>
                        <p><strong>Target Type:</strong> Utilization</p>
                        <p><strong>Average Utilization:</strong> {{ slotProps.data.value }}%</p>
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </div>
              <div v-else class="text-color-secondary p-3">No metrics configured</div>
            </Panel>
          </div>
          
          <div class="mt-4">
            <Panel header="Status">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Last Scale Time:</strong> {{ hpa.status?.lastScaleTime ? new Date(hpa.status.lastScaleTime).toLocaleString() : 'Never' }}</p>
                  <p><strong>Current Replicas:</strong> {{ hpa.status?.currentReplicas || 0 }}</p>
                  <p><strong>Desired Replicas:</strong> {{ hpa.status?.desiredReplicas || 0 }}</p>
                </div>
                <div>
                  <p v-if="hpa.status?.currentMetrics && hpa.status.currentMetrics.length > 0">
                    <strong>Current Metrics:</strong>
                  </p>
                  <ul v-if="hpa.status?.currentMetrics && hpa.status.currentMetrics.length > 0" class="list-disc pl-4">
                    <li v-for="(metric, index) in hpa.status.currentMetrics" :key="index">
                      {{ getMetricDescription(metric) }}
                    </li>
                  </ul>
                  <p v-if="hpa.status?.currentCPUUtilizationPercentage !== undefined">
                    <strong>Current CPU Utilization:</strong> {{ hpa.status.currentCPUUtilizationPercentage }}%
                  </p>
                </div>
              </div>
              
              <div v-if="hpa.status?.conditions && hpa.status.conditions.length > 0" class="mt-4">
                <h3 class="text-lg font-medium mb-2">Conditions</h3>
                <DataTable :value="hpa.status.conditions" tableStyle="min-width: 50rem">
                  <Column field="type" header="Type"></Column>
                  <Column field="status" header="Status"></Column>
                  <Column field="reason" header="Reason"></Column>
                  <Column field="message" header="Message"></Column>
                  <Column field="lastTransitionTime" header="Last Transition">
                    <template #body="slotProps">
                      {{ new Date(slotProps.data.lastTransitionTime).toLocaleString() }}
                    </template>
                  </Column>
                </DataTable>
              </div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this HorizontalPodAutoscaler.</template>
            <Column field="lastTimestamp" header="Time">
              <template #body="slotProps">
                {{ getAge(slotProps.data.lastTimestamp) }} ago
              </template>
            </Column>
            <Column field="type" header="Type"></Column>
            <Column field="reason" header="Reason"></Column>
            <Column field="message" header="Message"></Column>
          </DataTable>
        </TabPanel>

        <TabPanel header="YAML">
          <pre class="mt-4">{{ hpaYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      HorizontalPodAutoscaler not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml';
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
const hpaName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const hpa = ref(null);
const events = ref([]);
const hpaYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => hpa.value?.metadata?.annotations ? Object.keys(hpa.value.metadata.annotations).length : 0);

// Check if hpa has metrics configured
const hasMetrics = computed(() => {
  return (hpa.value?.spec?.metrics && hpa.value.spec.metrics.length > 0) || 
         hpa.value?.spec?.targetCPUUtilizationPercentage !== undefined;
});

// Get the metric severity based on type
const getMetricSeverity = (type) => {
  switch (type) {
    case 'Resource':
      return 'info';
    case 'Pods':
      return 'success';
    case 'Object':
      return 'warning';
    case 'External':
      return 'danger';
    default:
      return 'secondary';
  }
};

// Format metric description for display
const getMetricDescription = (metric) => {
  if (metric.type === 'Resource' && metric.resource) {
    if (metric.resource.current) {
      if (metric.resource.current.averageUtilization) {
        return `${metric.resource.name}: ${metric.resource.current.averageUtilization}% utilization`;
      } else if (metric.resource.current.averageValue) {
        return `${metric.resource.name}: ${metric.resource.current.averageValue} average`;
      } else if (metric.resource.current.value) {
        return `${metric.resource.name}: ${metric.resource.current.value}`;
      }
    }
    return `${metric.resource.name}`;
  } else if (metric.type === 'Pods' && metric.pods) {
    return `Pods: ${metric.pods.metric.name}`;
  } else if (metric.type === 'Object' && metric.object) {
    return `Object: ${metric.object.metric.name}`;
  } else if (metric.type === 'External' && metric.external) {
    return `External: ${metric.external.metric.name}`;
  }
  return metric.type;
};

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

// Fetch HPA Details
const fetchHPADetails = async () => {
  if (!hpaName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/horizontalpodautoscalers/${encodeURIComponent(hpaName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `HorizontalPodAutoscaler '${hpaName.value}' in namespace '${namespace.value}' not found.`;
           hpa.value = null;
       } else {
           const errorData = await response.text();
           console.error("HPA detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        hpa.value = data; 
        hpaYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents();
    }
  } catch (err) {
    console.error("Error fetching HPA details:", err);
    error.value = err.message;
    hpa.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch HPA Events
const fetchEvents = async () => {
    if (!hpa.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const hpaUID = hpa.value.metadata.uid;
    const eventNamespace = hpa.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<hpaUID>,involvedObject.namespace=<eventNamespace>
    const fieldSelector = `involvedObject.uid=${hpaUID},involvedObject.namespace=${eventNamespace}`;

    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(eventNamespace)}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        events.value = data.items || [];
        // Sort events by last timestamp descending
        events.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching HPA events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchHPADetails();
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