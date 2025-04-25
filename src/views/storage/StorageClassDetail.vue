<template>
  <div class="card">
    <div v-if="loading" class="text-center p-4">Loading StorageClass details...</div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">Error loading StorageClass details: {{ error }}</Message>
    </div>
    <div v-else-if="storageClass">
      <h2 class="text-2xl font-bold mb-1">
        StorageClass: {{ storageClassName }}
        <Tag v-if="isDefaultClass" severity="info" class="ml-2">default</Tag>
      </h2>

      <TabView>
        <TabPanel header="Overview">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Panel header="Metadata">
                <p><strong>UID:</strong> {{ storageClass.metadata?.uid }}</p>
                <p><strong>Created:</strong> {{ getAge(storageClass.metadata?.creationTimestamp) }} ago ({{ new Date(storageClass.metadata?.creationTimestamp).toLocaleString() }})</p>
                
                <div class="mt-3">
                  <strong>Labels:</strong>
                  <div v-if="storageClass.metadata?.labels && Object.keys(storageClass.metadata.labels).length" class="mt-1">
                    <Tag v-for="(value, key) in storageClass.metadata.labels" :key="key" class="mr-2 mb-2" severity="info">{{ key }}={{ value }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
                <div class="mt-3">
                  <strong>Annotations:</strong>
                  <div v-if="annotationCount > 0" class="mt-1">
                    <Tag v-for="(value, key) in storageClass.metadata.annotations" :key="key" class="mr-2 mb-2" severity="secondary">{{ key }}</Tag>
                  </div>
                  <div v-else class="text-color-secondary">None</div>
                </div>
              </Panel>
            </div>
            <div>
              <Panel header="Specification">
                <p><strong>Provisioner:</strong> {{ storageClass.provisioner }}</p>
                <p><strong>Reclaim Policy:</strong> {{ storageClass.reclaimPolicy || 'Delete' }}</p>
                <p><strong>Volume Binding Mode:</strong> {{ storageClass.volumeBindingMode || 'Immediate' }}</p>
                <p><strong>Allow Volume Expansion:</strong> {{ storageClass.allowVolumeExpansion ? 'Yes' : 'No' }}</p>
                <p v-if="storageClass.mountOptions"><strong>Mount Options:</strong> {{ storageClass.mountOptions.join(', ') }}</p>
              </Panel>
            </div>
          </div>

          <div class="mt-4">
            <Panel header="Parameters">
              <div v-if="storageClass.parameters && Object.keys(storageClass.parameters).length">
                <DataTable :value="parametersArray" tableStyle="min-width: 50rem">
                  <Column field="key" header="Key"></Column>
                  <Column field="value" header="Value"></Column>
                </DataTable>
              </div>
              <div v-else class="text-color-secondary">No parameters defined for this StorageClass</div>
            </Panel>
          </div>
        </TabPanel>

        <TabPanel header="YAML">
          <pre class="mt-4">{{ storageClassYaml }}</pre>
        </TabPanel>

      </TabView>
    </div>
    <div v-else class="p-4">
      StorageClass not found.
    </div>
  </div>
</template>

<script setup>
import yaml from 'js-yaml'; // Import js-yaml
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const storageClassName = computed(() => route.params.name);
const storageClass = ref(null);
const storageClassYaml = ref('');
const loading = ref(false);
const error = ref(null);

const annotationCount = computed(() => storageClass.value?.metadata?.annotations ? Object.keys(storageClass.value.metadata.annotations).length : 0);

// Check if this is the default storage class
const isDefaultClass = computed(() => {
  if (!storageClass.value?.metadata?.annotations) return false;
  return storageClass.value.metadata.annotations['storageclass.kubernetes.io/is-default-class'] === 'true';
});

// Convert parameters object to array for DataTable
const parametersArray = computed(() => {
  if (!storageClass.value?.parameters) return [];
  return Object.entries(storageClass.value.parameters).map(([key, value]) => ({ key, value }));
});

// Reusable getAge function
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

// Fetch StorageClass Details
const fetchStorageClassDetails = async () => {
  if (!storageClassName.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/v1/storageclasses/${encodeURIComponent(storageClassName.value)}`);
    if (!response.ok) {
       if (response.status === 404) {
           error.value = `StorageClass '${storageClassName.value}' not found.`;
           storageClass.value = null;
       } else {
           const errorData = await response.text();
           console.error("StorageClass detail fetch failed response:", errorData);
           throw new Error(`HTTP error! status: ${response.status}`);
       }
    } else {
        const data = await response.json();
        storageClass.value = data; 
        storageClassYaml.value = yaml.dump(data); // Generate YAML from fetched data
    }
  } catch (err) {
    console.error("Error fetching StorageClass details:", err);
    error.value = err.message;
    storageClass.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStorageClassDetails();
});

</script>

<style scoped>
pre {
    background-color: #f5f5f5;
    padding: 1em;
    overflow-x: auto;
    white-space: pre-wrap; 
    word-wrap: break-word;
}
</style> 