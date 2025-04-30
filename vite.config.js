import vue from '@vitejs/plugin-vue';
import path from 'path'; // Ensure path is imported if you use resolve.alias
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  // Add or modify the optimizeDeps section
  optimizeDeps: {
    // Remove any 'exclude' entries for xterm
    // exclude: [
    //   '@xterm/xterm',
    //   '@xterm/addon-attach',
    //   '@xterm/addon-fit'
    // ],
    // Add 'include' instead
    include: [
      '@xterm/xterm',
      '@xterm/addon-attach',
      '@xterm/addon-fit'
    ]
  },
  server: {
    // If you are using a backend proxy, ensure it's configured correctly
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
        // Optional: You might need rewrite if your backend routes don't start with /api
        // rewrite: (path) => path.replace(/^\/api/, '') 
        
        // Add WebSocket proxy configuration
        ws: true, 
      }
    }
  }
}) 