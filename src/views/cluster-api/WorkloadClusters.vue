<template>
  <div class="workload-clusters-view">
    <div class="header">
      <h1>Workload Clusters</h1>
      <div class="actions">
        <Button icon="pi pi-refresh" @click="fetchWorkloadClusters" class="p-button-outlined" />
      </div>
    </div>
    
    <div class="content">
      <DataTable 
        :value="processedClusters" 
        :loading="loading"
        :paginator="totalRecords > 10" 
        :rows="10"
        stripedRows
        filterDisplay="menu"
        :globalFilterFields="['name', 'namespace', 'phase', 'infrastructureProvider']"
        @lazy="onLazyLoad"
        @filter="onFilterChange"
      >
        <template #header>
          <div class="table-header">
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText v-model="globalFilter" placeholder="Search clusters..." />
            </span>
          </div>
        </template>
        
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <router-link 
              :to="{ name: 'cluster-api-cluster-detail', params: { namespace: data.namespace, name: data.name }}"
              class="cluster-link"
            >
              {{ data.name }}
            </router-link>
          </template>
        </Column>
        
        <Column field="namespace" header="Namespace" sortable />
        
        <Column field="phase" header="Status" sortable>
          <template #body="{ data }">
            <StatusBadge :status="data.phase" />
          </template>
        </Column>
        
        <Column field="infrastructureProvider" header="Provider" sortable>
          <template #body="{ data }">
            <div class="provider-cell">
              <i :class="getProviderIcon(data.infrastructureProvider)" class="provider-icon" />
              <span>{{ data.infrastructureProvider }}</span>
            </div>
          </template>
        </Column>
        
        <Column field="creationTimestamp" header="Created" sortable>
          <template #body="{ data }">
            {{ formatDate(data.creationTimestamp) }}
          </template>
        </Column>
        
        <Column field="actions" header="Actions">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button 
                icon="pi pi-eye" 
                class="p-button-rounded p-button-text p-button-sm"
                :to="{ name: 'cluster-api-cluster-detail', params: { namespace: data.namespace, name: data.name }}"
              />
            </div>
          </template>
        </Column>
        
        <template #empty>
          <div class="empty-message">
            <i class="pi pi-info-circle empty-icon"></i>
            <span>No workload clusters found.</span>
          </div>
        </template>
        
        <template #loading>
          <div class="loading-message">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
            <span>Loading clusters...</span>
          </div>
        </template>
      </DataTable>
    </div>
    
    <div v-if="error" class="error-container">
      <Message severity="error" :closable="false">
        <template #content>
          <p>{{ error }}</p>
          <Button label="Retry" @click="fetchWorkloadClusters" class="p-button-sm" />
        </template>
      </Message>
    </div>
  </div>
</template>

<script setup>
import StatusBadge from '@/components/cluster-api/StatusBadge.vue';
import axios from 'axios';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { onMounted, ref } from 'vue';

// Data
const clusters = ref([]);
const loading = ref(false);
const error = ref(null);
const globalFilter = ref('');
let fetchInProgress = false;

// Add pagination and lazy loading support 
const lazyParams = ref({
  first: 0,
  rows: 10,
  sortField: null,
  sortOrder: null
});

const totalRecords = ref(0);
const processedClusters = ref([]);

// Methods
const fetchWorkloadClusters = async () => {
  // Prevent concurrent fetches
  if (fetchInProgress) return;
  
  try {
    loading.value = true;
    fetchInProgress = true;
    error.value = null;
    
    const response = await axios.get('/api/cluster-api/workload-clusters');
    
    if (response.data && Array.isArray(response.data.items)) {
      // Process all clusters once
      const allClusters = response.data.items.map(cluster => ({
        name: cluster.metadata?.name || 'Unnamed',
        namespace: cluster.metadata?.namespace || 'default',
        phase: cluster.status?.phase || 'Unknown',
        infrastructureProvider: getInfrastructureProvider(cluster),
        creationTimestamp: cluster.metadata?.creationTimestamp || new Date().toISOString(),
        uid: cluster.metadata?.uid
      }));
      
      // Store the result for later filtering/sorting
      clusters.value = allClusters;
      totalRecords.value = allClusters.length;
      
      // Apply initial filtering/sorting
      applyDataTransformations();
    } else {
      clusters.value = [];
      processedClusters.value = [];
      totalRecords.value = 0;
    }
  } catch (err) {
    console.error('Error fetching workload clusters:', err);
    error.value = err.response?.data?.message || 'Failed to fetch workload clusters';
    clusters.value = [];
    processedClusters.value = [];
    totalRecords.value = 0;
  } finally {
    loading.value = false;
    fetchInProgress = false;
  }
};

// Apply sorting, filtering, and pagination
const applyDataTransformations = () => {
  let filteredData = [...clusters.value];
  
  // Apply global filter if any
  if (globalFilter.value) {
    const lowercaseFilter = globalFilter.value.toLowerCase();
    filteredData = filteredData.filter(item => {
      return item.name.toLowerCase().includes(lowercaseFilter) ||
             item.namespace.toLowerCase().includes(lowercaseFilter) ||
             item.phase.toLowerCase().includes(lowercaseFilter) ||
             item.infrastructureProvider.toLowerCase().includes(lowercaseFilter);
    });
  }
  
  // Apply sorting if any
  if (lazyParams.value.sortField) {
    filteredData.sort((a, b) => {
      const value1 = a[lazyParams.value.sortField];
      const value2 = b[lazyParams.value.sortField];
      const result = value1 < value2 ? -1 : value1 > value2 ? 1 : 0;
      return lazyParams.value.sortOrder === 1 ? result : -result;
    });
  }
  
  // Update total records for pagination
  totalRecords.value = filteredData.length;
  
  // Apply pagination
  const startIndex = lazyParams.value.first;
  const endIndex = startIndex + lazyParams.value.rows;
  processedClusters.value = filteredData.slice(startIndex, endIndex);
};

// Handle lazy loading events from the DataTable
const onLazyLoad = (event) => {
  lazyParams.value = event;
  applyDataTransformations();
};

// Handle filter changes
const onFilterChange = () => {
  lazyParams.value.first = 0; // Reset to first page when filtering
  applyDataTransformations();
};

const getInfrastructureProvider = (cluster) => {
  const infraRef = cluster.spec?.infrastructureRef;
  if (infraRef) {
    return infraRef.kind || 'Unknown';
  }
  return 'Unknown';
};

const getProviderIcon = (provider) => {
  switch (provider) {
    case 'AzureCluster':
      return 'pi pi-microsoft';
    case 'DockerCluster':
      return 'pi pi-server';
    case 'GCPCluster':
      return 'pi pi-google';
    case 'AWSCluster':
      return 'pi pi-amazon';
    default:
      return 'pi pi-cloud';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchWorkloadClusters();
  document.title = 'Workload Clusters | SinaptikView';
});
</script>

<style scoped>
.workload-clusters-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.content {
  flex: 1;
  overflow: auto;
}

.error-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cluster-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.cluster-link:hover {
  text-decoration: underline;
}

.provider-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-icon {
  font-size: 1.2rem;
  color: var(--primary-color);
}

.empty-message, .loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.empty-icon, .loading-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}
</style> 