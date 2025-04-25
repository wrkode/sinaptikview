<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Limit Ranges ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingLimitRanges"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="limitRanges" :loading="loadingLimitRanges" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="limitRangesError">Error loading Limit Ranges: {{ limitRangesError }}</div>
            <div v-else>No Limit Ranges found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Limit Ranges data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'limitrange-detail', 
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
         <Column header="Limits">
            <template #body="slotProps">
               <div v-if="hasLimits(slotProps.data)">
                  <Tag v-if="getLimitsCount(slotProps.data) > 3" severity="info">{{ getLimitsCount(slotProps.data) }} limits defined</Tag>
                  <div v-else>
                    <Tag v-for="(limit, index) in getTopLimits(slotProps.data)" :key="index" severity="info" class="mr-1 mb-1">
                      {{ limit.type }} {{ limit.resource }}: {{ formatLimitRange(limit) }}
                    </Tag>
                  </div>
               </div>
               <div v-else>
                  <Tag severity="secondary">No limits defined</Tag>
               </div>
            </template>
         </Column>
         <Column header="Types">
            <template #body="slotProps">
               <div v-if="hasLimits(slotProps.data)">
                  <div class="flex flex-wrap gap-1">
                    <Tag 
                      v-for="type in getLimitTypes(slotProps.data)" 
                      :key="type" 
                      :severity="getLimitTypeSeverity(type)">
                      {{ type }}
                    </Tag>
                  </div>
               </div>
               <div v-else>
                  <Tag severity="secondary">None</Tag>
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

import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';

// LimitRanges refs
const limitRanges = ref([]);
const loadingLimitRanges = ref(false);
const limitRangesError = ref(null);

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

// Helper functions for LimitRange data
const hasLimits = (limitRange) => {
    return limitRange.spec && 
           limitRange.spec.limits && 
           limitRange.spec.limits.length > 0;
};

const getLimitsCount = (limitRange) => {
    if (!hasLimits(limitRange)) return 0;
    
    let count = 0;
    for (const limit of limitRange.spec.limits) {
        if (limit.max) count += Object.keys(limit.max).length;
        if (limit.min) count += Object.keys(limit.min).length;
        if (limit.default) count += Object.keys(limit.default).length;
        if (limit.defaultRequest) count += Object.keys(limit.defaultRequest).length;
        if (limit.maxLimitRequestRatio) count += Object.keys(limit.maxLimitRequestRatio).length;
    }
    
    return count;
};

const getTopLimits = (limitRange) => {
    if (!hasLimits(limitRange)) return [];
    
    const topLimits = [];
    
    // Process first few limits for display
    for (const limit of limitRange.spec.limits) {
        const type = limit.type;
        
        if (limit.max) {
            for (const [resource, value] of Object.entries(limit.max)) {
                topLimits.push({ type, resource, value, kind: 'max' });
                if (topLimits.length >= 3) return topLimits;
            }
        }
        
        if (limit.min) {
            for (const [resource, value] of Object.entries(limit.min)) {
                topLimits.push({ type, resource, value, kind: 'min' });
                if (topLimits.length >= 3) return topLimits;
            }
        }
        
        if (limit.default) {
            for (const [resource, value] of Object.entries(limit.default)) {
                topLimits.push({ type, resource, value, kind: 'default' });
                if (topLimits.length >= 3) return topLimits;
            }
        }
    }
    
    return topLimits;
};

const formatLimitRange = (limit) => {
    return `${limit.kind}: ${limit.value}`;
};

const getLimitTypes = (limitRange) => {
    if (!hasLimits(limitRange)) return [];
    
    const types = new Set();
    for (const limit of limitRange.spec.limits) {
        if (limit.type) {
            types.add(limit.type);
        }
    }
    
    return Array.from(types);
};

const getLimitTypeSeverity = (type) => {
    // Map different limit types to different severities for visual distinction
    switch (type) {
        case 'Container':
            return 'info';
        case 'Pod':
            return 'success';
        case 'PersistentVolumeClaim':
            return 'warning';
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

// Fetch Limit Ranges
const fetchLimitRanges = async () => {
  loadingLimitRanges.value = true;
  limitRanges.value = [];
  limitRangesError.value = null;

  try {
    if (selectedNamespace.value === 'all') {
      const response = await axios.get('/api/v1/limitranges');
      limitRanges.value = response.data.items;
    } else {
      const response = await axios.get(`/api/v1/namespaces/${selectedNamespace.value}/limitranges`);
      limitRanges.value = response.data.items;
    }
  } catch (error) {
    console.error('Error fetching limitRanges:', error);
    limitRangesError.value = 'Failed to fetch limitRanges';
  } finally {
    loadingLimitRanges.value = false;
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
        fetchLimitRanges(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchLimitRanges(); // Fetch initial Limit Ranges for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 