import { createContext, useContext } from 'react'

export type ResourceEditorRequest = {
  contextName?: string
  kind?: string
  apiVersion?: string
  group?: string
  resource?: string
}
export const ResourceEditorContext = createContext<(request?: ResourceEditorRequest) => void>(
  () => {},
)
export function useResourceEditor() {
  return useContext(ResourceEditorContext)
}
