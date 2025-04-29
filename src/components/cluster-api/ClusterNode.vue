<template>
  <div 
    class="cluster-node" 
    :class="{ 'management-cluster': isManagement, 'workload-cluster': !isManagement }"
   >
    <Card class="node-card">
      <template #header>
        <div class="node-header">
          <h3 class="node-title">{{ node.name }}</h3>
          <div class="node-provider-icon">
            <i :class="getProviderIcon(providerName)"></i>
          </div>
        </div>
      </template>
      
      <template #content>
        <div class="node-content">
          <div class="node-namespace" v-if="node.namespace">
            <small>{{ node.namespace }}</small>
          </div>
          
          <div v-if="!isManagement" class="node-phase">
            <StatusBadge :status="node.status || node.phase || 'Unknown'" />
          </div>
          
          <div v-if="version" class="node-version">
            <small>{{ version }}</small>
          </div>
        </div>
      </template>
      
      <template #footer>
        <div class="node-footer">
          <span class="node-type">
            {{ isManagement ? 'Management Cluster' : 'Workload Cluster' }}
          </span>
          
          <div v-if="!isManagement" class="node-actions">
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
import { computed, onMounted } from 'vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

// Debug log on mount
onMounted(() => {
  console.log('ClusterNode original mounted with node data:', props.node);
});

// Compute properties from node data
const isManagement = computed(() => {
  return props.node.isManagement || props.node.kind === 'Management';
});

const providerName = computed(() => {
  // Use optional chaining for safety
  return props.node?.infrastructureProvider || props.node?.metadata?.provider || 'Unknown';
});

const version = computed(() => {
  return props.node?.metadata?.version ? `K8s ${props.node.metadata.version}` : null;
});

const getProviderIcon = (provider) => {
  if (!provider) return 'pi pi-cloud';
  const providerStr = provider.toString().toLowerCase();
  if (providerStr.includes('azure')) return 'pi pi-microsoft';
  if (providerStr.includes('docker')) return 'pi pi-server';
  if (providerStr.includes('gcp')) return 'pi pi-google';
  if (providerStr.includes('aws')) return 'pi pi-amazon';
  if (providerStr.includes('vsphere')) return 'pi pi-desktop';
  if (providerStr.includes('openstack')) return 'pi pi-cloud-upload';
  return 'pi pi-cloud';
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.p-card-body) {
    padding: 0.75rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}
:deep(.p-card-content) {
    padding: 0 0 0.5rem 0;
    flex-grow: 1;
}
:deep(.p-card-footer) {
    padding: 0.5rem 0 0 0;
}

.node-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 0.5rem;
}

.node-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.node-provider-icon {
  font-size: 1.2rem;
  color: var(--text-color-secondary);
}

.node-content {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex-grow: 1;
}

.node-namespace {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.node-version {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.node-phase {
    margin-top: auto;
}

.node-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  border-top: 1px solid var(--surface-border);
  padding-top: 0.5rem;
}

.node-type {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

.management-cluster .node-card {
  border-color: var(--primary-color);
  border-width: 2px;
}

/* Remove .workload-cluster cursor style, as click is handled on foreignObject now */
/* .workload-cluster { cursor: pointer; } */

</style> 