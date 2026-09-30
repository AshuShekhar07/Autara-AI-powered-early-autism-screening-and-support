import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Recharts (+ d3) is ~530 kB minified on its own; it is lazy-loaded so only chart pages pay for it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // keep the heavy libraries in their own cached chunks (and each under the 500 kB warning limit)
        manualChunks: {
          recharts: ['recharts'],
          firebase: ['firebase/app', 'firebase/auth'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
