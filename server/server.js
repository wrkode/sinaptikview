const express = require('express');
const k8s = require('@kubernetes/client-node');

const app = express();
const port = 3001; // Port for the backend server

// Kubernetes client configuration
const kc = new k8s.KubeConfig();
// Load default configuration (in-cluster or local kubeconfig)
kc.loadFromDefault(); 

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api); // Add AppsV1Api client

app.get('/', (req, res) => {
  res.send('Kubernetes Dashboard Backend is running!');
});

// Example API endpoint (we will add more later)
app.get('/api/v1/pods', async (req, res) => {
  // Get namespace from query param, default to 'default' if not provided
  const namespace = req.query.namespace || 'default'; 
  console.log(`Fetching pods for namespace: ${namespace}`);

  try {
    let podsRes;
    if (namespace === 'all') {
      // Use listPodForAllNamespaces for 'all' - no namespace arg needed
      console.log('Listing pods for all namespaces...');
      podsRes = await k8sApi.listPodForAllNamespaces(); 
    } else {
      // Otherwise, use listNamespacedPod for the specific namespace
      console.log(`Listing pods for namespace: ${namespace}...`);
      // Pass namespace as an object property { namespace: ... }
      podsRes = await k8sApi.listNamespacedPod({ namespace: namespace }); 
    }

    console.log(`Pods response object keys (ns: ${namespace}):`, podsRes ? Object.keys(podsRes) : 'No response');
    
    // Check if items exists before sending
    if (podsRes && podsRes.items) {
        // Send the items array directly
        res.json({ items: podsRes.items }); 
    } else {
        console.error('Pods response items are missing or undefined', podsRes);
        res.status(500).json({ error: 'Failed to fetch pods', details: 'Backend received invalid response structure from Kubernetes API' });
    }
  } catch (err) {
    console.error('Error fetching pods:', err);
    res.status(500).json({ error: 'Failed to fetch pods', details: err.message });
  }
});

// API endpoint to list nodes
app.get('/api/v1/nodes', async (req, res) => {
  try {
    const nodesRes = await k8sApi.listNode();
    // Log only the keys of the response object
    console.log('Nodes response object keys:', Object.keys(nodesRes));
    
    // Check if items exists before sending
    if (nodesRes && nodesRes.items) {
        // Send the items array directly
        res.json({ items: nodesRes.items }); 
    } else {
        console.error('Nodes response items are missing or undefined', nodesRes);
        res.status(500).json({ error: 'Failed to fetch nodes', details: 'Backend received invalid response structure from Kubernetes API' });
    }
  } catch (err) {
    console.error('Error fetching nodes:', err);
    res.status(500).json({ error: 'Failed to fetch nodes', details: err.message });
  }
});

// API endpoint to list namespaces
app.get('/api/v1/namespaces', async (req, res) => {
  try {
    const nsRes = await k8sApi.listNamespace();
    console.log('Namespaces response object keys:', Object.keys(nsRes));
    if (nsRes && nsRes.items) {
      res.json({ items: nsRes.items });
    } else {
      console.error('Namespaces response items are missing or undefined', nsRes);
      res.status(500).json({ error: 'Failed to fetch namespaces', details: 'Backend received invalid response structure from Kubernetes API' });
    }
  } catch (err) {
    console.error('Error fetching namespaces:', err);
    res.status(500).json({ error: 'Failed to fetch namespaces', details: err.message });
  }
});

