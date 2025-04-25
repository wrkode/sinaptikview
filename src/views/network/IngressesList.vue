<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Ingresses ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingIngresses"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="ingresses" :loading="loadingIngresses" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="ingressError">Error loading Ingresses: {{ ingressError }}</div>
            <div v-else>No Ingresses found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Ingresses data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'ingress-detail', 
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
         <Column header="Hosts">
            <template #body="slotProps">
               <div v-if="getHosts(slotProps.data).length">
                  <div v-for="(host, index) in getHosts(slotProps.data)" :key="index" class="mb-1">
                     {{ host }}
                  </div>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="Paths">
            <template #body="slotProps">
               <div v-if="getPaths(slotProps.data).length">
                  <div v-for="(path, index) in getPaths(slotProps.data)" :key="index" class="mb-1">
                     {{ path }}
                  </div>
               </div>
               <div v-else>-</div>
            </template>
         </Column>
         <Column header="TLS">
            <template #body="slotProps">
               <Tag v-if="hasTLS(slotProps.data)" severity="success" value="Enabled" />
               <Tag v-else severity="info" value="Disabled" />
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

// Ingresses refs
const ingresses = ref([]);
const loadingIngresses = ref(false);
const ingressError = ref(null);

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

// Helper functions for Ingress data
const getHosts = (ingress) => {
    const hosts = [];
    if (ingress.spec && ingress.spec.rules) {
        ingress.spec.rules.forEach(rule => {
            if (rule.host) {
                hosts.push(rule.host);
            }
        });
    }
    return hosts;
};

const getPaths = (ingress) => {
    const paths = [];
    if (ingress.spec && ingress.spec.rules) {
        ingress.spec.rules.forEach(rule => {
            if (rule.http && rule.http.paths) {
                rule.http.paths.forEach(path => {
                    let pathDisplay = path.path || '/';
                    if (path.pathType) {
                        pathDisplay += ` (${path.pathType})`;
                    }
                    paths.push(pathDisplay);
                });
            }
        });
    }
    return paths;
};

const hasTLS = (ingress) => {
    return ingress.spec && ingress.spec.tls && ingress.spec.tls.length > 0;
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

// Fetch Ingresses
const fetchIngresses = async () => {
  loadingIngresses.value = true;
  ingressError.value = null;
  ingresses.value = []; 
  const ns = selectedNamespace.value; 
  const url = `/api/v1/ingresses?namespace=${ns}`; 
  console.log(`Fetching Ingresses from URL: ${url}`); 

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Ingress fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    ingresses.value = data.items || [];
  } catch (err) {
    console.error("Error fetching Ingresses:", err);
    ingressError.value = err.message;
  } finally {
    loadingIngresses.value = false;
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
        fetchIngresses(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchIngresses(); // Fetch initial Ingresses for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 