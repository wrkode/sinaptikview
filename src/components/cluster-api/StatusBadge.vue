<template>
  <Tag :severity="getSeverity(status)" :value="getLabel(status)" />
</template>

<script setup>
import Tag from 'primevue/tag';

const props = defineProps({
  status: {
    type: String,
    default: 'Unknown'
  }
});

const getSeverity = (status) => {
  const normalized = (status || '').toLowerCase();
  
  // Success states
  if (
    normalized === 'running' || 
    normalized === 'active' || 
    normalized === 'ready' || 
    normalized === 'provisioned' || 
    normalized === 'succeeded'
  ) {
    return 'success';
  }
  
  // Warning states
  if (
    normalized === 'pending' || 
    normalized === 'provisioning' || 
    normalized === 'updating' ||
    normalized === 'initializing'
  ) {
    return 'warning';
  }
  
  // Error states
  if (
    normalized === 'failed' || 
    normalized === 'error' || 
    normalized === 'terminated' ||
    normalized === 'suspended'
  ) {
    return 'danger';
  }
  
  // Default/unknown state
  return 'info';
};

const getLabel = (status) => {
  return status || 'Unknown';
};
</script>

<style scoped>
/* Custom styling if needed */
</style> 