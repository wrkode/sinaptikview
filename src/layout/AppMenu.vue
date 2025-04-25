<script setup>
import { ref } from 'vue';


// Track which sections are expanded/collapsed
const expandedSections = ref({});

// Toggle the expansion state of a section
const toggleSection = (index) => {
  expandedSections.value[index] = !expandedSections.value[index];
};

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
        icon: 'pi pi-fw pi-database', 
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
        <li v-for="(item, i) in model" :key="i" class="menu-category">
            <div class="menu-header" @click="toggleSection(i)">
                <i :class="item.icon" class="menu-icon"></i>
                <span class="menu-category-label">{{ item.label }}</span>
                <i :class="expandedSections[i] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="menu-toggle-icon"></i>
            </div>
            <Transition name="menu-slide">
                <ul v-show="expandedSections[i]" class="menu-items">
                    <li v-for="(subitem, j) in item.items" :key="j" class="menu-item">
                        <router-link :to="subitem.to" class="menu-link">
                            <i :class="subitem.icon" class="menu-item-icon"></i>
                            <span class="menu-item-text">{{ subitem.label }}</span>
                        </router-link>
                    </li>
                </ul>
            </Transition>
        </li>
    </ul>
</template>

<style lang="scss" scoped>
.layout-menu {
    padding: 0;
    margin: 0;
    list-style-type: none;
}

.menu-category {
    margin-bottom: 0.5rem;
}

.menu-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
    
    &:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }
}

.menu-icon {
    margin-right: 0.5rem;
}

.menu-category-label {
    flex: 1;
    font-weight: 600;
}

.menu-toggle-icon {
    font-size: 0.875rem;
    transition: transform 0.2s;
}

.menu-items {
    padding-left: 1rem;
    overflow: hidden;
    list-style-type: none;
}

.menu-item {
    margin: 0.3rem 0;
}

.menu-link {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    color: inherit;
    text-decoration: none;
    border-radius: 4px;
    transition: background-color 0.2s;
    
    &:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }
    
    &.router-link-active {
        background-color: var(--primary-color, #3B82F6);
        color: var(--primary-color-text, white);
    }
}

.menu-item-icon {
    margin-right: 0.5rem;
}

// Transition for menu items
.menu-slide-enter-active,
.menu-slide-leave-active {
    transition: max-height 0.3s ease, opacity 0.2s ease;
    max-height: 1000px;
    opacity: 1;
    overflow: hidden;
}

.menu-slide-enter-from,
.menu-slide-leave-to {
    max-height: 0;
    opacity: 0;
}
</style>
