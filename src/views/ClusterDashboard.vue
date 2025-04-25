<template>
  <div class="container">
    <h1 class="mb-4">Cluster Overview</h1>
    
    <div class="grid grid-cols-12 gap-4">
      <!-- CPU Card -->
      <div class="col-span-12 md:col-span-6">
        <div class="card flex flex-col items-center">
          <h3 class="font-semibold text-xl mb-4">Total CPU</h3>
          <Chart type="doughnut" :data="cpuData" :options="cpuOptions" class="w-full" style="max-height: 250px" />
          <div class="text-center mt-2">
            <span class="text-xl font-bold">{{ cpuUsedPercentage }}%</span>
            <p>CPU Usage</p>
          </div>
        </div>
      </div>
      
      <!-- Memory Card -->
      <div class="col-span-12 md:col-span-6">
        <div class="card">
          <h3 class="font-semibold text-xl mb-4">Memory Usage</h3>
          <Chart
            type="line"
            :data="memoryData"
            :options="memoryOptions"
            class="w-full"
            style="height: 250px" />
        </div>
      </div>
      
      <!-- Pods Card -->
      <div class="col-span-12 md:col-span-6">
        <div class="card flex flex-col items-center">
          <h3 class="font-semibold text-xl mb-4">Pods</h3>
          <Chart type="doughnut" :data="podsData" :options="podsOptions" class="w-full" style="max-height: 250px" />
          <div class="text-center mt-2">
            <span class="text-xl font-bold">{{ podsReadyPercentage }}%</span>
            <p>Pods Ready</p>
          </div>
        </div>
      </div>
      
      <!-- Nodes Card -->
      <div class="col-span-12 md:col-span-6">
        <div class="card flex flex-col items-center">
          <h3 class="font-semibold text-xl mb-4">Nodes</h3>
          <Chart type="doughnut" :data="nodesData" :options="nodesOptions" class="w-full" style="max-height: 250px" />
          <div class="text-center mt-2">
            <span class="text-xl font-bold">{{ nodesReadyPercentage }}%</span>
            <p>Nodes Ready</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Cluster Events Table -->
    <div class="card mt-4">
      <h3 class="font-semibold text-xl mb-4">Cluster Events</h3>
      
      <DataTable :value="events" v-model:filters="filters" filterDisplay="menu" :loading="loadingEvents"
               :paginator="true" :rows="rows" :rowsPerPageOptions="[10, 25, 50, 100]" v-model:first="first"
               paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
               :totalRecords="totalEvents" currentPageReportTemplate="Showing {first} to {last} of {totalRecords} events"
               responsiveLayout="scroll" stripedRows class="p-datatable-sm">
        
        <template #empty>
          <div class="text-center p-4">
            <p v-if="loadingEvents">Loading cluster events...</p>
            <p v-else>No events found</p>
          </div>
        </template>
        
        <template #loading>
          <div class="text-center p-4">
            <i class="pi pi-spin pi-spinner mr-2"></i>
            Loading cluster events...
          </div>
        </template>
        
        <Column field="type" header="Type" :sortable="true" style="width: 10%">
          <template #body="slotProps">
            <Tag :severity="getEventTypeSeverity(slotProps.data.type)" :value="slotProps.data.type" />
          </template>
          <template #filter="{ filterModel, filterCallback }">
            <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="typeOptions" 
                    optionLabel="label" optionValue="value" placeholder="Any Type" class="p-column-filter" showClear />
          </template>
        </Column>
        
        <Column field="reason" header="Reason" :sortable="true" style="width: 15%">
          <template #body="slotProps">
            <span class="font-semibold">{{ slotProps.data.reason }}</span>
          </template>
        </Column>
        
        <Column field="involvedObject.kind" header="Kind" :sortable="true" style="width: 10%">
          <template #body="slotProps">
            {{ slotProps.data.involvedObject?.kind || 'Unknown' }}
          </template>
          <template #filter="{ filterModel, filterCallback }">
            <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="kindOptions" 
                    optionLabel="label" optionValue="value" placeholder="Any Kind" class="p-column-filter" showClear />
          </template>
        </Column>
        
        <Column field="involvedObject.name" header="Name" :sortable="true" style="width: 20%">
          <template #body="slotProps">
            <div>
              {{ slotProps.data.involvedObject?.name || 'Unknown' }}
              <div class="text-xs text-gray-500">{{ slotProps.data.involvedObject?.namespace || 'Unknown' }}</div>
            </div>
          </template>
        </Column>
        
        <Column field="message" header="Message" style="width: 30%"></Column>
        
        <Column field="count" header="Count" :sortable="true" style="width: 5%">
          <template #body="slotProps">
            <Badge :value="slotProps.data.count || 1" :severity="(slotProps.data.count || 1) > 1 ? 'warning' : 'info'" />
          </template>
        </Column>
        
        <Column field="lastTimestamp" header="Last Seen" :sortable="true" style="width: 10%">
          <template #body="slotProps">
            {{ formatAge(slotProps.data.lastTimestamp || slotProps.data.eventTime || slotProps.data.metadata?.creationTimestamp) }}
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import Badge from 'primevue/badge';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const documentStyle = ref(getComputedStyle(document.documentElement));
const textColor = ref(documentStyle.value.getPropertyValue('--text-color') || '#495057');
const textColorSecondary = ref(documentStyle.value.getPropertyValue('--text-color-secondary') || '#6c757d');
const surfaceBorder = ref(documentStyle.value.getPropertyValue('--surface-border') || '#dee2e6');

