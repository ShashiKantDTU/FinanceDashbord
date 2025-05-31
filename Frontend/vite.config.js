import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Set a specific port
    strictPort: true, // Fail if port is already in use
  },
  preview: {
    host: '0.0.0.0', // Allow access from network for preview mode
    port: 5173,
    strictPort: true,
  },
})
