<template>
    <div class="card">
        <div v-if="loading" class="text-center p-4">Loading namespace details...</div>
        <div v-else-if="error" class="p-4">
            <Message severity="error">Error loading namespace details: {{ error }}</Message>
        </div>
        <div v-else-if="namespaceDetails">
            <h2 class="text-2xl font-bold mb-1">Namespace: {{ namespaceName }}</h2>
            <p class="text-sm text-color-secondary mb-4">Status: <Tag :severity="getStatusSeverity(namespaceDetails.status?.phase)">{{ namespaceDetails.status?.phase }}</Tag></p>

            <TabView>
                <TabPanel header="Overview">
                     <Panel header="Metadata" class="mt-4">
                        <p><strong>UID:</strong> {{ namespaceDetails.metadata?.uid }}</p>
                        <p><strong>Created:</strong> {{ getAge(namespaceDetails.metadata?.creationTimestamp) }} ago ({{ new Date(namespaceDetails.metadata?.creationTimestamp).toLocaleString() }})</p>
                        <div class="mt-3">
                            <strong>Labels:</strong>
                            <div v-if="namespaceDetails.metadata?.labels && Object.keys(namespaceDetails.metadata.labels).length" class="mt-1">
                                <Tag v-for="(value, key) in namespaceDetails.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                            </div>
                            <div v-else class="text-color-secondary">None</div>
                        </div>
                         <div class="mt-3">
                            <strong>Annotations:</strong>
                             <div v-if="annotationCount > 0" class="mt-1">
                                 <Tag v-for="(value, key) in namespaceDetails.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                            </div>
                             <div v-else class="text-color-secondary">None</div>
                        </div>
                    </Panel>
                </TabPanel>

                 <TabPanel header="Resource Quotas">
                      <DataTable :value="resourceQuotas" :loading="loadingQuotas" tableStyle="min-width: 50rem" class="mt-4">
                        <template #empty>No ResourceQuotas found in this namespace.</template>
                         <Column field="metadata.name" header="Name"></Column>
                         <Column header="Hard Limits">
                             <template #body="slotProps">
                                 <pre>{{ slotProps.data.spec?.hard }}</pre>
                             </template>
                         </Column>
                         <Column header="Used">
                              <template #body="slotProps">
                                 <pre>{{ slotProps.data.status?.used }}</pre>
                             </template>
                         </Column>
                      </DataTable>
                 </TabPanel>

                 <TabPanel header="Limit Ranges">
                     <DataTable :value="limitRanges" :loading="loadingLimits" tableStyle="min-width: 50rem" class="mt-4">
                        <template #empty>No LimitRanges found in this namespace.</template>
                         <Column field="metadata.name" header="Name"></Column>
                         <Column header="Limits">
                             <template #body="slotProps">
                                 <pre>{{ slotProps.data.spec?.limits }}</pre>
                             </template>
                         </Column>
                     </DataTable>
                 </TabPanel>

                 <TabPanel header="Events">
                     <DataTable :value="namespaceEvents" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
                        <template #empty>No events found for this namespace.</template>
                        <Column field="lastTimestamp" header="Time">
                             <template #body="slotProps">
                                {{ getAge(slotProps.data.lastTimestamp) }} ago
                             </template>
                         </Column>
                        <Column field="type" header="Type"></Column>
                        <Column field="reason" header="Reason"></Column>
                        <Column field="regarding.kind" header="Object Kind"></Column>
                        <Column field="regarding.name" header="Object Name"></Column>
                        <Column field="message" header="Message"></Column>
                    </DataTable>
                 </TabPanel>

                <TabPanel header="YAML">
                    <pre class="mt-4">{{ namespaceYaml }}</pre>
                 </TabPanel>

            </TabView>
        </div>
        <div v-else class="p-4">
            Namespace not found.
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
const namespaceName = computed(() => route.params.name);

const namespaceDetails = ref(null);
const resourceQuotas = ref([]);
const limitRanges = ref([]);
const namespaceEvents = ref([]);
const namespaceYaml = ref('');

const loading = ref(false);
const loadingQuotas = ref(false);
const loadingLimits = ref(false);
const loadingEvents = ref(false);
const error = ref(null);

const annotationCount = computed(() => namespaceDetails.value?.metadata?.annotations ? Object.keys(namespaceDetails.value.metadata.annotations).length : 0);

// ... (getStatusSeverity and getAge functions - reuse from PodDetail)
const getStatusSeverity = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'terminating':
      return 'warning';
    default:
      return 'info';
  }
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

// Fetch Namespace Details
const fetchNamespaceDetails = async () => {
  if (!namespaceName.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespaceName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Namespace '${namespaceName.value}' not found.`;
           namespaceDetails.value = null;
       } else {
           const errorData = await response.text();
           console.error("Namespace detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        namespaceDetails.value = data; 
        namespaceYaml.value = yaml.dump(data);
        // Fetch related resources
        fetchResourceQuotas();
        fetchLimitRanges();
        fetchNamespaceEvents(); 
    }
  } catch (err) {
    console.error("Error fetching namespace details:", err);
    error.value = err.message;
    namespaceDetails.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch ResourceQuotas
const fetchResourceQuotas = async () => {
    if (!namespaceName.value) return;
    loadingQuotas.value = true;
    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespaceName.value)}/resourcequotas`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        resourceQuotas.value = data.items || [];
    } catch (err) {
        console.error("Error fetching resource quotas:", err);
    } finally {
        loadingQuotas.value = false;
    }
}

// Fetch LimitRanges
const fetchLimitRanges = async () => {
     if (!namespaceName.value) return;
     loadingLimits.value = true;
    try {
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespaceName.value)}/limitranges`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        limitRanges.value = data.items || [];
    } catch (err) {
        console.error("Error fetching limit ranges:", err);
    } finally {
        loadingLimits.value = false;
    }
}

// Fetch Namespace Events (filter by namespace)
const fetchNamespaceEvents = async () => {
    if (!namespaceName.value) return;
    loadingEvents.value = true;
    namespaceEvents.value = [];
    try {
        // Use the existing event endpoint for the specific namespace
        const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespaceName.value)}/events`); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        namespaceEvents.value = data.items || [];
        namespaceEvents.value.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    } catch (err) {
        console.error("Error fetching namespace events:", err);
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchNamespaceDetails();
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