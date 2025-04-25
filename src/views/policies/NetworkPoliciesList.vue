<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Network Policies ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingPolicies"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="policies" :loading="loadingPolicies" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="policyError">Error loading Network Policies: {{ policyError }}</div>
            <div v-else>No Network Policies found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Network Policies data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'networkpolicy-detail', 
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
         <Column header="Pod Selector">
            <template #body="slotProps">
               <div v-if="slotProps.data.spec && slotProps.data.spec.podSelector">
                  <div v-if="hasMatchLabels(slotProps.data.spec.podSelector)">
                     <div v-for="(value, key) in slotProps.data.spec.podSelector.matchLabels" :key="key" class="mb-1">
                        <Tag severity="info">{{ key }}={{ value }}</Tag>
                     </div>
                  </div>
                  <div v-else-if="hasMatchExpressions(slotProps.data.spec.podSelector)">
                     <div v-for="(expr, index) in slotProps.data.spec.podSelector.matchExpressions" :key="index" class="mb-1">
                        <Tag severity="warning">{{ expr.key }} {{ expr.operator }} {{ expr.values?.join(', ') || '' }}</Tag>
                     </div>
                  </div>
                  <div v-else>
                     <Tag severity="success">All Pods</Tag>
                  </div>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="Policy Types">
            <template #body="slotProps">
               <div v-if="slotProps.data.spec && slotProps.data.spec.policyTypes">
                  <div v-for="(type, index) in slotProps.data.spec.policyTypes" :key="index" class="mb-1">
                     <Tag :severity="getPolicyTypeSeverity(type)">{{ type }}</Tag>
                  </div>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="Rules">
            <template #body="slotProps">
               <div class="flex gap-2">
                  <div v-if="countIngress(slotProps.data) > 0">
                     <Tag severity="info">{{ countIngress(slotProps.data) }} ingress</Tag>
                  </div>
                  <div v-if="countEgress(slotProps.data) > 0">
                     <Tag severity="warning">{{ countEgress(slotProps.data) }} egress</Tag>
                  </div>
                  <div v-if="countIngress(slotProps.data) === 0 && countEgress(slotProps.data) === 0">
                     <Tag severity="danger">Deny All</Tag>
                  </div>
               </div>
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

// Network Policies refs
const policies = ref([]);
const loadingPolicies = ref(false);
const policyError = ref(null);

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

const countIngress = (policy) => {
    if (!policy.spec || !policy.spec.ingress) return 0;
    return policy.spec.ingress.length;
};

const countEgress = (policy) => {
    if (!policy.spec || !policy.spec.egress) return 0;
    return policy.spec.egress.length;
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

// Fetch Network Policies
const fetchNetworkPolicies = async () => {
  loadingPolicies.value = true;
  policyError.value = null;
  policies.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/networkpolicies?namespace=${ns}`; 
  console.log(`Fetching Network Policies from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Network Policy fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    policies.value = data.items || [];
  } catch (err) {
    console.error("Error fetching Network Policies:", err);
    policyError.value = err.message;
  } finally {
    loadingPolicies.value = false;
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
        fetchNetworkPolicies(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchNetworkPolicies(); // Fetch initial Network Policies for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 