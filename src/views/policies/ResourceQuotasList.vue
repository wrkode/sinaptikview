<template>
  <div class="card p-fluid">
    <div>
        <div class="flex justify-between items-center mb-2">
             <h2 class="text-xl font-semibold">Resource Quotas ({{ selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace }})</h2>
             <!-- Namespace Dropdown -->
             <Dropdown 
                v-model="selectedNamespace" 
                :options="namespaceOptions" 
                optionLabel="name" 
                optionValue="value" 
                placeholder="Select Namespace" 
                :disabled="loadingNamespaces || loadingQuotas"
                style="width: 200px;"
             />
        </div>
       <DataTable :value="quotas" :loading="loadingQuotas" tableStyle="min-width: 50rem">
         <template #empty> 
            <div v-if="quotaError">Error loading Resource Quotas: {{ quotaError }}</div>
            <div v-else>No Resource Quotas found in {{ selectedNamespace === 'all' ? 'all namespaces' : `namespace '${selectedNamespace}'` }}.</div> 
         </template>
         <template #loading> Loading Resource Quotas data. Please wait. </template>
         <Column field="metadata.name" header="Name">
             <template #body="slotProps">
                 <router-link 
                    :to="{ 
                        name: 'resourcequota-detail', 
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
         <Column header="Resources">
            <template #body="slotProps">
               <div v-if="hasHardLimits(slotProps.data)">
                  <Tag v-if="getResourceCount(slotProps.data) > 3" severity="info">{{ getResourceCount(slotProps.data) }} resources defined</Tag>
                  <template v-else>
                    <div v-for="(limit, resource) in getHardLimits(slotProps.data)" :key="resource" class="mb-1">
                      <Tag severity="info">{{ resource }}: {{ limit }}</Tag>
                    </div>
                  </template>
               </div>
               <div v-else>
                  <Tag severity="secondary">No limits defined</Tag>
               </div>
            </template>
         </Column>
         <Column header="Status">
            <template #body="slotProps">
               <div class="flex flex-column gap-1">
                  <div v-if="isExceeded(slotProps.data)">
                     <Tag severity="danger">Exceeded</Tag>
                  </div>
                  <div v-if="isWarning(slotProps.data)">
                     <Tag severity="warning">Warning ({{ getWarningPercent(slotProps.data) }}%)</Tag>
                  </div>
                  <div v-if="!isExceeded(slotProps.data) && !isWarning(slotProps.data)">
                     <Tag severity="success">Normal</Tag>
                  </div>
               </div>
            </template>
         </Column>
         <Column header="Usage">
            <template #body="slotProps">
              <div v-if="hasUsage(slotProps.data)" class="overflow-x-auto" style="max-width: 300px">
                <DataTable :value="getUsageRows(slotProps.data)" class="text-xs" :showGridlines="true">
                  <Column field="resource" header="Resource"></Column>
                  <Column field="used" header="Used"></Column>
                  <Column field="hard" header="Hard"></Column>
                  <Column field="percent" header="%">
                    <template #body="usageProps">
                      <ProgressBar :value="usageProps.data.percentValue" :class="getUsageClass(usageProps.data.percentValue)" style="height: 8px" />
                      {{ usageProps.data.percent }}
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div v-else>
                <Tag severity="secondary">No usage data</Tag>
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
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';

import { computed, onMounted, ref, watch } from 'vue';

// Resource Quotas refs
const quotas = ref([]);
const loadingQuotas = ref(false);
const quotaError = ref(null);

// Namespace refs
const namespaces = ref([]);
const loadingNamespaces = ref(false);
const namespaceError = ref(null);
const selectedNamespace = ref('default'); // Default namespace

// Warning threshold for resource usage
const WARNING_THRESHOLD = 75; // 75% usage is warning level

// Computed property for dropdown options
const namespaceOptions = computed(() => {
    const options = namespaces.value.map(ns => ({ name: ns.metadata.name, value: ns.metadata.name }));
    return [{ name: 'All Namespaces', value: 'all' }, ...options];
});

