<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading Service details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading Service details: {{ error }}</Message>
    </div>
    <div v-else-if="service">
      <h2 class="text-2xl font-bold mb-1">Service: {{ serviceName }}</h2>
      <p class="text-sm text-color-secondary mb-4">Namespace: {{ namespace }}</p>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ service.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(service.metadata?.creationTimestamp) }} ago ({{ new Date(service.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="service.metadata?.labels && Object.keys(service.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in service.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in service.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Specification">
                <p><strong>Type:</strong> <Tag :value="service.spec?.type" :severity="getServiceTypeSeverity(service.spec?.type)" /></p>
                <p><strong>Cluster IP:</strong> {{ service.spec?.clusterIP || 'None' }}</p>
                <div v-if="service.spec?.externalIPs && service.spec.externalIPs.length">
                  <p><strong>External IPs:</strong> {{ service.spec.externalIPs.join(', ') }}</p>
                </div>
                <div v-if="hasLoadBalancerIP">
                  <p><strong>Load Balancer IP:</strong> {{ getLoadBalancerIP }}</p>
                </div>
                <p v-if="service.spec?.externalName"><strong>External Name:</strong> {{ service.spec.externalName }}</p>
                <p><strong>Session Affinity:</strong> {{ service.spec?.sessionAffinity || 'None' }}</p>
                
                <div class="mt-3" v-if="service.spec?.selector">
                  <strong>Selector:</strong>
                  <div class="mt-1">
                    <Tag v-for="(value, key) in service.spec.selector" :key="key" class="mr-2 mb-2" severity="warning">{{ key }}={{ value }}</Tag>
                  </div>
                </div>
                <div v-else class="mt-3">
                  <strong>Selector:</strong> <span class="text-color-secondary">None</span>
                </div>
              </Panel>
            </div>
          </div>
          
          <div class="mt-4">
            <Panel header="Ports">
              <DataTable :value="servicePorts" tableStyle="min-width: 50rem">
                <template #empty>No ports defined for this service.</template>
                <Column field="name" header="Name"></Column>
                <Column field="protocol" header="Protocol"></Column>
                <Column field="port" header="Port"></Column>
                <Column field="targetPort" header="Target Port"></Column>
                <Column field="nodePort" header="Node Port">
                  <template #body="slotProps">
                    {{ slotProps.data.nodePort || '-' }}
                  </template>
                </Column>
              </DataTable>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="Endpoints">
          <div v-if="loadingEndpoints" class="text-center p-4">Loading endpoints...</div>
          <div v-else-if="endpointError" class="p-4">
            <Message severity="error">Error loading endpoints: {{ endpointError }}</Message>
          </div>
          <div v-else-if="endpoints && hasEndpoints">
            <DataTable :value="formattedEndpoints" tableStyle="min-width: 50rem" class="mt-4">
              <Column field="address" header="Address"></Column>
              <Column field="port" header="Port"></Column>
              <Column field="nodeName" header="Node"></Column>
              <Column field="targetRef" header="Target">
                <template #body="slotProps">
                  <div v-if="slotProps.data.targetRef">
                    {{ slotProps.data.targetRef.kind }}: {{ slotProps.data.targetRef.name }}
                  </div>
                  <div v-else>-</div>
                </template>
              </Column>
            </DataTable>
          </div>
          <div v-else class="p-4">
            <Message severity="info">No endpoints found for this service.</Message>
          </div>
        </TabPanel>

        <TabPanel header="Events">
          <DataTable :value="events" :loading="loadingEvents" tableStyle="min-width: 50rem" class="mt-4">
            <template #empty>No events found for this Service.</template>
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
          <pre class="mt-4">{{ serviceYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      Service not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml'; // Import js-yaml
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
const serviceName = computed(() => route.params.name);
const namespace = computed(() => route.params.namespace);
const service = ref(null);
const endpoints = ref(null);
const events = ref([]);
const serviceYaml = ref('');
const loading = ref(false);
const error = ref(null);
const loadingEvents = ref(false);
const loadingEndpoints = ref(false);
const endpointError = ref(null);

const annotationCount = computed(() => service.value?.metadata?.annotations ? Object.keys(service.value.metadata.annotations).length : 0);

// Process service ports for DataTable
const servicePorts = computed(() => {
  if (!service.value?.spec?.ports) return [];
  return service.value.spec.ports.map(port => ({
    name: port.name || '-',
    protocol: port.protocol || 'TCP',
    port: port.port,
    targetPort: port.targetPort || port.port,
    nodePort: port.nodePort
  }));
});

// Check if service has LoadBalancer IP
const hasLoadBalancerIP = computed(() => {
  return service.value?.status?.loadBalancer?.ingress?.length > 0;
});

// Get LoadBalancer IP or hostname
const getLoadBalancerIP = computed(() => {
  if (!hasLoadBalancerIP.value) return '';
  const ingress = service.value.status.loadBalancer.ingress[0];
  return ingress.ip || ingress.hostname || '-';
});

// Check if service has endpoints
const hasEndpoints = computed(() => {
  if (!endpoints.value?.subsets || endpoints.value.subsets.length === 0) return false;
  return endpoints.value.subsets.some(subset => 
    subset.addresses && subset.addresses.length > 0 && 
    subset.ports && subset.ports.length > 0
  );
});

// Format endpoints for DataTable
const formattedEndpoints = computed(() => {
  if (!hasEndpoints.value) return [];
  
  const result = [];
  
  endpoints.value.subsets.forEach(subset => {
    if (!subset.addresses || !subset.ports) return;
    
    subset.addresses.forEach(address => {
      subset.ports.forEach(port => {
        result.push({
          address: address.ip,
          port: `${port.port}/${port.protocol || 'TCP'}`,
          nodeName: address.nodeName || '-',
          targetRef: address.targetRef
        });
      });
    });
  });
  
  return result;
});

// Get severity for service type
const getServiceTypeSeverity = (type) => {
    switch (type) {
        case 'ClusterIP':
            return 'info';
        case 'NodePort':
            return 'success';
        case 'LoadBalancer':
            return 'warning';
        case 'ExternalName':
            return 'danger';
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

// Fetch Service Details
const fetchServiceDetails = async () => {
  if (!serviceName.value || !namespace.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/services/${encodeURIComponent(serviceName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `Service '${serviceName.value}' in namespace '${namespace.value}' not found.`;
           service.value = null;
       } else {
           const errorData = await response.text();
           console.error("Service detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        service.value = data; 
        serviceYaml.value = yaml.dump(data); // Generate YAML from fetched data
        fetchEndpoints();
        fetchEvents();
    }
  } catch (err) {
    console.error("Error fetching Service details:", err);
    error.value = err.message;
    service.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch Endpoints
const fetchEndpoints = async () => {
  if (!serviceName.value || !namespace.value) return;
  loadingEndpoints.value = true;
  endpointError.value = null;
  try {
    const response = await fetch(`/api/v1/namespaces/${encodeURIComponent(namespace.value)}/endpoints/${encodeURIComponent(serviceName.value)}`);
    if (!response.ok) {
      if (response.status !== 404) { // 404 just means no endpoints, not an error
        const errorData = await response.text();
        console.error("Endpoints fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } else {
      const data = await response.json();
      endpoints.value = data;
    }
  } catch (err) {
    console.error("Error fetching Endpoints:", err);
    endpointError.value = err.message;
  } finally {
    loadingEndpoints.value = false;
  }
};

// Fetch Service Events
const fetchEvents = async () => {
    if (!service.value?.metadata?.uid) return; // Need UID to filter events
    loadingEvents.value = true;
    events.value = [];
    const serviceUID = service.value.metadata.uid;
    const eventNamespace = service.value.metadata.namespace;

    // Construct field selector: involvedObject.uid=<serviceUID>,involvedObject.namespace=<eventNamespace>
    const fieldSelector = `involvedObject.uid=${serviceUID},involvedObject.namespace=${eventNamespace}`;

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
        console.error("Error fetching Service events:", err);
        // Don't set main error, just log it for events
    } finally {
        loadingEvents.value = false;
    }
}

onMounted(() => {
  fetchServiceDetails();
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