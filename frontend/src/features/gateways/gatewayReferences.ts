import type { CRDInfo } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

export const GATEWAY_API_GROUP = 'gateway.networking.k8s.io'

export type GatewayReference = {
  group: string
  kind: string
  namespace: string
  name: string
}

const CORE_REFERENCE_KINDS = new Set(['Service', 'Secret', 'ConfigMap'])
const GATEWAY_REFERENCE_KINDS = new Set([
  'Gateway', 'HTTPRoute', 'GRPCRoute', 'TLSRoute', 'TCPRoute', 'UDPRoute',
  'ListenerSet', 'BackendTLSPolicy', 'ReferenceGrant',
])

export function gatewayReferenceResource(
  reference: GatewayReference,
  namespace: string,
  context: string | null,
): SelectedResource | null {
  if (!context || !reference.name) return null
  const known = reference.group === ''
    ? CORE_REFERENCE_KINDS.has(reference.kind)
    : reference.group === GATEWAY_API_GROUP && GATEWAY_REFERENCE_KINDS.has(reference.kind)
  if (!known) return null
  return { kind: reference.kind, namespace: reference.namespace || namespace, name: reference.name, context }
}

export function gatewayReferenceLabel(reference: GatewayReference, namespace: string): string {
  return reference.namespace && reference.namespace !== namespace
    ? `${reference.namespace}/${reference.name}`
    : reference.name
}

export function gatewayResourceContexts(
  activeContexts: string[],
  catalog: Record<string, CRDInfo[]>,
  access: Record<string, Set<string>>,
  resource: string,
  kind: string,
): string[] {
  return activeContexts.filter((context) =>
    (!access[context] || access[context].has(kind)) &&
    catalog[context]?.some((crd) => crd.group === GATEWAY_API_GROUP && crd.resource === resource),
  )
}
