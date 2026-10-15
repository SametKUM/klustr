import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { ResourceEditorContext, type ResourceEditorRequest } from './resourceEditorContext'

const ResourceEditor = lazy(() => import('./ResourceEditor'))

export function ResourceEditorProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ serial: number; target: ResourceEditorRequest } | null>(
    null,
  )
  const [open, setOpen] = useState(false)
  const openEditor = useCallback((target: ResourceEditorRequest = {}) => {
    setRequest((previous) => ({ serial: (previous?.serial ?? 0) + 1, target }))
    setOpen(true)
  }, [])
  return (
    <ResourceEditorContext.Provider value={openEditor}>
      {children}
      {request && (
        <Suspense fallback={null}>
          <ResourceEditor open={open} onOpenChange={setOpen} request={request} />
        </Suspense>
      )}
    </ResourceEditorContext.Provider>
  )
}
