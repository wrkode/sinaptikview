<template>
  <Tag :severity="getSeverity" :value="status" />
</template>

<script setup>
import Tag from 'primevue/tag';
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true
  }
});

const getSeverity = computed(() => {
  const status = props.status?.toLowerCase() || 'unknown';
  
  if (status === 'running' || status === 'ready' || status === 'healthy') {
    return 'success';
  } else if (status === 'provisioning' || status === 'pending' || status === 'processing') {
    return 'info';
  } else if (status === 'deleting' || status === 'warning') {
    return 'warning';
  } else if (status === 'failed' || status === 'error') {
    return 'danger';
  } else {
    return 'secondary';
  }
});
</script>

<style scoped>
:deep(.p-tag) {
  text-transform: capitalize;
}
</style> 