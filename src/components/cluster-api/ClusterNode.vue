<template>
  <div class="cluster-node" :class="{ 'management-cluster': node.isManagement }">
    <Card class="node-card">
      <template #header>
        <div class="node-header">
          <h3 class="node-title">{{ node.name }}</h3>
          <div class="node-provider-icon">
            <i :class="getProviderIcon(node.infrastructureProvider)"></i>
          </div>
        </div>
      </template>
      
      <template #content>
        <div class="node-content">
          <div class="node-namespace">
            <small>{{ node.namespace || 'default' }}</small>
          </div>
          
          <div v-if="!node.isManagement" class="node-phase">
            <StatusBadge :status="node.phase" />
          </div>
        </div>
      </template>
      
      <template #footer>
        <div class="node-footer">
          <span class="node-type">
            {{ node.isManagement ? 'Management Cluster' : 'Workload Cluster' }}
          </span>
          
          <div v-if="!node.isManagement" class="node-actions">
            <Button 
              icon="pi pi-arrow-right" 
              class="p-button-rounded p-button-sm p-button-text"
              @click="viewClusterDetails"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import Button from 'primevue/button';
import Card from 'primevue/card';
import { useRouter } from 'vue-router';
import StatusBadge from './StatusBadge.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const router = useRouter();

const getProviderIcon = (provider) => {
  if (!provider) return 'pi pi-cloud';
  
  // Use includes/startsWith for more flexible matching
  if (provider.includes('Azure') || provider.includes('azure')) {
    return 'pi pi-microsoft';
  } else if (provider.includes('Docker') || provider.includes('docker')) {
    return 'pi pi-server';
  } else if (provider.includes('GCP') || provider.includes('gcp')) {
    return 'pi pi-google';
  } else if (provider.includes('AWS') || provider.includes('aws')) {
    return 'pi pi-amazon';
  } else if (provider.includes('VSphere') || provider.includes('vsphere')) {
    return 'pi pi-desktop';
  } else if (provider.includes('OpenStack') || provider.includes('openstack')) {
    return 'pi pi-cloud-upload';
  } else {
    return 'pi pi-cloud';
  }
};

const viewClusterDetails = () => {
  if (!props.node.isManagement) {
    router.push({
      name: 'cluster-api-cluster-detail',
      params: {
        namespace: props.node.namespace || 'default',
        name: props.node.name
      }
    });
  }
};
</script>

<style scoped>
.cluster-node {
  width: 100%;
  height: 100%;
}

.node-card {
  height: 100%;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.node-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-title {
  margin: 0;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.node-provider-icon {
  font-size: 1.2rem;
  color: var(--primary-color);
}

.node-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.node-namespace {
  color: var(--text-color-secondary);
}

.node-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-type {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.management-cluster .node-card {
  border-color: var(--primary-color);
}
</style> 