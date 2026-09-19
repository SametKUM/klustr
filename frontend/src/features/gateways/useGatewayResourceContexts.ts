import { useMemo } from 'react'
import { useAccessStore } from '@/store/access'
import { useCRDStore } from '@/store/crds'
import { useActiveContexts } from '@/store/ui'
import { gatewayResourceContexts } from './gatewayReferences'

export function useGatewayResourceContexts(resource: string, kind: string): string[] {
  const activeContexts = useActiveContexts()
  const catalog = useCRDStore((state) => state.byContext)
  const access = useAccessStore((state) => state.byContext)
  return useMemo(
    () => gatewayResourceContexts(activeContexts, catalog, access, resource, kind),
    [activeContexts, catalog, access, resource, kind],
  )
}
