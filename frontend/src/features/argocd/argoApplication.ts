import type { SelectedResource } from '@/store/ui'

export function isArgoApplication(resource: SelectedResource): boolean {
  if (resource.kind === 'cr:argoproj.io/applications') return true
  return resource.kind === 'Application' && resource.gvr?.group === 'argoproj.io'
}
