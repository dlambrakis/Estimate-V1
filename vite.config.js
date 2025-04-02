import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Define the root directory for Vite relative to this config file
  // and the public directory for static assets.
  root: '.', // Project root contains index.html
  publicDir: 'public', // Optional: If you have a public directory for static assets in root
  build: {
    // Output directory relative to the root
    outDir: 'dist',
  },
  server: {
    port: 5173, // Frontend dev server port
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend server address (running via node server.js)
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/api/, '') // Keep this commented unless needed
      }
    }
  }
})
