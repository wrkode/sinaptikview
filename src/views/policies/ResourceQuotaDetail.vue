<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading Resource Quota details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading Resource Quota details: {{ error }}</Message>
    </div>
    <div v-else-if="quota">
      <h2 class="text-2xl font-bold mb-1">Resource Quota: {{ quotaName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ quota.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(quota.metadata?.creationTimestamp) }} ago ({{ new Date(quota.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="quota.metadata?.labels && Object.keys(quota.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in quota.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in quota.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Specification">
                <div class="mb-3">
                  <strong>Scope Selector:</strong>
                  <div v-if="quota.spec?.scopeSelector" class="mt-1">
                    <div v-for="(matcher, index) in quota.spec.scopeSelector.matchExpressions" :key="index" class="mb-1">
                      <Tag severity="info">{{ matcher.scopeName }}: {{ matcher.operator }} {{ JSON.stringify(matcher.values) }}</Tag>
                    </div>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                
                <div class="mb-3">
                  <strong>Scopes:</strong>
                  <div v-if="quota.spec?.scopes && quota.spec.scopes.length" class="mt-1">
                    <Tag v-for="(scope, index) in quota.spec.scopes" :key="index" class="mr-2 mb-2" severity="info">{{ scope }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
          </div>
          
          <div class="mt-4">
            <Panel header="Resource Limits & Usage">
              <div v-if="hasUsage" class="mt-2">
                <DataTable :value="usageRows" tableStyle="min-width: 50rem">
                  <Column field="resource" header="Resource"></Column>
                  <Column field="used" header="Used"></Column>
                  <Column field="hard" header="Hard Limit"></Column>
                  <Column header="Usage">
                    <template #body="slotProps">
                      <div class="flex align-items-center">
                        <ProgressBar :value="slotProps.data.percentValue" :class="getUsageClass(slotProps.data.percentValue)" style="flex: 1; height: 12px" />
                        <span class="ml-2">{{ slotProps.data.percent }}</span>
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div v-else-if="hasHardLimits" class="mt-2">
                <DataTable :value="hardLimitRows" tableStyle="min-width: 50rem">
                  <Column field="resource" header="Resource"></Column>
                  <Column field="hard" header="Hard Limit"></Column>
                </DataTable>
              </div>
              <div v-else class="p-3 text-color-secondary">No resource limits defined</div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this Resource Quota.</template>
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
          <pre class="mt-4">{{ quotaYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Resource Quota not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import ProgressBar from 'primevue/progressbar';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const quotaName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const quota = ref(null);
const events = ref([]);
const quotaYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

// Warning threshold for resource usage
const WARNING_THRESHOLD = 75; // 75% usage is warning level

const annotationCount = computed(() => quota.value?.metadata?.annotations ? Object.keys(quota.value.metadata.annotations).length : 0);

// Check if the quota has hard limits defined
const hasHardLimits = computed(() => {
  return quota.value?.spec?.hard && Object.keys(quota.value.spec.hard).length > 0;
});

// Check if the quota has usage status information
const hasUsage = computed(() => {
  return quota.value?.status?.hard && 
         quota.value?.status?.used && 
         Object.keys(quota.value.status.used).length > 0;
});

// Prepare rows for the hard limits table
const hardLimitRows = computed(() => {
  if (!hasHardLimits.value) return [];
  
  return Object.entries(quota.value.spec.hard).map(([resource, hard]) => {
    return {
      resource,
      hard
    };
  });
});

// Prepare rows for the usage table
const usageRows = computed(() => {
  if (!hasUsage.value) return [];
  
  const rows = [];
  
  // Process all resources from both hard and used
  const resources = new Set([
    ...Object.keys(quota.value.status.hard || {}),
    ...Object.keys(quota.value.status.used || {})
  ]);
  
  for (const resource of resources) {
    const hard = quota.value.status.hard[resource] || '0';
    const used = quota.value.status.used[resource] || '0';
    
    const hardValue = parseResourceValue(hard);
    const usedValue = parseResourceValue(used);
    
    let percent = '0%';
    let percentValue = 0;
    
    if (hardValue > 0) {
      percentValue = Math.min(Math.round((usedValue / hardValue) * 100), 100);
      percent = `${percentValue}%`;
    }
    
    rows.push({
      resource,
      hard,
      used,
      percent,
      percentValue
    });
  }
  
  return rows;
});

// Parse Kubernetes resource values to numbers for comparison
const parseResourceValue = (value) => {
  if (typeof value !== 'string') return Number(value) || 0;
  
  // Handle Kubernetes resource formats like 2Gi, 200m, etc.
  if (value.endsWith('m')) {
    return parseFloat(value.slice(0, -1)) / 1000;
  } else if (value.endsWith('Ki')) {
    return parseFloat(value.slice(0, -2)) * 1024;
  } else if (value.endsWith('Mi')) {
    return parseFloat(value.slice(0, -2)) * 1024 * 1024;
  } else if (value.endsWith('Gi')) {
    return parseFloat(value.slice(0, -2)) * 1024 * 1024 * 1024;
  } else if (value.endsWith('Ti')) {
    return parseFloat(value.slice(0, -2)) * 1024 * 1024 * 1024 * 1024;
  } else if (value.endsWith('Pi')) {
    return parseFloat(value.slice(0, -2)) * 1024 * 1024 * 1024 * 1024 * 1024;
  } else {
    return parseFloat(value) || 0;
  }
};

// Get CSS class for usage progress bar based on percentage
const getUsageClass = (percentValue) => {
  if (percentValue >= 100) {
    return 'bg-red-500';
  } else if (percentValue >= WARNING_THRESHOLD) {
    return 'bg-yellow-500';
  } else {
    return 'bg-green-500';
  }
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

// Fetch Resource Quota Details
const fetchQuotaDetails = async () => {
  if (!quotaName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/resourcequotas/${encodeURIComponent(quotaName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Resource Quota '${quotaName.value}' in namespace '${namespace.value}' not found.`;
           quota.value = null;
       } else {
           const errorData = await response.text();
           console.error("Resource Quota detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        quota.value = data; 
        quotaYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents();
    }
  } catch (err) {
    console.error("Error fetching Resource Quota details:", err);
    error.value = err.message;
    quota.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Resource Quota Events
const fetchEvents = async () => {
    if (!quota.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const quotaUID = quota.value.metadata.uid;
    const eventNamespace = quota.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<quotaUID>,involvedObject.namespace=<eventNamespace>
    const fieldSelector = `involvedObject.uid=${quotaUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching Resource Quota events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchQuotaDetails();
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