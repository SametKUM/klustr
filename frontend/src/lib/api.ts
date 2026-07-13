import {
  DeleteArgoApplication,
  ListNodeMetrics,
  ListPodMetrics,
  ReconcileFluxResource,
  SetFluxResourceSuspended,
} from '@/lib/wails/wailsjs/go/app/App'
import { generatedApi } from '@/lib/api.generated'
import type { NodeMetrics, PodMetrics } from '@/lib/api.generated'

export type * from '@/lib/api.generated'

// Wails event-only payloads do not appear in the generated models module.
export type NodeDrainProgress = {
  node: string
  phase: 'cordoning' | 'evicting' | 'waiting' | 'done' | 'error'
  total: number
  evicted: number
  pending: string[]
  error: string
}

export type ArgoCascadeMode = 'foreground' | 'background' | 'non-cascading'
export type ArgoSyncStrategy = 'hook' | 'apply'

export type FluxKind =
  | 'FluxKustomization'
  | 'FluxHelmRelease'
  | 'FluxGitRepository'
  | 'FluxHelmRepository'
  | 'FluxOCIRepository'
  | 'FluxBucket'
  | 'FluxProvider'
  | 'FluxAlert'
  | 'FluxReceiver'

export const api = {
  ...generatedApi,
  // null means the metrics API is unavailable; an empty array means it
  // answered with no rows for the selection (see ListPodMetrics in Go).
  listPodMetrics: (contextName: string, namespace: string): Promise<PodMetrics[] | null> =>
    ListPodMetrics(contextName, namespace) as Promise<PodMetrics[] | null>,
  listNodeMetrics: (contextName: string): Promise<NodeMetrics[] | null> =>
    ListNodeMetrics(contextName) as Promise<NodeMetrics[] | null>,
  deleteArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    cascade: ArgoCascadeMode,
  ): Promise<void> => DeleteArgoApplication(contextName, namespace, name, cascade),
  reconcileFluxResource: (
    contextName: string,
    kind: FluxKind,
    namespace: string,
    name: string,
  ): Promise<void> => ReconcileFluxResource(contextName, kind, namespace, name),
  setFluxResourceSuspended: (
    contextName: string,
    kind: FluxKind,
    namespace: string,
    name: string,
    suspended: boolean,
  ): Promise<void> =>
    SetFluxResourceSuspended(contextName, kind, namespace, name, suspended),
}
