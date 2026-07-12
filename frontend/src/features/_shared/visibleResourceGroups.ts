import type { CRDInfo } from '@/lib/api'
import { kindAccessibleInAny } from '@/store/access'
import type { ResourceView } from '@/store/ui'
import {
  ARGO_GROUP,
  CERT_MANAGER_GROUP_NAV,
  FLUX_GROUP,
  GATEWAY_GROUP,
  HELM_GROUP,
  ISTIO_GROUP,
  KARPENTER_GROUP,
  RESOURCE_GROUPS,
  type ResourceGroup,
} from './resourceGroups'

type VisibleResourceGroupsInput = {
  activeContexts: string[]
  crds: CRDInfo[]
  accessByContext: Record<string, Set<string>>
  hiddenItems: ResourceView[]
}

export function buildVisibleResourceGroups({
  activeContexts,
  crds,
  accessByContext,
  hiddenItems,
}: VisibleResourceGroupsInput): ResourceGroup[] {
  const isAggregated = activeContexts.length >= 2
  const hasGatewayAPI = !isAggregated && crds.some((c) => c.group === 'gateway.networking.k8s.io')
  const hasArgoApplications =
    !isAggregated &&
    crds.some((c) => c.group === 'argoproj.io' && c.resource === 'applications')
  const hasKarpenter = !isAggregated && crds.some((c) => c.group === 'karpenter.sh')
  const hasFluxCD =
    !isAggregated &&
    crds.some((c) => c.group === 'kustomize.toolkit.fluxcd.io' && c.resource === 'kustomizations')
  const hasIstio = !isAggregated && crds.some((c) => c.group === 'networking.istio.io')
  const hasCertManager =
    !isAggregated &&
    crds.some((c) => c.group === 'cert-manager.io' && c.resource === 'certificates')

  const groups: ResourceGroup[] = [
    ...RESOURCE_GROUPS,
    ...(hasGatewayAPI ? [GATEWAY_GROUP] : []),
    ...(hasIstio ? [ISTIO_GROUP] : []),
    ...(hasCertManager ? [CERT_MANAGER_GROUP_NAV] : []),
    ...(hasArgoApplications ? [ARGO_GROUP] : []),
    ...(hasKarpenter ? [KARPENTER_GROUP] : []),
    ...(hasFluxCD ? [FLUX_GROUP] : []),
    HELM_GROUP,
  ]
  const hidden = new Set<string>(hiddenItems)

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.kind || kindAccessibleInAny(accessByContext, activeContexts, item.kind)) &&
          (!item.view || !hidden.has(item.view)),
      ),
    }))
    .filter((group) => group.items.length > 0)
}
