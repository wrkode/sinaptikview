<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading Ingress details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading Ingress details: {{ error }}</Message>
    </div>
    <div v-else-if="ingress">
      <h2 class="text-2xl font-bold mb-1">Ingress: {{ ingressName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ ingress.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(ingress.metadata?.creationTimestamp) }} ago ({{ new Date(ingress.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="ingress.metadata?.labels && Object.keys(ingress.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in ingress.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in ingress.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Specification">
                <p v-if="ingressClass"><strong>Ingress Class:</strong> {{ ingressClass }}</p>
                <div class="mt-3" v-if="hasTLS">
                  <strong>TLS:</strong>
                  <div class="mt-1">
                    <Tag severity="success" value="Enabled" class="mr-2"></Tag>
                  </div>
                  <div v-for="(tls, index) in ingress.spec.tls" :key="'tls-'+index" class="mt-2 pl-3 border-left-2 border-primary">
                    <p v-if="tls.secretName"><strong>Secret:</strong> {{ tls.secretName }}</p>
                    <div v-if="tls.hosts && tls.hosts.length">
                      <strong>Hosts:</strong>
                      <ul class="list-disc pl-4 mt-1">
                        <li v-for="(host, hIndex) in tls.hosts" :key="'tlshost-'+hIndex">{{ host }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div v-else class="mt-3">
                  <strong>TLS:</strong> <span class="text-color-secondary">Disabled</span>
                </div>
              </Panel>
            </div>
          </div>
          
          <div class="mt-4">
            <Panel header="Rules">
              <div v-if="ingress.spec?.rules && ingress.spec.rules.length">
                <Accordion :multiple="true">
                  <AccordionTab v-for="(rule, ruleIndex) in ingress.spec.rules" :key="'rule-'+ruleIndex" 
                    :header="rule.host || 'Default Host'">
                    <div v-if="rule.http && rule.http.paths && rule.http.paths.length">
                      <DataTable :value="rule.http.paths" tableStyle="min-width: 50rem">
                        <Column field="path" header="Path">
                          <template #body="slotProps">
                            {{ slotProps.data.path || '/' }} 
                            <Tag v-if="slotProps.data.pathType" class="ml-2" severity="info">{{ slotProps.data.pathType }}</Tag>
                          </template>
                        </Column>
                        <Column header="Backend">
                          <template #body="slotProps">
                            <div v-if="slotProps.data.backend">
                              <div v-if="slotProps.data.backend.service">
                                <strong>Service:</strong> {{ slotProps.data.backend.service.name }}
                                <div class="pl-3 mt-1">
                                  <strong>Port:</strong> 
                                  {{ slotProps.data.backend.service.port.number || 
                                     slotProps.data.backend.service.port.name }}
                                </div>
                              </div>
                              <div v-else-if="slotProps.data.backend.resource">
                                <strong>Resource:</strong> 
                                {{ slotProps.data.backend.resource.kind }}/{{ slotProps.data.backend.resource.name }}
                              </div>
                              <div v-else>Default Backend</div>
                            </div>
                          </template>
                        </Column>
                      </DataTable>
                    </div>
                    <div v-else class="text-color-secondary">No paths defined</div>
                  </AccordionTab>
                </Accordion>
              </div>
              <div v-else class="text-color-secondary p-3">No rules defined</div>
            </Panel>
          </div>

          <div class="mt-4" v-if="ingress.spec?.defaultBackend">
            <Panel header="Default Backend">
              <div v-if="ingress.spec.defaultBackend.service">
                <p><strong>Service:</strong> {{ ingress.spec.defaultBackend.service.name }}</p>
                <p><strong>Port:</strong> 
                  {{ ingress.spec.defaultBackend.service.port.number || 
                     ingress.spec.defaultBackend.service.port.name }}
                </p>
              </div>
              <div v-else-if="ingress.spec.defaultBackend.resource">
                <p><strong>Resource:</strong> 
                  {{ ingress.spec.defaultBackend.resource.kind }}/{{ ingress.spec.defaultBackend.resource.name }}
                </p>
              </div>
              <div v-else class="text-color-secondary">Invalid default backend configuration</div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Status">
          <div class="mt-4" v-if="ingress.status && ingress.status.loadBalancer && ingress.status.loadBalancer.ingress">
            <Panel header="Load Balancer Status">
              <DataTable :value="ingress.status.loadBalancer.ingress" tableStyle="min-width: 50rem">
                <Column field="ip" header="IP Address"></Column>
                <Column field="hostname" header="Hostname"></Column>
                <Column field="ports" header="Ports">
                  <template #body="slotProps">
                    <div v-if="slotProps.data.ports && slotProps.data.ports.length">
                      <div v-for="(port, i) in slotProps.data.ports" :key="i">
                        {{ port.port }}/{{ port.protocol }}
                      </div>
                    </div>
                    <div v-else>-</div>
                  </template>
                </Column>
              </DataTable>
            </Panel>
          </div>
          <div v-else class="p-4">
            <Message severity="info">No load balancer status available for this ingress.</Message>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this Ingress.</template>
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
          <pre class="mt-4">{{ ingressYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Ingress not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
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
const ingressName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const ingress = ref(null);
const events = ref([]);
const ingressYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => ingress.value?.metadata?.annotations ? Object.keys(ingress.value.metadata.annotations).length : 0);

// Check if ingress has TLS configured
const hasTLS = computed(() => {
  return ingress.value?.spec?.tls && ingress.value.spec.tls.length > 0;
});

// Get the ingress class name
const ingressClass = computed(() => {
  if (ingress.value?.spec?.ingressClassName) {
    return ingress.value.spec.ingressClassName;
  }
  if (ingress.value?.metadata?.annotations && ingress.value.metadata.annotations['kubernetes.io/ingress.class']) {
    return ingress.value.metadata.annotations['kubernetes.io/ingress.class'];
  }
  return null;
});

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

// Fetch Ingress Details
const fetchIngressDetails = async () => {
  if (!ingressName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/ingresses/${encodeURIComponent(ingressName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Ingress '${ingressName.value}' in namespace '${namespace.value}' not found.`;
           ingress.value = null;
       } else {
           const errorData = await response.text();
           console.error("Ingress detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        ingress.value = data; 
        ingressYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents();
    }
  } catch (err) {
    console.error("Error fetching Ingress details:", err);
    error.value = err.message;
    ingress.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Ingress Events
const fetchEvents = async () => {
    if (!ingress.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const ingressUID = ingress.value.metadata.uid;
    const eventNamespace = ingress.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<ingressUID>,involvedObject.namespace=<eventNamespace>
    const fieldSelector = `involvedObject.uid=${ingressUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching Ingress events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchIngressDetails();
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