import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    // SEO optimizations
    assetsDir: 'assets',
    cssCodeSplit: true,
    // Generate clean URLs for better SEO
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
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
  // SEO-friendly configuration
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  // Optimize for search engines
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
