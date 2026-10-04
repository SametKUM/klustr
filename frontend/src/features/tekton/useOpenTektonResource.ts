import { useCallback } from 'react'
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { TEKTON_GROUP, TEKTON_RESOURCE_BY_KIND, type TektonKind } from './tektonKinds'

// useOpenTektonResource returns a function that opens a related Tekton object
// (a run's Pipeline, a TaskRun's PipelineRun) in the detail dialog, at the
// version the context serves, keeping the back stack.
export function useOpenTektonResource(contextName: string | null) {
  const openResource = useUIStore((s) => s.openResource)
  const catalog = useCRDStore((s) => s.byContext)
  return useCallback(
    (kind: TektonKind, namespace: string, name: string) => {
      if (!contextName) return
      const crd = findCRD(catalog, contextName, TEKTON_GROUP, TEKTON_RESOURCE_BY_KIND[kind])
      if (!crd) return
      openResource({
        kind,
        namespace,
        name,
        context: contextName,
        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
      })
    },
    [catalog, contextName, openResource],
  )
}
