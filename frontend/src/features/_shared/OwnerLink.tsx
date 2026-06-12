import type { OwnerRef } from '@/lib/api'
import { useUIStore, type ResourceKind } from '@/store/ui'

const NAVIGABLE_KINDS = new Set<ResourceKind>([
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'Job',
  'CronJob',
  'Service',
  'ConfigMap',
  'Secret',
  'Ingress',
  'Node',
  'Namespace',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
  'NetworkPolicy',
  'HorizontalPodAutoscaler',
  'PodDisruptionBudget',
  'EndpointSlice',
  'Endpoints',
  'ResourceQuota',
  'LimitRange',
  'IngressClass',
  'PriorityClass',
  'RuntimeClass',
  'Lease',
  'MutatingWebhookConfiguration',
  'ValidatingWebhookConfiguration',
])

function isNavigableKind(kind: string): kind is ResourceKind {
  return NAVIGABLE_KINDS.has(kind as ResourceKind)
}

export function OwnerLink({
  owner,
  namespace,
  context,
}: {
  owner: OwnerRef
  namespace: string
  context?: string | null
}) {
  const openResource = useUIStore((s) => s.openResource)
  if (!isNavigableKind(owner.kind)) {
    return <span>{owner.name}</span>
  }
  return (
    <button
      type="button"
      onClick={() =>
        openResource({
          kind: owner.kind as ResourceKind,
          namespace,
          name: owner.name,
          context: context ?? undefined,
        })
      }
      className="cursor-pointer text-left hover:underline"
    >
      {owner.name}
    </button>
  )
}
