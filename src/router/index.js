import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    component: () => import('@/views/ClusterDashboard.vue')
                },
                {
                    path: '/nodes',
                    name: 'nodes',
                    component: () => import('@/views/NodesList.vue')
                },
                {
                    path: '/namespaces',
                    name: 'namespaces',
                    component: () => import('@/views/Namespaces.vue')
                },
                {
                    path: '/namespaces/:name',
                    name: 'namespace-detail',
                    props: true,
                    component: () => import('@/views/NamespaceDetail.vue')
                },
                {
                    path: '/workloads/deployments',
                    name: 'deployments',
                    component: () => import('@/views/workloads/Deployments.vue')
                },
                {
                    path: '/namespaces/:namespace/deployments/:name',
                    name: 'deployment-detail',
                    props: true,
                    component: () => import('@/views/workloads/DeploymentDetail.vue')
                },
                {
                    path: '/workloads/pods',
                    name: 'pods-list',
                    component: () => import('@/views/workloads/PodsList.vue')
                },
                {
                    path: '/workloads/statefulsets',
                    name: 'statefulsets',
                    component: () => import('@/views/workloads/StatefulSetsList.vue')
                },
                {
                    path: '/namespaces/:namespace/statefulsets/:name',
                    name: 'statefulset-detail',
                    props: true,
                    component: () => import('@/views/workloads/StatefulSetDetail.vue')
                },
                {
                    path: '/workloads/daemonsets',
                    name: 'daemonsets',
                    component: () => import('@/views/workloads/DaemonSetsList.vue')
                },
                {
                    path: '/namespaces/:namespace/daemonsets/:name',
                    name: 'daemonset-detail',
                    props: true,
                    component: () => import('@/views/workloads/DaemonSetDetail.vue')
                },
                {
                    path: '/workloads/replicasets',
                    name: 'replicasets',
                    component: () => import('@/views/workloads/ReplicaSetsList.vue')
                },
                {
                    path: '/namespaces/:namespace/replicasets/:name',
                    name: 'replicaset-detail',
                    props: true,
                    component: () => import('@/views/workloads/ReplicaSetDetail.vue')
                },
                {
                    path: '/workloads/jobs',
                    name: 'jobs',
                    component: () => import('@/views/workloads/JobsList.vue')
                },
                {
                    path: '/namespaces/:namespace/jobs/:name',
                    name: 'job-detail',
                    props: true,
                    component: () => import('@/views/workloads/JobDetail.vue')
                },
                {
                    path: '/workloads/cronjobs',
                    name: 'cronjobs',
                    component: () => import('@/views/workloads/CronJobsList.vue')
                },
                {
                    path: '/namespaces/:namespace/cronjobs/:name',
                    name: 'cronjob-detail',
                    props: true,
                    component: () => import('@/views/workloads/CronJobDetail.vue')
                },
                {
                    path: '/nodes/:name',
                    name: 'node-detail',
                    props: true,
                    component: () => import('@/views/NodeDetail.vue')
                },
                {
                    path: '/namespaces/:namespace/pods/:name',
                    name: 'pod-detail',
                    props: true,
                    component: () => import('@/views/PodDetail.vue')
                },
                // Storage Routes
                {
                    path: '/storage/persistentvolumeclaims',
                    name: 'persistent-volume-claims',
                    component: () => import('@/views/storage/PersistentVolumeClaimsList.vue')
                },
                {
                    path: '/namespaces/:namespace/persistentvolumeclaims/:name',
                    name: 'persistent-volume-claim-detail',
                    props: true,
                    component: () => import('@/views/storage/PersistentVolumeClaimDetail.vue')
                },
                {
                    path: '/storage/persistentvolumes',
                    name: 'persistent-volumes',
                    component: () => import('@/views/storage/PersistentVolumesList.vue')
                },
                {
                    path: '/persistentvolumes/:name',
                    name: 'persistent-volume-detail',
                    props: true,
                    component: () => import('@/views/storage/PersistentVolumeDetail.vue')
                },
                {
                    path: '/storage/storageclasses',
                    name: 'storage-classes',
                    component: () => import('@/views/storage/StorageClassesList.vue')
                },
                {
                    path: '/storageclasses/:name',
                    name: 'storage-class-detail',
                    props: true,
                    component: () => import('@/views/storage/StorageClassDetail.vue')
                },
                {
                    path: '/storage/configmaps',
                    name: 'configmaps',
                    component: () => import('@/views/storage/ConfigMapsList.vue')
                },
                {
                    path: '/namespaces/:namespace/configmaps/:name',
                    name: 'configmap-detail',
                    props: true,
                    component: () => import('@/views/storage/ConfigMapDetail.vue')
                },
                {
                    path: '/storage/secrets',
                    name: 'secrets',
                    component: () => import('@/views/storage/SecretsList.vue')
                },
                {
                    path: '/namespaces/:namespace/secrets/:name',
                    name: 'secret-detail',
                    props: true,
                    component: () => import('@/views/storage/SecretDetail.vue')
                },
                // Network & Services Routes
                {
                    path: '/network/services',
                    name: 'services',
                    component: () => import('@/views/network/ServicesList.vue')
                },
                {
                    path: '/namespaces/:namespace/services/:name',
                    name: 'service-detail',
                    props: true,
                    component: () => import('@/views/network/ServiceDetail.vue')
                },
                {
                    path: '/network/ingresses',
                    name: 'ingresses',
                    component: () => import('@/views/network/IngressesList.vue')
                },
                {
                    path: '/namespaces/:namespace/ingresses/:name',
                    name: 'ingress-detail',
                    props: true,
                    component: () => import('@/views/network/IngressDetail.vue')
                },
                {
                    path: '/network/endpoints',
                    name: 'endpoints',
                    component: () => import('@/views/network/EndpointsList.vue')
                },
                {
                    path: '/namespaces/:namespace/endpoints/:name',
                    name: 'endpoint-detail',
                    props: true,
                    component: () => import('@/views/network/EndpointDetail.vue')
                },
                {
                    path: '/network/horizontalpodautoscalers',
                    name: 'horizontalpodautoscalers',
                    component: () => import('@/views/network/HPAList.vue')
                },
                {
                    path: '/namespaces/:namespace/horizontalpodautoscalers/:name',
                    name: 'horizontalpodautoscaler-detail',
                    props: true,
                    component: () => import('@/views/network/HPADetail.vue')
                },
                // Policies Routes
                {
                    path: '/policies/networkpolicies',
                    name: 'networkpolicies',
                    component: () => import('@/views/policies/NetworkPoliciesList.vue')
                },
                {
                    path: '/namespaces/:namespace/networkpolicies/:name',
                    name: 'networkpolicy-detail',
                    props: true,
                    component: () => import('@/views/policies/NetworkPolicyDetail.vue')
                },
                {
                    path: '/policies/resourcequotas',
                    name: 'resourcequotas',
                    component: () => import('@/views/policies/ResourceQuotasList.vue')
                },
                {
                    path: '/namespaces/:namespace/resourcequotas/:name',
                    name: 'resourcequota-detail',
                    props: true,
                    component: () => import('@/views/policies/ResourceQuotaDetail.vue')
                },
                {
                    path: '/policies/poddisruptionbudgets',
                    name: 'poddisruptionbudgets',
                    component: () => import('@/views/policies/PodDisruptionBudgetsList.vue')
                },
                {
                    path: '/namespaces/:namespace/poddisruptionbudgets/:name',
                    name: 'poddisruptionbudget-detail',
                    props: true,
                    component: () => import('@/views/policies/PodDisruptionBudgetDetail.vue')
                },
                {
                    path: '/policies/limitranges',
                    name: 'limitranges',
                    component: () => import('@/views/policies/LimitRangesList.vue')
                },
                {
                    path: '/namespaces/:namespace/limitranges/:name',
                    name: 'limitrange-detail',
                    props: true,
                    component: () => import('@/views/policies/LimitRangeDetail.vue')
                },
                // Cluster API Routes
                {
                    path: '/cluster-api/management',
                    name: 'cluster-api-management',
                    component: () => import('@/views/cluster-api/ManagementCluster.vue')
                },
                {
                    path: '/cluster-api/workload',
                    name: 'cluster-api-workload-list',
                    component: () => import('@/views/cluster-api/WorkloadClusters.vue')
                },
                {
                    path: '/cluster-api/clusters/:namespace/:name',
                    name: 'cluster-api-cluster-detail',
                    props: true,
                    component: () => import('@/views/cluster-api/ClusterDetail.vue')
                }
            ]
        },
        // Fallback for 404
        {
            path: '/:catchAll(.*)',
            name: 'not-found',
            component: () => import('@/views/NotFound.vue')
        }
    ]
});

export default router;
