import { useMemo } from 'react'
import { useAccessStore } from '@/store/access'
import { useCRDStore } from '@/store/crds'
import {
  useActiveContexts,
  useEffectiveHiddenSidebarItems,
} from '@/store/ui'
import type { ResourceGroup } from './resourceGroups'
import { buildVisibleResourceGroups } from './visibleResourceGroups'

export function useVisibleResourceGroups(): ResourceGroup[] {
  const activeContexts = useActiveContexts()
  const crds = useCRDStore((state) => state.crds)
  const accessByContext = useAccessStore((state) => state.byContext)
  const hiddenItems = useEffectiveHiddenSidebarItems()

  return useMemo(
    () => buildVisibleResourceGroups({ activeContexts, crds, accessByContext, hiddenItems }),
    [activeContexts, crds, accessByContext, hiddenItems],
  )
}