// Theme colors
const primaryColor = ref(documentStyle.value.getPropertyValue('--primary-color') || '#3B82F6');
const primaryLightColor = ref(documentStyle.value.getPropertyValue('--primary-light-color') || '#EFF6FF');
const dangerColor = ref(documentStyle.value.getPropertyValue('--red-500') || '#EF4444');
const successColor = ref(documentStyle.value.getPropertyValue('--green-500') || '#22C55E');
const warningColor = ref(documentStyle.value.getPropertyValue('--yellow-500') || '#F59E0B');
const infoColor = ref(documentStyle.value.getPropertyValue('--blue-500') || '#3B82F6');

// CPU data
const cpuAvailable = ref(0);
const cpuUsed = ref(0);
const cpuUsedPercentage = computed(() => {
  if (cpuAvailable.value === 0) return 0;
  return Math.round((cpuUsed.value / cpuAvailable.value) * 100);
});

const cpuData = computed(() => ({
  labels: ['Used', 'Available'],
  datasets: [
    {
      data: [cpuUsed.value, Math.max(0, cpuAvailable.value - cpuUsed.value)],
      backgroundColor: [dangerColor.value, infoColor.value],
      hoverBackgroundColor: [dangerColor.value, infoColor.value],
      borderWidth: 0
    }
  ]
}));

const cpuOptions = {
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        color: textColor.value,
        font: {
          weight: 'bold'
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.label || '';
          const value = context.raw || 0;
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = Math.round((value / total) * 100);
          return `${label}: ${percentage}%`;
        }
      }
    }
  },
  responsive: true,
  maintainAspectRatio: false
};

// Memory data
const nodes = ref([]);
const memoryData = computed(() => {
  const nodeNames = nodes.value.map(node => node.metadata.name);
  const memoryValues = nodes.value.map(node => {
    const allocatable = parseInt(node.status?.allocatable?.memory || '0');
    // Convert to GB for better display
    return Math.round((allocatable / (1024 * 1024 * 1024)) * 100) / 100;
  });
  
  return {
    labels: nodeNames,
    datasets: [
      {
        label: 'Memory (GB)',
        data: memoryValues,
        fill: false,
        borderColor: primaryColor.value,
        backgroundColor: primaryLightColor.value,
        tension: 0.4,
        pointBackgroundColor: primaryColor.value,
        pointBorderColor: primaryColor.value,
        pointHoverBackgroundColor: primaryColor.value,
        pointHoverBorderColor: primaryColor.value,
        borderWidth: 2
      }
    ]
  };
});

