<template>
  <div class="card">
    <h2 class="text-2xl font-bold mb-4">Create New Namespace</h2>
    <form @submit.prevent="createNamespace" class="p-fluid">

      <div class="field mb-4">
         <label for="namespaceName" class="font-medium block mb-2">Namespace Name</label>
         <InputText id="namespaceName" type="text" v-model.trim="namespaceName" required :invalid="!isNameValid && namespaceName.length > 0" />
         <small v-if="!isNameValid && namespaceName.length > 0" class="p-error">Name must be a valid DNS-1123 label (lowercase alphanumeric, '-', max 63 chars).</small>
         <small v-else class="block mt-1">A unique name for your namespace.</small>
      </div>

      <Panel header="Labels" toggleable collapsed class="mb-4">
        <div v-for="(label, index) in labels" :key="index" class="formgrid grid align-items-center mb-2">
           <div class="field col">
                <label :for="`labelKey-${index}`" class="font-semibold">Key</label>
                <InputText :id="`labelKey-${index}`" placeholder="e.g., environment" v-model.trim="label.key" :invalid="!isLabelKeyValid(label.key) && label.key.length > 0"/>
                <small v-if="label.key && !isLabelKeyValid(label.key)" class="p-error">Invalid key format.</small>
           </div>
            <div class="field col">
                 <label :for="`labelValue-${index}`" class="font-semibold">Value</label>
                <InputText :id="`labelValue-${index}`" placeholder="e.g., production" v-model.trim="label.value" :invalid="!isLabelValueValid(label.value) && label.value.length > 0"/>
                 <small v-if="label.value && !isLabelValueValid(label.value)" class="p-error">Invalid value format.</small>
            </div>
            <div class="col-fixed" style="width: 50px">
                <Button icon="pi pi-trash" class="p-button-danger p-button-text mt-4" @click="removeLabel(index)" v-tooltip.left="'Remove Label'" />
            </div>
        </div>
        <Button label="Add Label" icon="pi pi-plus" class="p-button-text mt-2" @click="addLabel" />
      </Panel>

      <Panel header="Resource Quotas (Optional)" toggleable collapsed class="mb-4">
         <p class="text-sm text-color-secondary mb-3">Define limits for resources within this namespace. Use Kubernetes quantity format (e.g., 500m, 1Gi).</p>
        <div class="formgrid grid">
          <div class="field col-12 md:col-6">
            <label for="requestsCpu">CPU Requests</label>
            <InputText id="requestsCpu" v-model.trim="quotas['requests.cpu']" placeholder="e.g., 1 or 500m" :invalid="quotas['requests.cpu'] && !isQuantityValid(quotas['requests.cpu'])"/>
             <small v-if="quotas['requests.cpu'] && !isQuantityValid(quotas['requests.cpu'])" class="p-error">Invalid format.</small>
          </div>
          <div class="field col-12 md:col-6">
            <label for="requestsMemory">Memory Requests</label>
            <InputText id="requestsMemory" v-model.trim="quotas['requests.memory']" placeholder="e.g., 1Gi or 512Mi" :invalid="quotas['requests.memory'] && !isQuantityValid(quotas['requests.memory'])" />
             <small v-if="quotas['requests.memory'] && !isQuantityValid(quotas['requests.memory'])" class="p-error">Invalid format.</small>
          </div>
          <div class="field col-12 md:col-6">
            <label for="limitsCpu">CPU Limits</label>
            <InputText id="limitsCpu" v-model.trim="quotas['limits.cpu']" placeholder="e.g., 2 or 1000m" :invalid="quotas['limits.cpu'] && !isQuantityValid(quotas['limits.cpu'])"/>
             <small v-if="quotas['limits.cpu'] && !isQuantityValid(quotas['limits.cpu'])" class="p-error">Invalid format.</small>
          </div>
          <div class="field col-12 md:col-6">
            <label for="limitsMemory">Memory Limits</label>
            <InputText id="limitsMemory" v-model.trim="quotas['limits.memory']" placeholder="e.g., 2Gi or 1024Mi" :invalid="quotas['limits.memory'] && !isQuantityValid(quotas['limits.memory'])" />
             <small v-if="quotas['limits.memory'] && !isQuantityValid(quotas['limits.memory'])" class="p-error">Invalid format.</small>
          </div>
           <div class="field col-12 md:col-6">
            <label for="pods">Max Pods</label>
            <InputText id="pods" v-model.trim="quotas['pods']" placeholder="e.g., 10" :invalid="quotas['pods'] && !isIntegerValid(quotas['pods'])"/>
             <small v-if="quotas['pods'] && !isIntegerValid(quotas['pods'])" class="p-error">Must be a whole number.</small>
          </div>
        </div>
      </Panel>

      <div class="flex justify-content-end gap-2 mt-5">
         <Button label="Cancel" icon="pi pi-times" class="p-button-secondary" @click="goBack" />
         <Button type="submit" label="Create" icon="pi pi-check" :loading="isLoading" :disabled="!isFormValid || isLoading" />
      </div>
    </form>
     <!-- Optional: Display API error message -->
     <div v-if="error" class="mt-4">
       <Message severity="error" :closable="false">{{ error }}</Message>
     </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import Tooltip from 'primevue/tooltip';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const vTooltip = Tooltip;

