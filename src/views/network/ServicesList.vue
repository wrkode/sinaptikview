<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Services ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingServices"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="services" :loading="loadingServices" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="serviceError">Error loading Services: {{ serviceError }}</div>
            <div v-else>No Services found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Services data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'service-detail', 
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
         <Column v-if="selectedNamespace === 'all'" field="metadata.namespace" header="Namespace"></Column>
         <Column field="spec.type" header="Type">
            <template #body="slotProps">
               <Tag :value="slotProps.data.spec.type" :severity="getServiceTypeSeverity(slotProps.data.spec.type)" />
            </template>
         </Column>
         <Column field="spec.clusterIP" header="Cluster IP"></Column>
         <Column header="External IP">
            <template #body="slotProps">
               <div v-if="slotProps.data.spec.externalIPs && slotProps.data.spec.externalIPs.length">
                  {{ slotProps.data.spec.externalIPs.join(', ') }}
               </div>
               <div v-else-if="slotProps.data.status && slotProps.data.status.loadBalancer && slotProps.data.status.loadBalancer.ingress">
                  <span v-for="(ingress, i) in slotProps.data.status.loadBalancer.ingress" :key="i">
                     {{ ingress.ip || ingress.hostname }}{{ i < slotProps.data.status.loadBalancer.ingress.length - 1 ? ', ' : '' }}
                  </span>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="Ports">
            <template #body="slotProps">
               <div v-if="slotProps.data.spec.ports && slotProps.data.spec.ports.length">
                  <div v-for="(port, i) in slotProps.data.spec.ports" :key="i" class="mb-1">
                     {{ port.port }}{{ port.targetPort ? ':' + port.targetPort : '' }}/{{ port.protocol || 'TCP' }}
                  </div>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="Age">
             <template #body="slotProps">
                 {{ getAge(slotProps.data.metadata.creationTimestamp) }}
             </template>
         </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
// Import necessary components
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';

import { computed, onMounted, ref, watch } from 'vue';

// Services refs
const services = ref([]);
const loadingServices = ref(false);
const serviceError = ref(null);

// Namespace refs
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); // Default namespace

// Computed property for dropdown options
const namespaceOptions = computed(() => {
    const options = namespaces.value.map(ns => ({ name: ns.metadata.name, value: ns.metadata.name }));
    return [{ name: 'All Namespaces', value: 'all' }, ...options];
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

// Fetch Namespaces
const fetchNamespaces = async () => {
  loadingNamespaces.value = true;
  namespaceError.value = null;
  try {
    const response = await fetch('/api/v1/namespaces');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    namespaces.value = data.items || [];
  } catch (error) {
    console.error("Error fetching namespaces:", error);
    namespaceError.value = error.message;
  } finally {
    loadingNamespaces.value = false;
  }
};

// Fetch Services
const fetchServices = async () => {
  loadingServices.value = true;
  serviceError.value = null;
  services.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/services?namespace=${ns}`; 
  console.log(`Fetching Services from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Service fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    services.value = data.items || [];
  } catch (err) {
    console.error("Error fetching Services:", err);
    serviceError.value = err.message;
  } finally {
    loadingServices.value = false;
  }
};

// getAge helper function
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

// Watch for namespace changes
watch(selectedNamespace, (newNamespace, oldNamespace) => {
    if (newNamespace !== oldNamespace) {
        console.log(`Namespace changed to: ${newNamespace}`);
        fetchServices(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchServices(); // Fetch initial Services for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 