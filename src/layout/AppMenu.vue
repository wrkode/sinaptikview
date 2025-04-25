<script setup>
import { ref } from 'vue';

import AppMenuItem from './AppMenuItem.vue';

// Define the new menu structure
const model = ref([
    {
        label: 'Cluster', 
        icon: 'pi pi-fw pi-server',
        items: [
            {
                label: 'Nodes', 
                icon: 'pi pi-fw pi-box', 
                to: '/nodes' // Route for Nodes list page
            },
            {
                label: 'Namespaces', 
                icon: 'pi pi-fw pi-folder', 
                to: '/namespaces' // Route for Namespaces list page
            }
        ]
    },
    {
        label: 'Workloads',
        icon: 'pi pi-fw pi-sync', // Example icon
        items: [
            {
                label: 'Deployments', 
                icon: 'pi pi-fw pi-clone', // Example icon
                to: '/workloads/deployments' // Route for Deployments list page
            },
             {
                label: 'Pods', 
                icon: 'pi pi-fw pi-stop-circle', // Example icon
                to: '/workloads/pods' // Route for Pods list page
            },
            {
                label: 'StatefulSets', 
                icon: 'pi pi-fw pi-database', // Example icon
                to: '/workloads/statefulsets' // Route for StatefulSets list page
            },
             {
                label: 'DaemonSets', 
                icon: 'pi pi-fw pi-cog', // Example icon
                to: '/workloads/daemonsets' // Route for DaemonSets list page
            },
             {
                label: 'ReplicaSets', 
                icon: 'pi pi-fw pi-copy', // Example icon
                to: '/workloads/replicasets' // Route for ReplicaSets list page
            },
              {
                label: 'Jobs', 
                icon: 'pi pi-fw pi-play', // Example icon
                to: '/workloads/jobs' // Route for Jobs list page
            },
              {
                label: 'CronJobs', 
                icon: 'pi pi-fw pi-calendar', // Example icon
                to: '/workloads/cronjobs' // Route for CronJobs list page
            },
        ]
    },
    {
        label: 'Storage',
        icon: 'pi pi-fw pi-hdd', 
        items: [
            {
                label: 'Persistent Volume Claims',
                icon: 'pi pi-fw pi-paperclip',
                to: '/storage/persistentvolumeclaims'
            },
            {
                label: 'Persistent Volumes',
                icon: 'pi pi-fw pi-inbox',
                to: '/storage/persistentvolumes'
            },
            {
                label: 'Storage Classes',
                icon: 'pi pi-fw pi-list',
                to: '/storage/storageclasses'
            },
            {
                label: 'ConfigMaps',
                icon: 'pi pi-fw pi-map',
                to: '/storage/configmaps'
            },
            {
                label: 'Secrets',
                icon: 'pi pi-fw pi-lock',
                to: '/storage/secrets'
            }
        ]
    },
    {
        label: 'Network & Services',
        icon: 'pi pi-fw pi-share-alt',
        items: [
            {
                label: 'Services',
                icon: 'pi pi-fw pi-sitemap',
                to: '/network/services'
            },
            {
                label: 'Ingresses',
                icon: 'pi pi-fw pi-sign-in',
                to: '/network/ingresses'
            },
            {
                label: 'Endpoints',
                icon: 'pi pi-fw pi-flag',
                to: '/network/endpoints'
            },
            {
                label: 'Horizontal Pod Autoscalers',
                icon: 'pi pi-fw pi-sliders-h',
                to: '/network/horizontalpodautoscalers'
            }
        ]
    },
    {
        label: 'Policies',
        icon: 'pi pi-fw pi-shield',
        items: [
            {
                label: 'Network Policies',
                icon: 'pi pi-fw pi-shield',
                to: '/policies/networkpolicies'
            },
            {
                label: 'Resource Quotas',
                icon: 'pi pi-fw pi-chart-bar',
                to: '/policies/resourcequotas'
            },
            {
                label: 'Pod Disruption Budgets',
                icon: 'pi pi-fw pi-sync',
                to: '/policies/poddisruptionbudgets'
            },
            {
                label: 'Limit Ranges',
                icon: 'pi pi-fw pi-sort-amount-up',
                to: '/policies/limitranges'
            }
        ]
    }
    // Add other top-level categories like Networking, Storage, Config later
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
