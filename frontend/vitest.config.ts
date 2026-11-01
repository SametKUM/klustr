import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Let jsdom provide Web Storage instead of Node's file-backed experimental global.
    execArgv: ['--no-experimental-webstorage'],
    globals: false,
    alias: {
      '@wailsio/runtime': path.resolve(import.meta.dirname, './src/test/wailsRuntime.ts'),
    },
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
