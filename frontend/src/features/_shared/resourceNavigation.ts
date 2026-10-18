import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { SelectedResource } from '@/store/ui'

export type ResourceNavigation = {
  resource: SelectedResource
  index: number
  total: number
  previous: (() => void) | null
  next: (() => void) | null
}

export const ResourceNavigationContext = createContext<ResourceNavigation | null>(null)
export const ResourceNavigationDispatchContext = createContext<Dispatch<
  SetStateAction<ResourceNavigation | null>
> | null>(null)
