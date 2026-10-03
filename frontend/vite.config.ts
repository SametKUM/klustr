import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Sized for the bundled monaco chunk (~4 MB), which only loads with the
    // first editor; every other chunk is well under 1 MB.
    chunkSizeWarningLimit: 4096,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/')) {
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) return 'monaco'
            if (id.includes('@xterm')) return 'xterm'
            if (id.includes('radix-ui') || id.includes('@radix-ui')) return 'radix'
            if (id.includes('@tanstack')) return 'tanstack'
            if (id.includes('lucide-react')) return 'lucide'
            if (id.includes('cmdk')) return 'cmdk'
            return 'vendor'
          }
        },
      },
    },
  },
})