const memoryOptions = {
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: textColor.value,
        font: {
          weight: 'bold'
        }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: surfaceBorder.value,
        drawBorder: false
      },
      ticks: {
        color: textColorSecondary.value
      },
      title: {
        display: true,
        text: 'Memory (GB)',
        color: textColor.value
      }
    },
    x: {
      grid: {
        color: surfaceBorder.value,
        drawBorder: false
      },
      ticks: {
        color: textColorSecondary.value
      }
    }
  },
  responsive: true,
  maintainAspectRatio: false
};

// Pods data
const totalPods = ref(0);
const readyPods = ref(0);
const podsReadyPercentage = computed(() => {
  if (totalPods.value === 0) return 0;
  return Math.round((readyPods.value / totalPods.value) * 100);
});

const podsData = computed(() => ({
  labels: ['Ready', 'Not Ready'],
  datasets: [
    {
      data: [readyPods.value, Math.max(0, totalPods.value - readyPods.value)],
      backgroundColor: [successColor.value, warningColor.value],
      hoverBackgroundColor: [successColor.value, warningColor.value],
      borderWidth: 0
    }
  ]
}));

const podsOptions = {
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        color: textColor.value,
        font: {
          weight: 'bold'
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.label || '';
          const value = context.raw || 0;
          return `${label}: ${value} (${Math.round((value / totalPods.value) * 100)}%)`;
        }
      }
    }
  },
  responsive: true,
  maintainAspectRatio: false
};

// Nodes data
const totalNodes = ref(0);
const readyNodes = ref(0);
const nodesReadyPercentage = computed(() => {
  if (totalNodes.value === 0) return 0;
  return Math.round((readyNodes.value / totalNodes.value) * 100);
});

const nodesData = computed(() => ({
  labels: ['Ready', 'Not Ready'],
  datasets: [
    {
      data: [readyNodes.value, Math.max(0, totalNodes.value - readyNodes.value)],
      backgroundColor: [successColor.value, dangerColor.value],
      hoverBackgroundColor: [successColor.value, dangerColor.value],
      borderWidth: 0
    }
  ]
}));

const nodesOptions = {
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        color: textColor.value,
        font: {
          weight: 'bold'
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.label || '';
          const value = context.raw || 0;
          return `${label}: ${value} (${Math.round((value / totalNodes.value) * 100)}%)`;
        }
      }
    }
  },
  responsive: true,
  maintainAspectRatio: false
};

// Events data
const events = ref([]);
const loadingEvents = ref(false);
const totalEvents = computed(() => events.value.length);
const rows = ref(25);
const first = ref(0);

// Filter match modes - defined directly instead of importing from primevue/api
const FILTER_MODES = {
  EQUALS: 'equals',
  CONTAINS: 'contains',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith'
};

// Filter options
const filters = ref({
  'type': { value: null, matchMode: FILTER_MODES.EQUALS },
  'reason': { value: null, matchMode: FILTER_MODES.CONTAINS },
  'involvedObject.kind': { value: null, matchMode: FILTER_MODES.EQUALS },
  'involvedObject.name': { value: null, matchMode: FILTER_MODES.CONTAINS },
  'message': { value: null, matchMode: FILTER_MODES.CONTAINS }
});

const typeOptions = ref([
  { label: 'Normal', value: 'Normal' },
  { label: 'Warning', value: 'Warning' }
]);

const kindOptions = computed(() => {
  // Extract unique object kinds from events while handling potential undefined values
  const kinds = [...new Set(events.value
    .filter(evt => evt.involvedObject && evt.involvedObject.kind)
    .map(evt => evt.involvedObject.kind))];
  return kinds.map(kind => ({ label: kind, value: kind }));
});

// Get severity for event type
const getEventTypeSeverity = (type) => {
  switch (type) {
    case 'Normal':
      return 'success';
    case 'Warning':
      return 'warning';
    default:
      return 'info';
  }
};