const router = useRouter();

const namespaceName = ref('');
const labels = ref([{ key: '', value: '' }]);
const quotas = ref({
  'requests.cpu': '',
  'requests.memory': '',
  'limits.cpu': '',
  'limits.memory': '',
  'pods': ''
});
const isLoading = ref(false);
const error = ref(null);

const isNameValid = computed(() => {
  if (!namespaceName.value) return false;
  const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  return regex.test(namespaceName.value) && namespaceName.value.length <= 63;
});

const isLabelKeyValid = (key) => {
  if (!key) return false;
  const regex = /^[a-zA-Z0-9]([-a-zA-Z0-9_.]*[a-zA-Z0-9])?$/;
  return regex.test(key) && key.length <= 63;
};

const isLabelValueValid = (value) => {
  if (!value) return true;
  const regex = /^[a-zA-Z0-9]([-a-zA-Z0-9_.]*[a-zA-Z0-9])?$/;
  return regex.test(value) && value.length <= 63;
};

const hasInvalidLabels = computed(() => {
    return labels.value.some(l => 
        (l.key && !isLabelKeyValid(l.key)) || 
        (l.value && !isLabelValueValid(l.value))
    );
});

const isQuantityValid = (value) => {
  if (!value) return true;
  const quantityRegex = /^(?:[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|[+-]?(?:[0-9]+)(?:[mKMGTP]i?)?)$/;
  return quantityRegex.test(value);
};

const isIntegerValid = (value) => {
    if (!value) return true;
    return /^\d+$/.test(value);
}

const hasInvalidQuotas = computed(() => {
    return Object.entries(quotas.value).some(([key, value]) => {
        if (!value) return false;
        if (key === 'pods') return !isIntegerValid(value);
        return !isQuantityValid(value);
    });
});

const isFormValid = computed(() => {
  return isNameValid.value &&
         !hasInvalidLabels.value &&
         !hasInvalidQuotas.value &&
         !labels.value.some(l => (!l.key && l.value));
});

function addLabel() {
  labels.value.push({ key: '', value: '' });
}

function removeLabel(index) {
  labels.value.splice(index, 1);
  if (labels.value.length === 0) {
      addLabel();
  }
}

async function createNamespace() {
  if (!isFormValid.value) {
      error.value = "Please fix the validation errors before submitting.";
      return;
  }
  isLoading.value = true;
  error.value = null;

  const labelsObject = labels.value.reduce((acc, label) => {
    if (label.key) {
      acc[label.key] = label.value;
    }
    return acc;
  }, {});

  const quotasObject = Object.entries(quotas.value).reduce((acc, [key, value]) => {
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const namespaceData = {
    metadata: {
      name: namespaceName.value,
      labels: labelsObject,
    },
    quotas: Object.keys(quotasObject).length > 0 ? quotasObject : undefined,
  };

  console.log("Submitting data:", JSON.stringify(namespaceData, null, 2));

  try {
    const response = await axios.post('/api/v1/namespaces', namespaceData);
    console.log("Namespace (and potentially quota) created successfully:", response.data);
    alert(`Namespace '${namespaceName.value}' created successfully! Quota Status: ${response.data.quotaStatus}`);
    router.push({ name: 'namespaces' });

  } catch (err) {
    console.error("Error creating namespace/quota:", err);
    const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to create namespace';
    error.value = `Error: ${errorMsg}`;
    alert(`Error: ${errorMsg}`);
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.field small {
  display: block;
  margin-top: 0.25rem;
  min-height: 1.2rem; /* Reserve space for error messages to prevent layout shifts */
}

.col-fixed {
    display: flex;
    align-items: center; /* Center button vertically */
    justify-content: center;
}

/* Adjust margin-top for the remove button if needed */
.col-fixed .p-button {
    margin-top: 1.5rem; /* Adjust based on label height */
}
</style> 