<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading Network Policy details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading Network Policy details: {{ error }}</Message>
    </div>
    <div v-else-if="policy">
      <h2 class="text-2xl font-bold mb-1">Network Policy: {{ policyName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ policy.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(policy.metadata?.creationTimestamp) }} ago ({{ new Date(policy.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="policy.metadata?.labels && Object.keys(policy.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in policy.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in policy.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Policy Specification">
                <div class="mb-3">
                  <strong>Policy Types:</strong>
                  <div v-if="policy.spec?.policyTypes && policy.spec.policyTypes.length" class="mt-1">
                    <Tag v-for="(type, index) in policy.spec.policyTypes" :key="index" class="mr-2 mb-2" :severity="getPolicyTypeSeverity(type)">{{ type }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                
                <div class="mb-3">
                  <strong>Pod Selector:</strong>
                  <div v-if="policy.spec?.podSelector" class="mt-1">
                    <div v-if="hasMatchLabels(policy.spec.podSelector)">
                      <div v-for="(value, key) in policy.spec.podSelector.matchLabels" :key="key" class="mb-1">
                        <Tag severity="info">{{ key }}={{ value }}</Tag>
                      </div>
                    </div>
                    <div v-else-if="hasMatchExpressions(policy.spec.podSelector)">
                      <div v-for="(expr, index) in policy.spec.podSelector.matchExpressions" :key="index" class="mb-1">
                        <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                      </div>
                    </div>
                    <div v-else>
                      <Tag severity="success">All Pods</Tag>
                    </div>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
          </div>
          
          <div class="mt-4" v-if="policy.spec?.ingress && policy.spec.ingress.length">
            <Panel header="Ingress Rules">
              <Accordion :multiple="true">
                <AccordionTab 
                  v-for="(rule, index) in policy.spec.ingress" 
                  :key="'ingress-'+index" 
                  :header="`Ingress Rule ${index + 1}`">
                  
                  <h3 class="font-medium text-lg mb-2">From:</h3>
                  <div v-if="rule.from && rule.from.length" class="mb-4">
                    <div v-for="(from, fromIndex) in rule.from" :key="'from-'+fromIndex" class="mb-2 pl-3 border-left-2 border-info">
                      <div v-if="from.ipBlock" class="mb-2">
                        <h4 class="font-medium">IP Block</h4>
                        <p><strong>CIDR:</strong> {{ from.ipBlock.cidr }}</p>
                        <div v-if="from.ipBlock.except && from.ipBlock.except.length">
                          <p><strong>Except:</strong></p>
                          <ul class="list-disc pl-4">
                            <li v-for="(except, exIndex) in from.ipBlock.except" :key="'except-'+exIndex">
                              {{ except }}
                            </li>
                          </ul>
                        </div>
                      </div>
                      
                      <div v-if="from.namespaceSelector" class="mb-2">
                        <h4 class="font-medium">Namespace Selector</h4>
                        <div v-if="hasMatchLabels(from.namespaceSelector)">
                          <div v-for="(value, key) in from.namespaceSelector.matchLabels" :key="key" class="mb-1">
                            <Tag severity="info">{{ key }}={{ value }}</Tag>
                          </div>
                        </div>
                        <div v-else-if="hasMatchExpressions(from.namespaceSelector)">
                          <div v-for="(expr, index) in from.namespaceSelector.matchExpressions" :key="index" class="mb-1">
                            <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                          </div>
                        </div>
                        <div v-else>
                          <Tag severity="success">All Namespaces</Tag>
                        </div>
                      </div>
                      
                      <div v-if="from.podSelector" class="mb-2">
                        <h4 class="font-medium">Pod Selector</h4>
                        <div v-if="hasMatchLabels(from.podSelector)">
                          <div v-for="(value, key) in from.podSelector.matchLabels" :key="key" class="mb-1">
                            <Tag severity="info">{{ key }}={{ value }}</Tag>
                          </div>
                        </div>
                        <div v-else-if="hasMatchExpressions(from.podSelector)">
                          <div v-for="(expr, index) in from.podSelector.matchExpressions" :key="index" class="mb-1">
                            <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                          </div>
                        </div>
                        <div v-else>
                          <Tag severity="success">All Pods</Tag>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="mb-4 text-color-secondary">
                    No source restrictions (allow from all)
                  </div>
                  
                  <h3 class="font-medium text-lg mb-2">Ports:</h3>
                  <div v-if="rule.ports && rule.ports.length">
                    <DataTable :value="rule.ports" tableStyle="min-width: 30rem">
                      <Column field="port" header="Port">
                        <template #body="slotProps">
                          {{ slotProps.data.port }}
                        </template>
                      </Column>
                      <Column field="protocol" header="Protocol">
                        <template #body="slotProps">
                          {{ slotProps.data.protocol || 'TCP' }}
                        </template>
                      </Column>
                    </DataTable>
                  </div>
                  <div v-else class="text-color-secondary">
                    No port restrictions (allow all ports)
                  </div>
                </AccordionTab>
              </Accordion>
            </Panel>
          </div>
          
          <div class="mt-4" v-if="policy.spec?.egress && policy.spec.egress.length">
            <Panel header="Egress Rules">
              <Accordion :multiple="true">
                <AccordionTab 
                  v-for="(rule, index) in policy.spec.egress" 
                  :key="'egress-'+index" 
                  :header="`Egress Rule ${index + 1}`">
                  
                  <h3 class="font-medium text-lg mb-2">To:</h3>
                  <div v-if="rule.to && rule.to.length" class="mb-4">
                    <div v-for="(to, toIndex) in rule.to" :key="'to-'+toIndex" class="mb-2 pl-3 border-left-2 border-warning">
                      <div v-if="to.ipBlock" class="mb-2">
                        <h4 class="font-medium">IP Block</h4>
                        <p><strong>CIDR:</strong> {{ to.ipBlock.cidr }}</p>
                        <div v-if="to.ipBlock.except && to.ipBlock.except.length">
                          <p><strong>Except:</strong></p>
                          <ul class="list-disc pl-4">
                            <li v-for="(except, exIndex) in to.ipBlock.except" :key="'except-'+exIndex">
                              {{ except }}
                            </li>
                          </ul>
                        </div>
                      </div>
                      
                      <div v-if="to.namespaceSelector" class="mb-2">
                        <h4 class="font-medium">Namespace Selector</h4>
                        <div v-if="hasMatchLabels(to.namespaceSelector)">
                          <div v-for="(value, key) in to.namespaceSelector.matchLabels" :key="key" class="mb-1">
                            <Tag severity="info">{{ key }}={{ value }}</Tag>
                          </div>
                        </div>
                        <div v-else-if="hasMatchExpressions(to.namespaceSelector)">
                          <div v-for="(expr, index) in to.namespaceSelector.matchExpressions" :key="index" class="mb-1">
                            <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                          </div>
                        </div>
                        <div v-else>
                          <Tag severity="success">All Namespaces</Tag>
                        </div>
                      </div>
                      
                      <div v-if="to.podSelector" class="mb-2">
                        <h4 class="font-medium">Pod Selector</h4>
                        <div v-if="hasMatchLabels(to.podSelector)">
                          <div v-for="(value, key) in to.podSelector.matchLabels" :key="key" class="mb-1">
                            <Tag severity="info">{{ key }}={{ value }}</Tag>
                          </div>
                        </div>
                        <div v-else-if="hasMatchExpressions(to.podSelector)">
                          <div v-for="(expr, index) in to.podSelector.matchExpressions" :key="index" class="mb-1">
                            <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                          </div>
                        </div>
                        <div v-else>
                          <Tag severity="success">All Pods</Tag>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="mb-4 text-color-secondary">
                    No destination restrictions (allow to all)
                  </div>
                  
                  <h3 class="font-medium text-lg mb-2">Ports:</h3>
                  <div v-if="rule.ports && rule.ports.length">
                    <DataTable :value="rule.ports" tableStyle="min-width: 30rem">
                      <Column field="port" header="Port">
                        <template #body="slotProps">
                          {{ slotProps.data.port }}
                        </template>
                      </Column>
                      <Column field="protocol" header="Protocol">
                        <template #body="slotProps">
                          {{ slotProps.data.protocol || 'TCP' }}
                        </template>
                      </Column>
                    </DataTable>
                  </div>
                  <div v-else class="text-color-secondary">
                    No port restrictions (allow all ports)
                  </div>
                </AccordionTab>
              </Accordion>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this Network Policy.</template>
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
          <pre class="mt-4">{{ policyYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Network Policy not found.
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
const policyName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const policy = ref(null);
const events = ref([]);
const policyYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);

const annotationCount = computed(() => policy.value?.metadata?.annotations ? Object.keys(policy.value.metadata.annotations).length : 0);

// Helper functions for NetworkPolicy data
const hasMatchLabels = (selector) => {
    return selector && 
           selector.matchLabels && 
           Object.keys(selector.matchLabels).length > 0;
};

const hasMatchExpressions = (selector) => {
    return selector && 
           selector.matchExpressions && 
           selector.matchExpressions.length > 0;
};

const getPolicyTypeSeverity = (type) => {
    switch (type) {
        case 'Ingress':
            return 'info';
        case 'Egress':
            return 'warning';
        default:
            return 'secondary';
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

// Fetch Network Policy Details
const fetchPolicyDetails = async () => {
  if (!policyName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/networkpolicies/${encodeURIComponent(policyName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Network Policy '${policyName.value}' in namespace '${namespace.value}' not found.`;
           policy.value = null;
       } else {
           const errorData = await response.text();
           console.error("Network Policy detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        policy.value = data; 
        policyYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEvents();
    }
  } catch (err) {
    console.error("Error fetching Network Policy details:", err);
    error.value = err.message;
    policy.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Network Policy Events
const fetchEvents = async () => {
    if (!policy.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const policyUID = policy.value.metadata.uid;
    const eventNamespace = policy.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<policyUID>,involvedObject.namespace=<eventNamespace>
    const fieldSelector = `involvedObject.uid=${policyUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching Network Policy events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchPolicyDetails();
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