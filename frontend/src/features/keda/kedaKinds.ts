import type { SelectedResource } from '@/store/ui'

export const KEDA_GROUP = 'keda.sh'
export const KEDA_SCALEDOBJECT_RESOURCE = 'scaledobjects'
export const KEDA_SCALEDJOB_RESOURCE = 'scaledjobs'
export const KEDA_TRIGGERAUTHENTICATION_RESOURCE = 'triggerauthentications'
export const KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE = 'clustertriggerauthentications'

export type KEDAKind = 'ScaledObject' | 'ScaledJob' | 'TriggerAuthentication' | 'ClusterTriggerAuthentication'

export const KEDA_KIND_RESOURCE: Record<KEDAKind, string> = {
  ScaledObject: KEDA_SCALEDOBJECT_RESOURCE,
  ScaledJob: KEDA_SCALEDJOB_RESOURCE,
  TriggerAuthentication: KEDA_TRIGGERAUTHENTICATION_RESOURCE,
  ClusterTriggerAuthentication: KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE,
}

// kedaKindOf identifies a KEDA CR by group as well as kind, so another
// group's ScaledObject (there is none today) cannot borrow KEDA's tabs.
export function kedaKindOf(resource: SelectedResource | null): KEDAKind | null {
  if (!resource || resource.gvr?.group !== KEDA_GROUP) return null
  return resource.kind in KEDA_KIND_RESOURCE ? (resource.kind as KEDAKind) : null
}
