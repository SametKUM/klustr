import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './style.css'
import App from './App'
import { ErrorBoundary } from '@/features/_shared/ErrorBoundary'
import { ErrorRecovery } from '@/features/_shared/ErrorRecovery'

const container = document.getElementById('root')
const root = createRoot(container!)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { enabled: false }, // Klustr drives queries through informer events, not query cache
  },
})

const render = () => root.render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ error, componentStack, reset }) => (
        <ErrorRecovery
          title="Klustr encountered an unexpected error"
          description="The interface stopped before it could recover safely. You can try rendering it again or reload the application."
          error={error}
          componentStack={componentStack}
          onRetry={reset}
          onReload={() => window.location.reload()}
          fullscreen
        />
      )}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// A perf probe build (hack/perf) instruments the Wails bridge before the app
// subscribes to anything. Every other build constant-folds this branch away.
if (import.meta.env.VITE_KLUSTR_PERF === '1') {
  void import('./perf/probe').then((probe) => {
    probe.install()
    render()
  })
} else {
  render()
}
