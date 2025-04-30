# SynaptikView - Modern Kubernetes Dashboard

<div align="center">
  <img src="public/screenshot.png" alt="SynaptikView Screenshot" width="600"/>
  <p>A lightweight, modern dashboard for Kubernetes cluster management</p>
</div>

## Overview

SynaptikView is a responsive web application that provides a clean, intuitive interface for Kubernetes cluster management. It offers real-time monitoring, resource visualization, and management capabilities designed to simplify operations for both beginners and experienced Kubernetes administrators.

### Key Features

- **Cluster Overview Dashboard**: Real-time metrics with visual charts for CPU, memory, pods, and nodes (if metrics server is available - *future feature*).
- **Resource Management**: View details for various Kubernetes resources:
  - **Workloads**: Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, and Pods.
  - **Network & Services**: Services, Ingresses, Endpoints, and Network Policies.
  - **Storage**: PersistentVolumes, PersistentVolumeClaims, StorageClasses, ConfigMaps, and Secrets.
  - **Policies**: Resource Quotas, LimitRanges, and Pod Disruption Budgets.
  - **Namespaces**: List, view details, and **create new namespaces** with optional **ResourceQuotas**.
- **Cluster API Integration**: View CAPI Management and Workload Clusters, Machines.
- **Interactive Pod Features**: 
    - **Exec Terminal**: Open an interactive shell (`sh`) directly into running containers.
    - **Log Viewer**: View container logs with options for tail lines and previous container instances.
- **Event Monitoring**: Centralized event tracking across all namespaces or filtered by resource.
- **Multi-Namespace Support**: View and filter resources across all namespaces or zoom in on specific ones.
- **Modern UI/UX**: Responsive interface built with PrimeVue.

## Technology Stack

- **Frontend**: Vue.js 3 (Composition API), PrimeVue components, Tailwind CSS, Chart.js.
- **Backend**: Node.js with Express.
- **Kubernetes Integration**: Official Kubernetes JavaScript client (`@kubernetes/client-node`), direct `kubectl` execution via `child_process` for some features.
- **Terminal Integration**: `node-pty` for server-side pseudo-terminal management.
- **YAML Handling**: `js-yaml`.

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- A running Kubernetes cluster (local or remote)
- `kubectl` **installed and configured** with access to your cluster. **Crucially, `kubectl` must be available in the environment where the backend server runs.**
- **Build Tools for `node-pty`**: `node-pty` requires native compilation. Ensure you have the necessary build tools installed for your operating system (e.g., `python`, `make`, a C++ compiler like GCC or Visual Studio Build Tools). See [node-pty prerequisites](https://github.com/microsoft/node-pty#installation) for details.

## Installation

```bash
# Clone the repository
# git clone https://github.com/wrkode/sinaptikview.git
# cd sinaptikview

# Install root dependencies (for frontend and build scripts)
npm install

# Install backend dependencies
cd server
npm install
cd ..

# Start the development server (runs frontend and backend concurrently)
npm run dev
```

## Running the Application

After installation, run:

```bash
npm run dev
```

- The **Frontend** will be available at `http://localhost:5173` (or the next available port if 5173 is busy).
- The **Backend API** runs on `http://localhost:3001`.

## Configuration

- **Kubernetes Context**: SynaptikView automatically uses your default Kubernetes configuration (`~/.kube/config` or `KUBECONFIG` env variable) for API calls made via the `@kubernetes/client-node` library and for `kubectl` commands executed by the backend.
- Ensure the context selected by `kubectl` has the necessary permissions to view and manage cluster resources.

## Usage

1.  **Cluster Dashboard**: Navigate to the dashboard to see an overview (currently basic).
2.  **Resource Navigation**: Use the sidebar menu to navigate between different resource types (Workloads, Network, Storage, etc.).
3.  **Namespace Management**: Go to the "Namespaces" view to list, inspect, or create new namespaces.
4.  **Resource Details**: Click on a resource name (e.g., a Pod, Deployment) to view its details, status, events, and YAML.
5.  **Pod Interaction**: On the Pod Detail page, use the "Logs" and "Exec" buttons on containers for inspection and interaction.
6.  **Cluster API**: Explore CAPI resources under the "Cluster API" menu section.

## Development

```bash
# Run frontend and backend concurrently in development mode
npm run dev

# Run just the frontend (Vite dev server)
npm run dev:frontend

# Run just the backend (Nodemon)
npm run dev:backend

# Build for production (creates frontend build in /dist)
npm run build

# Lint frontend code
npm run lint
```

## Project Structure

```
synaptikview/          # Project Root
├── public/             # Static assets (favicon, etc.)
├── server/             # Backend server code
│   ├── node_modules/   # Backend dependencies
│   ├── package.json    # Backend package config
│   └── server.js       # Express API server
├── src/                # Frontend source code (Vue)
│   ├── assets/         # Frontend assets (styles, etc.)
│   ├── components/     # Reusable Vue components
│   ├── layout/         # App layout components (sidebar, topbar)
│   ├── router/         # Vue Router configuration
│   ├── views/          # Page-level components
│   │   ├── cluster-api/  # Cluster API related views
│   │   ├── network/      # Network resource views
│   │   ├── policies/     # Policy resource views
│   │   ├── storage/      # Storage resource views
│   │   └── workloads/    # Workload resource views
│   ├── App.vue         # Root Vue component
│   └── main.js         # Frontend entry point
├── dist/               # Production build output (generated by `npm run build`)
├── node_modules/       # Root/Frontend dependencies
├── .eslintrc.cjs       # ESLint configuration
├── .gitignore          # Git ignore rules
├── index.html          # Main HTML template for Vite
├── LICENSE             # Project License (Apache 2.0)
├── package-lock.json   # Dependency lockfile
├── package.json        # Root package config (frontend deps, scripts)
├── postcss.config.js   # PostCSS configuration
├── README.md           # This file
├── tailwind.config.js  # Tailwind CSS configuration
└── vite.config.js      # Vite configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Vue.js](https://vuejs.org/) and [PrimeVue](https://primefaces.org/primevue/)
- Kubernetes client provided by [kubernetes-client/javascript](https://github.com/kubernetes-client/javascript)
- Terminal emulation via [node-pty](https://github.com/microsoft/node-pty)
- Charts powered by [Chart.js](https://www.chartjs.org/)

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/wrkode">wrkode</a></p>
</div>
