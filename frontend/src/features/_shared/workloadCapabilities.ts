import type { ResourceKind } from '@/store/ui'

const RESTARTABLE_KINDS: ReadonlySet<ResourceKind> = new Set([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
])

const SCALABLE_KINDS: ReadonlySet<ResourceKind> = new Set(['Deployment', 'StatefulSet'])

export function isPausable(kind: string): boolean {
  return kind === 'Deployment'
}

export function isRestartable(kind: string): boolean {
  return RESTARTABLE_KINDS.has(kind as ResourceKind)
}

export function isScalable(kind: string): boolean {
  return SCALABLE_KINDS.has(kind as ResourceKind)
}
