import { useMemo } from 'react'
import { useAccessStore } from '@/store/access'
import { useCRDStore } from '@/store/crds'
import { useActiveContexts, useEffectiveHiddenSidebarItems } from '@/store/ui'
import type { ResourceGroup } from './resourceGroups'
import { buildVisibleResourceGroups } from './visibleResourceGroups'

export function useVisibleResourceGroups(): ResourceGroup[] {
  const activeContexts = useActiveContexts()
  const crdsByContext = useCRDStore((state) => state.byContext)
  const accessByContext = useAccessStore((state) => state.byContext)
  const hiddenItems = useEffectiveHiddenSidebarItems()

  return useMemo(
    () =>
      buildVisibleResourceGroups({
        activeContexts,
        crdsByContext,
        accessByContext,
        hiddenItems,
      }),
    [activeContexts, crdsByContext, accessByContext, hiddenItems],
  )
}