// Helper functions for ResourceQuota data
const hasHardLimits = (quota) => {
    return quota.spec && 
           quota.spec.hard && 
           Object.keys(quota.spec.hard).length > 0;
};

const getHardLimits = (quota) => {
    if (!hasHardLimits(quota)) return {};
    return quota.spec.hard;
};

const getResourceCount = (quota) => {
    if (!hasHardLimits(quota)) return 0;
    return Object.keys(quota.spec.hard).length;
};

const hasUsage = (quota) => {
    return quota.status && 
           quota.status.hard && 
           quota.status.used &&
           Object.keys(quota.status.used).length > 0;
};

const isExceeded = (quota) => {
    if (!hasUsage(quota)) return false;
    
    for (const resource in quota.status.hard) {
        const hard = parseResourceValue(quota.status.hard[resource]);
        const used = parseResourceValue(quota.status.used[resource] || '0');
        
        if (used > hard) {
            return true;
        }
    }
    
    return false;
};

const isWarning = (quota) => {
    if (!hasUsage(quota) || isExceeded(quota)) return false;
    
    for (const resource in quota.status.hard) {
        const hard = parseResourceValue(quota.status.hard[resource]);
        const used = parseResourceValue(quota.status.used[resource] || '0');
        
        if (hard > 0 && (used / hard) * 100 >= WARNING_THRESHOLD) {
            return true;
        }
    }
    
    return false;
};

const getWarningPercent = (quota) => {
    if (!hasUsage(quota)) return 0;
    
    let maxPercent = 0;
    
    for (const resource in quota.status.hard) {
        const hard = parseResourceValue(quota.status.hard[resource]);
        const used = parseResourceValue(quota.status.used[resource] || '0');
        
        if (hard > 0) {
            const percent = Math.round((used / hard) * 100);
            if (percent > maxPercent) {
                maxPercent = percent;
            }
        }
    }
    
    return maxPercent;
};

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

const formatResourceValue = (resource, value) => {
    // Return the original value as string
    return value;
};

const getUsageRows = (quota) => {
    if (!hasUsage(quota)) return [];
    
    const rows = [];
    
    // Process all resources from both hard and used
    const resources = new Set([
        ...Object.keys(quota.status.hard || {}),
        ...Object.keys(quota.status.used || {})
    ]);
    
    for (const resource of resources) {
        const hard = quota.status.hard[resource] || '0';
        const used = quota.status.used[resource] || '0';
        
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
            hard: formatResourceValue(resource, hard),
            used: formatResourceValue(resource, used),
            percent,
            percentValue
        });
    }
    
    return rows;
};

const getUsageClass = (percentValue) => {
    if (percentValue >= 100) {
        return 'bg-red-500';
    } else if (percentValue >= WARNING_THRESHOLD) {
        return 'bg-yellow-500';
    } else {
        return 'bg-green-500';
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

// Fetch Resource Quotas
const fetchResourceQuotas = async () => {
  loadingQuotas.value = true;
  quotaError.value = null;
  quotas.value = []; 
  const ns = selectedNamespace.value; 
  const url = '/api/v1/resourcequotas';
  const params = ns !== 'all' ? { namespace: ns } : {};
  console.log(`Fetching Resource Quotas with namespace: ${ns}`); 

  try {
    const response = await fetch(url + (ns !== 'all' ? `?namespace=${ns}` : ''));
    if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Resource Quota fetch failed response:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    quotas.value = data.items || [];
  } catch (err) {
    console.error("Error fetching Resource Quotas:", err);
    quotaError.value = err.message;
  } finally {
    loadingQuotas.value = false;
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
        fetchResourceQuotas(); 
    }
});

// Fetch initial data
onMounted(() => {
  fetchNamespaces(); 
  fetchResourceQuotas(); // Fetch initial Resource Quotas for default namespace
});
</script>

<style scoped>
/* Add specific styles if needed */
</style> 