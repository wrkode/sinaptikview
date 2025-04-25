<template>
  <div class="surface-ground flex align-items-center justify-content-center min-h-screen min-w-screen overflow-hidden">
    <div class="flex flex-column align-items-center justify-content-center">
      <div class="flex justify-content-center align-items-center bg-white border-round p-5">
        <div class="flex flex-column align-items-center">
          <span class="text-blue-500 font-bold text-5xl">404</span>
          <h1 class="text-900 font-bold text-3xl lg:text-5xl mb-2">Page Not Found</h1>
          <p class="text-600 mb-5">The resource you are looking for does not exist.</p>
          <router-link to="/" class="p-button p-component p-button-primary">
            <span class="p-button-label">Go to Dashboard</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template> 