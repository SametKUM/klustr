import type { CRDInfo } from '@/lib/api'
import { kindAccessibleInAny } from '@/store/access'
import type { ResourceView } from '@/store/ui'
import { INTEGRATION_RESOURCES } from '@/lib/integrationCatalog.generated'
import {
  ARGO_GROUP,
  CERT_MANAGER_GROUP_NAV,
  CILIUM_GROUP_NAV,
  FLUX_GROUP,
  GATEWAY_GROUP,
  HELM_GROUP,
  ISTIO_GROUP,
  KARPENTER_GROUP,
  KYVERNO_GROUP_NAV,
  RESOURCE_GROUPS,
  TEKTON_GROUP_NAV,
  type ResourceGroup,
} from './resourceGroups'

type VisibleResourceGroupsInput = {
  activeContexts: string[]
  crdsByContext: Record<string, CRDInfo[]>
  accessByContext: Record<string, Set<string>>
  hiddenItems: ResourceView[]
}

// Gateway API views read through the typed gateway-api client rather than the
// dynamic CR path the integration catalog covers, so their CRDs are listed here.
const GATEWAY_API_REQUIREMENTS = Object.fromEntries(
  [
    'gateways',
    'httproutes',
    'grpcroutes',
    'tlsroutes',
    'tcproutes',
    'udproutes',
    'listenersets',
    'backendtlspolicies',
    'gatewayclasses',
    'referencegrants',
  ].map((resource) => [resource, { group: 'gateway.networking.k8s.io', resource }]),
)

// A view with a requirement shows only while an active context serves its CRD.
const CRD_REQUIREMENTS: Partial<Record<ResourceView, { group: string; resource: string }>> = {
  ...GATEWAY_API_REQUIREMENTS,
  ...Object.fromEntries(INTEGRATION_RESOURCES.map(({ view, group, resource }) => [view, { group, resource }])),
}

export function buildVisibleResourceGroups({
  activeContexts,
  crdsByContext,
  accessByContext,
  hiddenItems,
}: VisibleResourceGroupsInput): ResourceGroup[] {
  const groups: ResourceGroup[] = [
    ...RESOURCE_GROUPS,
    GATEWAY_GROUP,
    ISTIO_GROUP,
    CILIUM_GROUP_NAV,
    CERT_MANAGER_GROUP_NAV,
    KYVERNO_GROUP_NAV,
    ARGO_GROUP,
    KARPENTER_GROUP,
    FLUX_GROUP,
    TEKTON_GROUP_NAV,
    HELM_GROUP,
  ]
  const hidden = new Set<string>(hiddenItems)

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const requirement = item.view ? CRD_REQUIREMENTS[item.view] : undefined
        const capabilityVisible =
          !requirement ||
          activeContexts.some((contextName) =>
            (!item.kind || !accessByContext[contextName] || accessByContext[contextName].has(item.kind)) &&
              crdsByContext[contextName]?.some(
                (crd) => crd.group === requirement.group && crd.resource === requirement.resource,
              ),
          )
        return (
          capabilityVisible &&
          (requirement || !item.kind || kindAccessibleInAny(accessByContext, activeContexts, item.kind)) &&
          (!item.view || !hidden.has(item.view))
        )
      }),
    }))
    .filter((group) => group.items.length > 0)
}