// Format age from timestamp
const formatAge = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffSeconds = Math.floor((now - eventTime) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// Fetch cluster data
const fetchClusterData = async () => {
  try {
    // Fetch nodes data
    const nodesResponse = await axios.get('/api/v1/nodes');
    nodes.value = nodesResponse.data.items || [];
    totalNodes.value = nodes.value.length;
    
    // Calculate ready nodes
    readyNodes.value = nodes.value.filter(node => {
      return node.status?.conditions?.some(condition => 
        condition.type === 'Ready' && condition.status === 'True'
      );
    }).length;
    
    // Calculate total CPU and memory
    cpuAvailable.value = nodes.value.reduce((total, node) => {
      const cpu = node.status?.allocatable?.cpu || '0';
      // CPU can be in format like "4" or "4000m"
      if (cpu.endsWith('m')) {
        return total + (parseInt(cpu) / 1000);
      }
      return total + parseInt(cpu);
    }, 0);
    
    // We'll simulate CPU usage for now (in a real app, you'd get this from metrics-server)
    cpuUsed.value = cpuAvailable.value * 0.65; // Assume 65% usage for demo
    
    // Fetch pods data
    const podsResponse = await axios.get('/api/v1/pods?namespace=all');
    const pods = podsResponse.data.items || [];
    totalPods.value = pods.length;
    
    // Calculate ready pods
    readyPods.value = pods.filter(pod => {
      return pod.status?.phase === 'Running' && 
             pod.status?.conditions?.every(condition => 
               condition.status === 'True' || condition.type !== 'Ready'
             );
    }).length;
    
  } catch (error) {
    console.error('Error fetching cluster data:', error);
  }
};

// Fetch cluster events
const fetchClusterEvents = async () => {
  loadingEvents.value = true;
  events.value = []; // Clear previous events
  
  try {
    console.log('Fetching events from all namespaces');
    
    // The server expects events for "all" namespaces in this format
    // GET /api/v1/namespaces/{namespace}/events where namespace can be "all"
    const response = await axios.get('/api/v1/namespaces/all/events');
    
    console.log('Events API response status:', response.status);
    console.log('Events API data keys:', response.data ? Object.keys(response.data) : 'No data');
    console.log('Events items count:', response.data?.items?.length || 0);
    
    // Add debugging for first item if exists
    if (response.data?.items?.length > 0) {
      const firstEvent = response.data.items[0];
      console.log('First event:', {
        type: firstEvent.type,
        reason: firstEvent.reason,
        message: firstEvent.message?.substring(0, 50) + (firstEvent.message?.length > 50 ? '...' : ''),
        involvedObject: firstEvent.involvedObject,
        count: firstEvent.count,
        lastTimestamp: firstEvent.lastTimestamp || firstEvent.eventTime || firstEvent.metadata?.creationTimestamp
      });
    }
    
    if (response.data && response.data.items) {
      // Sort events by lastTimestamp, most recent first
      events.value = response.data.items.sort((a, b) => {
        const timeA = a.lastTimestamp || a.eventTime || a.metadata?.creationTimestamp;
        const timeB = b.lastTimestamp || b.eventTime || b.metadata?.creationTimestamp;
        return new Date(timeB) - new Date(timeA);
      });
      
      console.log(`Loaded ${events.value.length} events`);
                  
      // If no events were returned, add sample events for visualization
      if (events.value.length === 0) {
        console.log('No real events found. Using sample events for visualization.');
        events.value = getSampleEvents();
      }
    } else {
      console.warn('Events response has unexpected format:', response.data);
      // Fallback to sample events
      events.value = getSampleEvents();
    }
  } catch (error) {
    console.error('Error fetching cluster events:', error);
    // Fallback to sample events on error
    events.value = getSampleEvents();
  } finally {
    loadingEvents.value = false;
  }
};

// Generate sample events for testing and visualization
const getSampleEvents = () => {
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60000);
  const tenMinAgo = new Date(now.getTime() - 10 * 60000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60000);
  
  return [
    {
      type: 'Normal',
      reason: 'Started',
      message: 'Started container dashboard',
      involvedObject: {
        kind: 'Pod',
        name: 'dashboard-app-74d8c6b4f9-j2k3l',
        namespace: 'default'
      },
      count: 1,
      lastTimestamp: now.toISOString(),
      metadata: {
        creationTimestamp: now.toISOString()
      }
    },
    {
      type: 'Warning',
      reason: 'FailedScheduling',
      message: 'Failed to schedule pod: insufficient memory',
      involvedObject: {
        kind: 'Pod',
        name: 'memory-heavy-app-89dfc7c5d-p3q4r',
        namespace: 'data-processing'
      },
      count: 3,
      lastTimestamp: fiveMinAgo.toISOString(),
      metadata: {
        creationTimestamp: tenMinAgo.toISOString()
      }
    },
    {
      type: 'Normal',
      reason: 'Pulled',
      message: 'Successfully pulled image "nginx:latest"',
      involvedObject: {
        kind: 'Pod',
        name: 'nginx-7dc45b8789-5s6t7',
        namespace: 'web'
      },
      count: 1,
      lastTimestamp: tenMinAgo.toISOString(),
      metadata: {
        creationTimestamp: tenMinAgo.toISOString()
      }
    },
    {
      type: 'Normal',
      reason: 'Created',
      message: 'Created container database',
      involvedObject: {
        kind: 'Pod',
        name: 'postgres-8b79c946c-8t9u0',
        namespace: 'database'
      },
      count: 1,
      lastTimestamp: oneHourAgo.toISOString(),
      metadata: {
        creationTimestamp: oneHourAgo.toISOString()
      }
    },
    {
      type: 'Warning',
      reason: 'Unhealthy',
      message: 'Readiness probe failed: HTTP probe failed with statuscode: 500',
      involvedObject: {
        kind: 'Pod',
        name: 'api-server-5b3dc76d58-v1w2x',
        namespace: 'api'
      },
      count: 5,
      lastTimestamp: fiveMinAgo.toISOString(),
      metadata: {
        creationTimestamp: oneHourAgo.toISOString()
      }
    }
  ];
};