// API endpoint for single node details
app.get('/api/v1/nodes/:name', async (req, res) => {
    const nodeName = req.params.name;
    console.log(`Fetching details for node: ${nodeName}`);
    try {
        console.log(`[DEBUG] nodeName before readNode call: '${nodeName}', type: ${typeof nodeName}`); 
        const nodeRes = await k8sApi.readNode({ name: nodeName }); 
        console.log(`Node details response keys for ${nodeName}:`, nodeRes ? Object.keys(nodeRes) : 'No response');
        
        // Check if the response object itself exists (it should be the V1Node object)
        if (nodeRes) { 
             // Send the node object directly
             res.json(nodeRes); 
        } else {
             console.error(`Node details response object is missing for ${nodeName}`);
             res.status(500).json({ error: 'Failed to fetch node details', details: 'Backend received invalid response from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching node details for ${nodeName}:`, err);
        if (err.response && err.response.statusCode === 404) {
             res.status(404).json({ error: 'Node not found', details: err.message });
        } else {
             res.status(500).json({ error: 'Failed to fetch node details', details: err.message });
        }
    }
});

// API endpoint for single pod details
app.get('/api/v1/namespaces/:namespace/pods/:name', async (req, res) => {
    const podName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for pod: ${podName} in namespace: ${namespace}`);
    try {
        console.log(`[DEBUG] podName: '${podName}', namespace: '${namespace}'`);
        // Use readNamespacedPod, passing name and namespace within an object
        const podRes = await k8sApi.readNamespacedPod({ name: podName, namespace: namespace });
        console.log(`Pod details response keys for ${namespace}/${podName}:`, podRes ? Object.keys(podRes) : 'No response');
        
        // Check if the response object itself exists (it should be the V1Pod object)
        if (podRes) { 
            res.json(podRes);
        } else {
            console.error(`Pod details response object is missing for ${namespace}/${podName}`);
            res.status(500).json({ error: 'Failed to fetch pod details', details: 'Backend received invalid response from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching pod details for ${namespace}/${podName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Pod not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch pod details', details: err.message });
        }
    }
});

// API endpoint for single namespace details
app.get('/api/v1/namespaces/:name', async (req, res) => {
    const namespaceName = req.params.name;
    console.log(`Fetching details for namespace: ${namespaceName}`);
    try {
        console.log(`[DEBUG] namespaceName before readNamespace call: '${namespaceName}', type: ${typeof namespaceName}`);
        const nsRes = await k8sApi.readNamespace({ name: namespaceName }); // Keep object format for call
        console.log(`Namespace details response keys for ${namespaceName}:`, nsRes ? Object.keys(nsRes) : 'No response');

        // Correctly check for nsRes itself and send it directly
        if (nsRes) { 
            res.json(nsRes); 
        } else {
            console.error(`Namespace details response object is missing for ${namespaceName}`, nsRes);
            res.status(500).json({ error: 'Failed to fetch namespace details', details: 'Backend received invalid response from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching namespace details for ${namespaceName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Namespace not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch namespace details', details: err.message });
        }
    }
});

// API endpoint for ResourceQuotas in a namespace
app.get('/api/v1/namespaces/:namespace/resourcequotas', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching ResourceQuotas for namespace: ${namespace}`);
    try {
        const rqRes = await k8sApi.listNamespacedResourceQuota({ namespace: namespace });
        console.log(`ResourceQuota response keys for ${namespace}:`, rqRes ? Object.keys(rqRes) : 'No response');
        if (rqRes && rqRes.body && rqRes.body.items) {
            res.json({ items: rqRes.body.items });
        } else {
            console.error(`ResourceQuota response body/items missing for ${namespace}`, rqRes);
            res.status(500).json({ error: 'Failed to fetch ResourceQuotas', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching ResourceQuotas for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch ResourceQuotas', details: err.message });
    }
});

// API endpoint for LimitRanges in a namespace
app.get('/api/v1/namespaces/:namespace/limitranges', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching LimitRanges for namespace: ${namespace}`);
    try {
        const lrRes = await k8sApi.listNamespacedLimitRange({ namespace: namespace });
        console.log(`LimitRange response keys for ${namespace}:`, lrRes ? Object.keys(lrRes) : 'No response');
        
        // Debug the actual response structure
        console.log(`LimitRange response for ${namespace}:`, lrRes);
        
        if (lrRes && lrRes.body) {
            // Even if items is an empty array, that's a valid response
            res.json({ items: lrRes.body.items || [] });
        } else if (lrRes && lrRes.items) {
            // Alternative response structure
            res.json({ items: lrRes.items });
        } else {
            console.error(`LimitRange response invalid structure for ${namespace}`, lrRes);
            res.status(500).json({ error: 'Failed to fetch LimitRanges', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching LimitRanges for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch LimitRanges', details: err.message });
    }
});

// API endpoint for LimitRanges across all namespaces
app.get('/api/v1/limitranges', async (req, res) => {
  try {
    console.log('Fetching LimitRanges for all namespaces');
    const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sCoreApi.listLimitRangeForAllNamespaces();
    
    console.log(`LimitRanges all namespaces response keys:`, response ? Object.keys(response) : 'No response');
    
    if (response && response.items) {
      res.json({ items: response.items });
    } else if (response && response.body && response.body.items) {
      res.json({ items: response.body.items });
    } else {
      console.error('Invalid response structure when fetching LimitRanges for all namespaces');
      res.status(500).json({ error: 'Failed to fetch LimitRanges', details: 'Invalid response structure' });
    }
  } catch (err) {
    console.error('Error fetching LimitRanges for all namespaces:', err);
    res.status(500).json({ error: 'Failed to fetch LimitRanges', details: err.message });
  }
});

// API endpoint for single LimitRange details
app.get('/api/v1/namespaces/:namespace/limitranges/:name', async (req, res) => {
    const limitRangeName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for LimitRange: ${limitRangeName} in namespace: ${namespace}`);
    try {
        const lrRes = await k8sApi.readNamespacedLimitRange({ name: limitRangeName, namespace: namespace });
        console.log(`LimitRange details response keys for ${namespace}/${limitRangeName}:`, lrRes ? Object.keys(lrRes) : 'No response');
        
        if (lrRes) { 
            res.json(lrRes);
        } else {
            console.error(`LimitRange details response object is missing for ${namespace}/${limitRangeName}`, lrRes);
            res.status(500).json({ error: 'Failed to fetch LimitRange details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching LimitRange details for ${namespace}/${limitRangeName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'LimitRange not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch LimitRange details', details: err.message });
        }
    }
});

// API endpoint for events in a namespace (with fieldSelector support)
app.get('/api/v1/namespaces/:namespace/events', async (req, res) => {
    const namespace = req.params.namespace;
    const fieldSelector = req.query.fieldSelector;
    console.log(`Fetching events for namespace: ${namespace}${fieldSelector ? ', fieldSelector: ' + fieldSelector : ''}`);
    try {
        // Fix: Pass namespace as an object property instead of a direct parameter
        const options = { namespace: namespace };
        
        // Add fieldSelector to options if provided
        if (fieldSelector) {
            options.fieldSelector = fieldSelector;
        }
        
        let eventRes;
        if (namespace === 'all') {
            console.log('Listing events for all namespaces...');
            // Use listEventForAllNamespaces for 'all' namespace
            eventRes = await k8sApi.listEventForAllNamespaces();
            console.log(`All namespaces events count:`, eventRes?.body?.items?.length || 0);
        } else {
            console.log(`Listing events for namespace: ${namespace}...`);
            eventRes = await k8sApi.listNamespacedEvent(options);
        }
        
        console.log(`Events response keys for ${namespace}:`, eventRes ? Object.keys(eventRes) : 'No response');

        if (eventRes && eventRes.body && eventRes.body.items) {
             res.json({ items: eventRes.body.items });
        } else if (eventRes && eventRes.items) {
             res.json({ items: eventRes.items });
        } else {
             console.error(`Events response structure invalid for ${namespace}`, eventRes);
             res.status(500).json({ error: 'Failed to fetch events', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching events for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
});

// API endpoint for Deployments in a namespace
app.get('/api/v1/namespaces/:namespace/deployments', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching Deployments for namespace: ${namespace}`);
    try {
        let deployRes;
        if (namespace === 'all') {
            console.log('Listing deployments for all namespaces...');
            deployRes = await k8sAppsApi.listDeploymentForAllNamespaces();
        } else {
             console.log(`Listing deployments for namespace: ${namespace}...`);
             // Use object format for consistency, though listNamespacedDeployment might only need namespace string
             deployRes = await k8sAppsApi.listNamespacedDeployment({ namespace: namespace });
        }

        console.log(`Deployments response keys for ${namespace}:`, deployRes ? Object.keys(deployRes) : 'No response');

        if (deployRes && deployRes.items) {
             res.json({ items: deployRes.items });
        } else {
             console.error(`Deployments response items missing for ${namespace}`, deployRes);
             res.status(500).json({ error: 'Failed to fetch deployments', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching deployments for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch deployments', details: err.message });
    }
});

// API endpoint for single Deployment details
app.get('/api/v1/namespaces/:namespace/deployments/:name', async (req, res) => {
    const deploymentName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for deployment: ${deploymentName} in namespace: ${namespace}`);
    try {
        const deployRes = await k8sAppsApi.readNamespacedDeployment({ name: deploymentName, namespace: namespace });
        console.log(`Deployment details response keys for ${namespace}/${deploymentName}:`, deployRes ? Object.keys(deployRes) : 'No response');
        
        // Correctly check if deployRes exists and send it directly
        if (deployRes) { 
             res.json(deployRes);
        } else {
             console.error(`Deployment details response object is missing for ${namespace}/${deploymentName}`, deployRes);
             res.status(500).json({ error: 'Failed to fetch deployment details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching deployment details for ${namespace}/${deploymentName}:`, err);
         if (err.response && err.response.statusCode === 404) {
             res.status(404).json({ error: 'Deployment not found', details: err.message });
        } else {
             res.status(500).json({ error: 'Failed to fetch deployment details', details: err.message });
        }
    }
});

// API endpoint for StatefulSets in a namespace
app.get('/api/v1/namespaces/:namespace/statefulsets', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching StatefulSets for namespace: ${namespace}`);
    try {
        let stsRes;
        if (namespace === 'all') {
            console.log('Listing statefulsets for all namespaces...');
            stsRes = await k8sAppsApi.listStatefulSetForAllNamespaces();
        } else {
            console.log(`Listing statefulsets for namespace: ${namespace}...`);
            stsRes = await k8sAppsApi.listNamespacedStatefulSet({ namespace: namespace });
        }

        console.log(`StatefulSets response keys for ${namespace}:`, stsRes ? Object.keys(stsRes) : 'No response');

        if (stsRes && stsRes.items) {
            res.json({ items: stsRes.items });
        } else {
            console.error(`StatefulSets response items missing for ${namespace}`, stsRes);
            res.status(500).json({ error: 'Failed to fetch statefulsets', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching statefulsets for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch statefulsets', details: err.message });
    }
});

// API endpoint for single StatefulSet details
app.get('/api/v1/namespaces/:namespace/statefulsets/:name', async (req, res) => {
    const statefulsetName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for statefulset: ${statefulsetName} in namespace: ${namespace}`);
    try {
        const stsRes = await k8sAppsApi.readNamespacedStatefulSet({ name: statefulsetName, namespace: namespace });
        console.log(`StatefulSet details response keys for ${namespace}/${statefulsetName}:`, stsRes ? Object.keys(stsRes) : 'No response');
        
        if (stsRes) { 
            res.json(stsRes);
        } else {
            console.error(`StatefulSet details response object is missing for ${namespace}/${statefulsetName}`, stsRes);
            res.status(500).json({ error: 'Failed to fetch statefulset details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching statefulset details for ${namespace}/${statefulsetName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'StatefulSet not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch statefulset details', details: err.message });
        }
    }
});

// API endpoint for DaemonSets in a namespace
app.get('/api/v1/namespaces/:namespace/daemonsets', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching DaemonSets for namespace: ${namespace}`);
    try {
        let dsRes;
        if (namespace === 'all') {
            console.log('Listing daemonsets for all namespaces...');
            dsRes = await k8sAppsApi.listDaemonSetForAllNamespaces();
        } else {
            console.log(`Listing daemonsets for namespace: ${namespace}...`);
            dsRes = await k8sAppsApi.listNamespacedDaemonSet({ namespace: namespace });
        }

        console.log(`DaemonSets response keys for ${namespace}:`, dsRes ? Object.keys(dsRes) : 'No response');

        if (dsRes && dsRes.items) {
            res.json({ items: dsRes.items });
        } else {
            console.error(`DaemonSets response items missing for ${namespace}`, dsRes);
            res.status(500).json({ error: 'Failed to fetch daemonsets', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching daemonsets for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch daemonsets', details: err.message });
    }
});

// API endpoint for single DaemonSet details
app.get('/api/v1/namespaces/:namespace/daemonsets/:name', async (req, res) => {
    const daemonsetName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for daemonset: ${daemonsetName} in namespace: ${namespace}`);
    try {
        const dsRes = await k8sAppsApi.readNamespacedDaemonSet({ name: daemonsetName, namespace: namespace });
        console.log(`DaemonSet details response keys for ${namespace}/${daemonsetName}:`, dsRes ? Object.keys(dsRes) : 'No response');
        
        if (dsRes) { 
            res.json(dsRes);
        } else {
            console.error(`DaemonSet details response object is missing for ${namespace}/${daemonsetName}`, dsRes);
            res.status(500).json({ error: 'Failed to fetch daemonset details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching daemonset details for ${namespace}/${daemonsetName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'DaemonSet not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch daemonset details', details: err.message });
        }
    }
});

// API endpoint for ReplicaSets in a namespace
app.get('/api/v1/namespaces/:namespace/replicasets', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching ReplicaSets for namespace: ${namespace}`);
    try {
        let rsRes;
        if (namespace === 'all') {
            console.log('Listing replicasets for all namespaces...');
            rsRes = await k8sAppsApi.listReplicaSetForAllNamespaces();
        } else {
            console.log(`Listing replicasets for namespace: ${namespace}...`);
            rsRes = await k8sAppsApi.listNamespacedReplicaSet({ namespace: namespace });
        }

        console.log(`ReplicaSets response keys for ${namespace}:`, rsRes ? Object.keys(rsRes) : 'No response');

        if (rsRes && rsRes.items) {
            res.json({ items: rsRes.items });
        } else {
            console.error(`ReplicaSets response items missing for ${namespace}`, rsRes);
            res.status(500).json({ error: 'Failed to fetch replicasets', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching replicasets for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch replicasets', details: err.message });
    }
});

// API endpoint for single ReplicaSet details
app.get('/api/v1/namespaces/:namespace/replicasets/:name', async (req, res) => {
    const replicasetName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for replicaset: ${replicasetName} in namespace: ${namespace}`);
    try {
        const rsRes = await k8sAppsApi.readNamespacedReplicaSet({ name: replicasetName, namespace: namespace });
        console.log(`ReplicaSet details response keys for ${namespace}/${replicasetName}:`, rsRes ? Object.keys(rsRes) : 'No response');
        
        if (rsRes) { 
            res.json(rsRes);
        } else {
            console.error(`ReplicaSet details response object is missing for ${namespace}/${replicasetName}`, rsRes);
            res.status(500).json({ error: 'Failed to fetch replicaset details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching replicaset details for ${namespace}/${replicasetName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'ReplicaSet not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch replicaset details', details: err.message });
        }
    }
});

// API endpoint for Jobs in a namespace
app.get('/api/v1/namespaces/:namespace/jobs', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching Jobs for namespace: ${namespace}`);
    try {
        let jobsRes;
        // Initialize the batch/v1 API client
        const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
        
        if (namespace === 'all') {
            console.log('Listing jobs for all namespaces...');
            jobsRes = await k8sBatchApi.listJobForAllNamespaces();
        } else {
            console.log(`Listing jobs for namespace: ${namespace}...`);
            jobsRes = await k8sBatchApi.listNamespacedJob({ namespace: namespace });
        }

        console.log(`Jobs response keys for ${namespace}:`, jobsRes ? Object.keys(jobsRes) : 'No response');

        if (jobsRes && jobsRes.items) {
            res.json({ items: jobsRes.items });
        } else {
            console.error(`Jobs response items missing for ${namespace}`, jobsRes);
            res.status(500).json({ error: 'Failed to fetch jobs', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching jobs for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
    }
});

// API endpoint for single Job details
app.get('/api/v1/namespaces/:namespace/jobs/:name', async (req, res) => {
    const jobName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for job: ${jobName} in namespace: ${namespace}`);
    try {
        // Initialize the batch/v1 API client if necessary
        const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
        const jobRes = await k8sBatchApi.readNamespacedJob({ name: jobName, namespace: namespace });
        console.log(`Job details response keys for ${namespace}/${jobName}:`, jobRes ? Object.keys(jobRes) : 'No response');
        
        if (jobRes) { 
            res.json(jobRes);
        } else {
            console.error(`Job details response object is missing for ${namespace}/${jobName}`, jobRes);
            res.status(500).json({ error: 'Failed to fetch job details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching job details for ${namespace}/${jobName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Job not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch job details', details: err.message });
        }
    }
});

// API endpoint for CronJobs in a namespace
app.get('/api/v1/namespaces/:namespace/cronjobs', async (req, res) => {
    const namespace = req.params.namespace;
    console.log(`Fetching CronJobs for namespace: ${namespace}`);
    try {
        let cronjobsRes;
        // Initialize the batch/v1 API client if necessary
        const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
        
        if (namespace === 'all') {
            console.log('Listing cronjobs for all namespaces...');
            cronjobsRes = await k8sBatchApi.listCronJobForAllNamespaces();
        } else {
            console.log(`Listing cronjobs for namespace: ${namespace}...`);
            cronjobsRes = await k8sBatchApi.listNamespacedCronJob({ namespace: namespace });
        }

        console.log(`CronJobs response keys for ${namespace}:`, cronjobsRes ? Object.keys(cronjobsRes) : 'No response');

        if (cronjobsRes && cronjobsRes.items) {
            res.json({ items: cronjobsRes.items });
        } else {
            console.error(`CronJobs response items missing for ${namespace}`, cronjobsRes);
            res.status(500).json({ error: 'Failed to fetch cronjobs', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching cronjobs for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch cronjobs', details: err.message });
    }
});

// API endpoint for single CronJob details
app.get('/api/v1/namespaces/:namespace/cronjobs/:name', async (req, res) => {
    const cronjobName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for cronjob: ${cronjobName} in namespace: ${namespace}`);
    try {
        // Initialize the batch/v1 API client if necessary
        const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
        const cronjobRes = await k8sBatchApi.readNamespacedCronJob({ name: cronjobName, namespace: namespace });
        console.log(`CronJob details response keys for ${namespace}/${cronjobName}:`, cronjobRes ? Object.keys(cronjobRes) : 'No response');
        
        if (cronjobRes) { 
            res.json(cronjobRes);
        } else {
            console.error(`CronJob details response object is missing for ${namespace}/${cronjobName}`, cronjobRes);
            res.status(500).json({ error: 'Failed to fetch cronjob details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching cronjob details for ${namespace}/${cronjobName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'CronJob not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch cronjob details', details: err.message });
        }
    }
});

// Storage API Endpoints

// API endpoint for PersistentVolumeClaims in a namespace
app.get('/api/v1/persistentvolumeclaims', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching PersistentVolumeClaims for namespace: ${namespace}`);
    try {
        let pvcRes;
        if (namespace === 'all') {
            console.log('Listing PVCs for all namespaces...');
            pvcRes = await k8sApi.listPersistentVolumeClaimForAllNamespaces();
        } else {
            console.log(`Listing PVCs for namespace: ${namespace}...`);
            pvcRes = await k8sApi.listNamespacedPersistentVolumeClaim({ namespace: namespace });
        }

        console.log(`PVCs response keys for ${namespace}:`, pvcRes ? Object.keys(pvcRes) : 'No response');

        if (pvcRes && pvcRes.items) {
            res.json({ items: pvcRes.items });
        } else {
            console.error(`PVCs response items missing for ${namespace}`, pvcRes);
            res.status(500).json({ error: 'Failed to fetch PVCs', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching PVCs for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch PVCs', details: err.message });
    }
});

// API endpoint for single PersistentVolumeClaim details
app.get('/api/v1/namespaces/:namespace/persistentvolumeclaims/:name', async (req, res) => {
    const pvcName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for PVC: ${pvcName} in namespace: ${namespace}`);
    try {
        const pvcRes = await k8sApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace: namespace });
        console.log(`PVC details response keys for ${namespace}/${pvcName}:`, pvcRes ? Object.keys(pvcRes) : 'No response');
        
        if (pvcRes) { 
            res.json(pvcRes);
        } else {
            console.error(`PVC details response object is missing for ${namespace}/${pvcName}`, pvcRes);
            res.status(500).json({ error: 'Failed to fetch PVC details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching PVC details for ${namespace}/${pvcName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'PersistentVolumeClaim not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch PVC details', details: err.message });
        }
    }
});

// API endpoint for PersistentVolumes
app.get('/api/v1/persistentvolumes', async (req, res) => {
    console.log('Fetching PersistentVolumes');
    try {
        const pvRes = await k8sApi.listPersistentVolume();
        console.log('PVs response keys:', pvRes ? Object.keys(pvRes) : 'No response');

        if (pvRes && pvRes.items) {
            res.json({ items: pvRes.items });
        } else {
            console.error('PVs response items missing', pvRes);
            res.status(500).json({ error: 'Failed to fetch PVs', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error('Error fetching PVs:', err);
        res.status(500).json({ error: 'Failed to fetch PVs', details: err.message });
    }
});

// API endpoint for single PersistentVolume details
app.get('/api/v1/persistentvolumes/:name', async (req, res) => {
    const pvName = req.params.name;
    console.log(`Fetching details for PV: ${pvName}`);
    try {
        const pvRes = await k8sApi.readPersistentVolume({ name: pvName });
        console.log(`PV details response keys for ${pvName}:`, pvRes ? Object.keys(pvRes) : 'No response');
        
        if (pvRes) { 
            res.json(pvRes);
        } else {
            console.error(`PV details response object is missing for ${pvName}`, pvRes);
            res.status(500).json({ error: 'Failed to fetch PV details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching PV details for ${pvName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'PersistentVolume not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch PV details', details: err.message });
        }
    }
});

// API endpoint for StorageClasses
app.get('/api/v1/storageclasses', async (req, res) => {
    console.log('Fetching StorageClasses');
    try {
        const k8sStorageApi = kc.makeApiClient(k8s.StorageV1Api);
        const scRes = await k8sStorageApi.listStorageClass();
        console.log('StorageClasses response keys:', scRes ? Object.keys(scRes) : 'No response');

        if (scRes && scRes.items) {
            res.json({ items: scRes.items });
        } else {
            console.error('StorageClasses response items missing', scRes);
            res.status(500).json({ error: 'Failed to fetch StorageClasses', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error('Error fetching StorageClasses:', err);
        res.status(500).json({ error: 'Failed to fetch StorageClasses', details: err.message });
    }
});

// API endpoint for single StorageClass details
app.get('/api/v1/storageclasses/:name', async (req, res) => {
    const scName = req.params.name;
    console.log(`Fetching details for StorageClass: ${scName}`);
    try {
        const k8sStorageApi = kc.makeApiClient(k8s.StorageV1Api);
        const scRes = await k8sStorageApi.readStorageClass({ name: scName });
        console.log(`StorageClass details response keys for ${scName}:`, scRes ? Object.keys(scRes) : 'No response');
        
        if (scRes) { 
            res.json(scRes);
        } else {
            console.error(`StorageClass details response object is missing for ${scName}`, scRes);
            res.status(500).json({ error: 'Failed to fetch StorageClass details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching StorageClass details for ${scName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'StorageClass not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch StorageClass details', details: err.message });
        }
    }
});

// API endpoint for ConfigMaps in a namespace
app.get('/api/v1/configmaps', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching ConfigMaps for namespace: ${namespace}`);
    try {
        let cmRes;
        if (namespace === 'all') {
            console.log('Listing ConfigMaps for all namespaces...');
            cmRes = await k8sApi.listConfigMapForAllNamespaces();
        } else {
            console.log(`Listing ConfigMaps for namespace: ${namespace}...`);
            cmRes = await k8sApi.listNamespacedConfigMap({ namespace: namespace });
        }

        console.log(`ConfigMaps response keys for ${namespace}:`, cmRes ? Object.keys(cmRes) : 'No response');

        if (cmRes && cmRes.items) {
            res.json({ items: cmRes.items });
        } else {
            console.error(`ConfigMaps response items missing for ${namespace}`, cmRes);
            res.status(500).json({ error: 'Failed to fetch ConfigMaps', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching ConfigMaps for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch ConfigMaps', details: err.message });
    }
});

// API endpoint for single ConfigMap details
app.get('/api/v1/namespaces/:namespace/configmaps/:name', async (req, res) => {
    const cmName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for ConfigMap: ${cmName} in namespace: ${namespace}`);
    try {
        const cmRes = await k8sApi.readNamespacedConfigMap({ name: cmName, namespace: namespace });
        console.log(`ConfigMap details response keys for ${namespace}/${cmName}:`, cmRes ? Object.keys(cmRes) : 'No response');
        
        if (cmRes) { 
            res.json(cmRes);
        } else {
            console.error(`ConfigMap details response object is missing for ${namespace}/${cmName}`, cmRes);
            res.status(500).json({ error: 'Failed to fetch ConfigMap details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching ConfigMap details for ${namespace}/${cmName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'ConfigMap not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch ConfigMap details', details: err.message });
        }
    }
});

// API endpoint for Secrets in a namespace
app.get('/api/v1/secrets', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching Secrets for namespace: ${namespace}`);
    try {
        let secretRes;
        if (namespace === 'all') {
            console.log('Listing Secrets for all namespaces...');
            secretRes = await k8sApi.listSecretForAllNamespaces();
        } else {
            console.log(`Listing Secrets for namespace: ${namespace}...`);
            secretRes = await k8sApi.listNamespacedSecret({ namespace: namespace });
        }

        console.log(`Secrets response keys for ${namespace}:`, secretRes ? Object.keys(secretRes) : 'No response');

        if (secretRes && secretRes.items) {
            res.json({ items: secretRes.items });
        } else {
            console.error(`Secrets response items missing for ${namespace}`, secretRes);
            res.status(500).json({ error: 'Failed to fetch Secrets', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching Secrets for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch Secrets', details: err.message });
    }
});

// API endpoint for single Secret details
app.get('/api/v1/namespaces/:namespace/secrets/:name', async (req, res) => {
    const secretName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for Secret: ${secretName} in namespace: ${namespace}`);
    try {
        const secretRes = await k8sApi.readNamespacedSecret({ name: secretName, namespace: namespace });
        console.log(`Secret details response keys for ${namespace}/${secretName}:`, secretRes ? Object.keys(secretRes) : 'No response');
        
        if (secretRes) { 
            res.json(secretRes);
        } else {
            console.error(`Secret details response object is missing for ${namespace}/${secretName}`, secretRes);
            res.status(500).json({ error: 'Failed to fetch Secret details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching Secret details for ${namespace}/${secretName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Secret not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch Secret details', details: err.message });
        }
    }
});

// Network & Services API Endpoints

// API endpoint for Services in a namespace
app.get('/api/v1/services', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching Services for namespace: ${namespace}`);
    try {
        let servicesRes;
        if (namespace === 'all') {
            console.log('Listing Services for all namespaces...');
            servicesRes = await k8sApi.listServiceForAllNamespaces();
        } else {
            console.log(`Listing Services for namespace: ${namespace}...`);
            servicesRes = await k8sApi.listNamespacedService({ namespace: namespace });
        }

        console.log(`Services response keys for ${namespace}:`, servicesRes ? Object.keys(servicesRes) : 'No response');

        if (servicesRes && servicesRes.items) {
            res.json({ items: servicesRes.items });
        } else {
            console.error(`Services response items missing for ${namespace}`, servicesRes);
            res.status(500).json({ error: 'Failed to fetch Services', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching Services for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch Services', details: err.message });
    }
});

// API endpoint for single Service details
app.get('/api/v1/namespaces/:namespace/services/:name', async (req, res) => {
    const serviceName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for Service: ${serviceName} in namespace: ${namespace}`);
    try {
        const serviceRes = await k8sApi.readNamespacedService({ name: serviceName, namespace: namespace });
        console.log(`Service details response keys for ${namespace}/${serviceName}:`, serviceRes ? Object.keys(serviceRes) : 'No response');
        
        if (serviceRes) { 
            res.json(serviceRes);
        } else {
            console.error(`Service details response object is missing for ${namespace}/${serviceName}`, serviceRes);
            res.status(500).json({ error: 'Failed to fetch Service details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching Service details for ${namespace}/${serviceName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Service not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch Service details', details: err.message });
        }
    }
});

// API endpoint for Endpoints (for a specific service)
app.get('/api/v1/namespaces/:namespace/endpoints/:name', async (req, res) => {
    const endpointName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching Endpoints for service: ${endpointName} in namespace: ${namespace}`);
    try {
        const endpointRes = await k8sApi.readNamespacedEndpoints({ name: endpointName, namespace: namespace });
        console.log(`Endpoints response keys for ${namespace}/${endpointName}:`, endpointRes ? Object.keys(endpointRes) : 'No response');
        
        if (endpointRes) { 
            res.json(endpointRes);
        } else {
            console.error(`Endpoints response object is missing for ${namespace}/${endpointName}`, endpointRes);
            res.status(500).json({ error: 'Failed to fetch Endpoints', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching Endpoints for ${namespace}/${endpointName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Endpoints not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch Endpoints', details: err.message });
        }
    }
});

// API endpoint for listing Endpoints in a namespace
app.get('/api/v1/endpoints', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching Endpoints for namespace: ${namespace}`);
    try {
        let endpointsRes;
        if (namespace === 'all') {
            console.log('Listing Endpoints for all namespaces...');
            endpointsRes = await k8sApi.listEndpointsForAllNamespaces();
        } else {
            console.log(`Listing Endpoints for namespace: ${namespace}...`);
            endpointsRes = await k8sApi.listNamespacedEndpoints({ namespace: namespace });
        }

        console.log(`Endpoints response keys for ${namespace}:`, endpointsRes ? Object.keys(endpointsRes) : 'No response');

        if (endpointsRes && endpointsRes.items) {
            res.json({ items: endpointsRes.items });
        } else {
            console.error(`Endpoints response items missing for ${namespace}`, endpointsRes);
            res.status(500).json({ error: 'Failed to fetch Endpoints', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching Endpoints for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch Endpoints', details: err.message });
    }
});

// API endpoint for Ingresses in a namespace
app.get('/api/v1/ingresses', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching Ingresses for namespace: ${namespace}`);
    try {
        let ingressesRes;
        // Initialize the networking.k8s.io/v1 API client
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        
        if (namespace === 'all') {
            console.log('Listing ingresses for all namespaces...');
            ingressesRes = await k8sNetworkingApi.listIngressForAllNamespaces();
        } else {
            console.log(`Listing ingresses for namespace: ${namespace}...`);
            ingressesRes = await k8sNetworkingApi.listNamespacedIngress({ namespace: namespace });
        }

        console.log(`Ingresses response keys for ${namespace}:`, ingressesRes ? Object.keys(ingressesRes) : 'No response');

        if (ingressesRes && ingressesRes.items) {
            res.json({ items: ingressesRes.items });
        } else {
            console.error(`Ingresses response items missing for ${namespace}`, ingressesRes);
            res.status(500).json({ error: 'Failed to fetch ingresses', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching ingresses for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch ingresses', details: err.message });
    }
});

// API endpoint for single Ingress details
app.get('/api/v1/namespaces/:namespace/ingresses/:name', async (req, res) => {
    const ingressName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for ingress: ${ingressName} in namespace: ${namespace}`);
    try {
        // Initialize the networking.k8s.io/v1 API client
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        const ingressRes = await k8sNetworkingApi.readNamespacedIngress({ name: ingressName, namespace: namespace });
        console.log(`Ingress details response keys for ${namespace}/${ingressName}:`, ingressRes ? Object.keys(ingressRes) : 'No response');
        
        if (ingressRes) { 
            res.json(ingressRes);
        } else {
            console.error(`Ingress details response object is missing for ${namespace}/${ingressName}`, ingressRes);
            res.status(500).json({ error: 'Failed to fetch ingress details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching ingress details for ${namespace}/${ingressName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Ingress not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch ingress details', details: err.message });
        }
    }
});

// API endpoint for HorizontalPodAutoscalers in a namespace
app.get('/api/v1/horizontalpodautoscalers', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching HorizontalPodAutoscalers for namespace: ${namespace}`);
    try {
        let hpaRes;
        // Initialize the autoscaling/v2 API client
        const k8sAutoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
        
        if (namespace === 'all') {
            console.log('Listing HPAs for all namespaces...');
            hpaRes = await k8sAutoscalingApi.listHorizontalPodAutoscalerForAllNamespaces();
        } else {
            console.log(`Listing HPAs for namespace: ${namespace}...`);
            hpaRes = await k8sAutoscalingApi.listNamespacedHorizontalPodAutoscaler({ namespace: namespace });
        }

        console.log(`HPAs response keys for ${namespace}:`, hpaRes ? Object.keys(hpaRes) : 'No response');

        if (hpaRes && hpaRes.items) {
            res.json({ items: hpaRes.items });
        } else {
            console.error(`HPAs response items missing for ${namespace}`, hpaRes);
            res.status(500).json({ error: 'Failed to fetch HPAs', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching HPAs for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch HPAs', details: err.message });
    }
});

// API endpoint for single HorizontalPodAutoscaler details
app.get('/api/v1/namespaces/:namespace/horizontalpodautoscalers/:name', async (req, res) => {
    const hpaName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for HorizontalPodAutoscaler: ${hpaName} in namespace: ${namespace}`);
    try {
        // Initialize the autoscaling/v2 API client
        const k8sAutoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
        const hpaRes = await k8sAutoscalingApi.readNamespacedHorizontalPodAutoscaler({ name: hpaName, namespace: namespace });
        console.log(`HPA details response keys for ${namespace}/${hpaName}:`, hpaRes ? Object.keys(hpaRes) : 'No response');
        
        if (hpaRes) { 
            res.json(hpaRes);
        } else {
            console.error(`HPA details response object is missing for ${namespace}/${hpaName}`, hpaRes);
            res.status(500).json({ error: 'Failed to fetch HPA details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching HPA details for ${namespace}/${hpaName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'HorizontalPodAutoscaler not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch HPA details', details: err.message });
        }
    }
});

// API endpoint for NetworkPolicies in a namespace
app.get('/api/v1/networkpolicies', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching NetworkPolicies for namespace: ${namespace}`);
    try {
        let policiesRes;
        // Initialize the networking.k8s.io/v1 API client
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        
        if (namespace === 'all') {
            console.log('Listing network policies for all namespaces...');
            policiesRes = await k8sNetworkingApi.listNetworkPolicyForAllNamespaces();
        } else {
            console.log(`Listing network policies for namespace: ${namespace}...`);
            policiesRes = await k8sNetworkingApi.listNamespacedNetworkPolicy({ namespace: namespace });
        }

        console.log(`NetworkPolicies response keys for ${namespace}:`, policiesRes ? Object.keys(policiesRes) : 'No response');

        if (policiesRes && policiesRes.items) {
            res.json({ items: policiesRes.items });
        } else {
            console.error(`NetworkPolicies response items missing for ${namespace}`, policiesRes);
            res.status(500).json({ error: 'Failed to fetch network policies', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching network policies for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch network policies', details: err.message });
    }
});

// API endpoint for single NetworkPolicy details
app.get('/api/v1/namespaces/:namespace/networkpolicies/:name', async (req, res) => {
    const policyName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for network policy: ${policyName} in namespace: ${namespace}`);
    try {
        // Initialize the networking.k8s.io/v1 API client
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        const policyRes = await k8sNetworkingApi.readNamespacedNetworkPolicy({ name: policyName, namespace: namespace });
        console.log(`NetworkPolicy details response keys for ${namespace}/${policyName}:`, policyRes ? Object.keys(policyRes) : 'No response');
        
        if (policyRes) { 
            res.json(policyRes);
        } else {
            console.error(`NetworkPolicy details response object is missing for ${namespace}/${policyName}`, policyRes);
            res.status(500).json({ error: 'Failed to fetch network policy details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching network policy details for ${namespace}/${policyName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'NetworkPolicy not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch network policy details', details: err.message });
        }
    }
});

// API endpoint for ResourceQuotas (all namespaces or specific namespace)
app.get('/api/v1/resourcequotas', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching ResourceQuotas for namespace: ${namespace}`);
    try {
        let quotasRes;
        
        if (namespace === 'all') {
            console.log('Listing resource quotas for all namespaces...');
            quotasRes = await k8sApi.listResourceQuotaForAllNamespaces();
        } else {
            console.log(`Listing resource quotas for namespace: ${namespace}...`);
            quotasRes = await k8sApi.listNamespacedResourceQuota({ namespace: namespace });
        }

        console.log(`ResourceQuotas response keys for ${namespace}:`, quotasRes ? Object.keys(quotasRes) : 'No response');

        if (quotasRes && quotasRes.items) {
            res.json({ items: quotasRes.items });
        } else {
            console.error(`ResourceQuotas response items missing for ${namespace}`, quotasRes);
            res.status(500).json({ error: 'Failed to fetch resource quotas', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching resource quotas for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch resource quotas', details: err.message });
    }
});

// API endpoint for ResourceQuota detail in a specific namespace
app.get('/api/v1/namespaces/:namespace/resourcequotas/:name', async (req, res) => {
    const quotaName = req.params.name;
    const namespace = req.params.namespace;
    console.log(`Fetching details for resource quota: ${quotaName} in namespace: ${namespace}`);
    try {
        const quotaRes = await k8sApi.readNamespacedResourceQuota({ name: quotaName, namespace: namespace });
        console.log(`ResourceQuota details response keys for ${namespace}/${quotaName}:`, quotaRes ? Object.keys(quotaRes) : 'No response');
        
        if (quotaRes) { 
            res.json(quotaRes);
        } else {
            console.error(`ResourceQuota details response object is missing for ${namespace}/${quotaName}`, quotaRes);
            res.status(500).json({ error: 'Failed to fetch resource quota details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching resource quota details for ${namespace}/${quotaName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'ResourceQuota not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch resource quota details', details: err.message });
        }
    }
});

// API for Pod Disruption Budgets
app.get('/api/v1/poddisruptionbudgets', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    console.log(`Fetching PDBs for namespace: ${namespace}`);
    
    try {
        let pdbsRes;
        // Initialize the policy/v1 API client
        const k8sPolicyApi = kc.makeApiClient(k8s.PolicyV1Api);
        
        if (namespace === 'all') {
            console.log('Listing pod disruption budgets for all namespaces...');
            pdbsRes = await k8sPolicyApi.listPodDisruptionBudgetForAllNamespaces();
        } else {
            console.log(`Listing pod disruption budgets for namespace: ${namespace}...`);
            pdbsRes = await k8sPolicyApi.listNamespacedPodDisruptionBudget({ namespace: namespace });
        }

        console.log(`PDBs response keys for ${namespace}:`, pdbsRes ? Object.keys(pdbsRes) : 'No response');

        if (pdbsRes && pdbsRes.items) {
            res.json({ items: pdbsRes.items });
        } else {
            console.error(`PDBs response items missing for ${namespace}`, pdbsRes);
            res.status(500).json({ error: 'Failed to fetch pod disruption budgets', details: 'Invalid response structure' });
        }
    } catch (err) {
        console.error(`Error fetching pod disruption budgets for ${namespace}:`, err);
        res.status(500).json({ error: 'Failed to fetch pod disruption budgets', details: err.message });
    }
});

// API for Pod Disruption Budget detail
app.get('/api/v1/namespaces/:namespace/poddisruptionbudgets/:name', async (req, res) => {
    const namespace = req.params.namespace;
    const pdbName = req.params.name;
    console.log(`Fetching details for pod disruption budget: ${pdbName} in namespace: ${namespace}`);
    
    try {
        // Initialize the policy/v1 API client
        const k8sPolicyApi = kc.makeApiClient(k8s.PolicyV1Api);
        const pdbRes = await k8sPolicyApi.readNamespacedPodDisruptionBudget({ name: pdbName, namespace: namespace });
        console.log(`PDB details response keys for ${namespace}/${pdbName}:`, pdbRes ? Object.keys(pdbRes) : 'No response');
        
        if (pdbRes) { 
            res.json(pdbRes);
        } else {
            console.error(`PDB details response object is missing for ${namespace}/${pdbName}`, pdbRes);
            res.status(500).json({ error: 'Failed to fetch pod disruption budget details', details: 'Backend received invalid response structure from Kubernetes API' });
        }
    } catch (err) {
        console.error(`Error fetching pod disruption budget details for ${namespace}/${pdbName}:`, err);
        if (err.response && err.response.statusCode === 404) {
            res.status(404).json({ error: 'Pod Disruption Budget not found', details: err.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch pod disruption budget details', details: err.message });
        }
    }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
}); 