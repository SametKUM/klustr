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
    chunkSizeWarningLimit: 1024,
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