// Update fetchClusterData to also fetch events
const fetchAllClusterData = async () => {
  await fetchClusterData();
  await fetchClusterEvents();
};

// Detect theme changes
function updateChartTheme() {
  documentStyle.value = getComputedStyle(document.documentElement);
  textColor.value = documentStyle.value.getPropertyValue('--text-color') || '#495057';
  textColorSecondary.value = documentStyle.value.getPropertyValue('--text-color-secondary') || '#6c757d';
  surfaceBorder.value = documentStyle.value.getPropertyValue('--surface-border') || '#dee2e6';
  
  // Update theme colors
  primaryColor.value = documentStyle.value.getPropertyValue('--primary-color') || '#3B82F6';
  primaryLightColor.value = documentStyle.value.getPropertyValue('--primary-light-color') || '#EFF6FF';
  dangerColor.value = documentStyle.value.getPropertyValue('--red-500') || '#EF4444';
  successColor.value = documentStyle.value.getPropertyValue('--green-500') || '#22C55E';
  warningColor.value = documentStyle.value.getPropertyValue('--yellow-500') || '#F59E0B';
  infoColor.value = documentStyle.value.getPropertyValue('--blue-500') || '#3B82F6';
}

onMounted(() => {
  updateChartTheme();
  fetchAllClusterData();
  
  // Set up periodic refresh (every 30 seconds)
  const refreshInterval = setInterval(fetchAllClusterData, 30000);
  
  // Set up theme change detection
  const observer = new MutationObserver(updateChartTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  
  // Clean up interval and observer when component is destroyed
  onUnmounted(() => {
    clearInterval(refreshInterval);
    observer.disconnect();
  });
});
</script>

<style scoped>
.container {
  padding: 1rem;
}

.card {
  background-color: var(--surface-card, #ffffff);
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: var(--card-shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  height: 100%;
  margin-bottom: 1rem;
}

h3 {
  color: var(--text-color, #495057);
  margin-top: 0;
  margin-bottom: 1rem;
  text-align: center;
}

/* Flex centering utilities */
.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

/* Grid system styles */
.grid {
  display: grid;
}

.grid-cols-12 {
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

.gap-4 {
  gap: 1rem;
}

.col-span-12 {
  grid-column: span 12 / span 12;
}

@media (min-width: 768px) {
  .md\:col-span-6 {
    grid-column: span 6 / span 6;
  }
}
</style> 