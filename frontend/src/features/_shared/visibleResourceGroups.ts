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
  crdsByContext: Record<string, CRDInfo[]>
  accessByContext: Record<string, Set<string>>
  hiddenItems: ResourceView[]
}

const CRD_REQUIREMENTS: Partial<Record<ResourceView, { group: string; resource: string }>> = {
  argocdapplications: { group: 'argoproj.io', resource: 'applications' },
  argocdappprojects: { group: 'argoproj.io', resource: 'appprojects' },
  argocdapplicationsets: { group: 'argoproj.io', resource: 'applicationsets' },
  gateways: { group: 'gateway.networking.k8s.io', resource: 'gateways' },
  httproutes: { group: 'gateway.networking.k8s.io', resource: 'httproutes' },
  grpcroutes: { group: 'gateway.networking.k8s.io', resource: 'grpcroutes' },
  gatewayclasses: {
    group: 'gateway.networking.k8s.io',
    resource: 'gatewayclasses',
  },
  referencegrants: {
    group: 'gateway.networking.k8s.io',
    resource: 'referencegrants',
  },
  karpenternodepools: { group: 'karpenter.sh', resource: 'nodepools' },
  karpenternodeclaims: { group: 'karpenter.sh', resource: 'nodeclaims' },
  fluxkustomizations: {
    group: 'kustomize.toolkit.fluxcd.io',
    resource: 'kustomizations',
  },
  fluxhelmreleases: {
    group: 'helm.toolkit.fluxcd.io',
    resource: 'helmreleases',
  },
  fluxgitrepositories: {
    group: 'source.toolkit.fluxcd.io',
    resource: 'gitrepositories',
  },
  fluxhelmrepositories: {
    group: 'source.toolkit.fluxcd.io',
    resource: 'helmrepositories',
  },
  fluxocirepositories: {
    group: 'source.toolkit.fluxcd.io',
    resource: 'ocirepositories',
  },
  fluxbuckets: { group: 'source.toolkit.fluxcd.io', resource: 'buckets' },
  fluxproviders: {
    group: 'notification.toolkit.fluxcd.io',
    resource: 'providers',
  },
  fluxalerts: { group: 'notification.toolkit.fluxcd.io', resource: 'alerts' },
  fluxreceivers: {
    group: 'notification.toolkit.fluxcd.io',
    resource: 'receivers',
  },
  istiovirtualservices: {
    group: 'networking.istio.io',
    resource: 'virtualservices',
  },
  istiodestinationrules: {
    group: 'networking.istio.io',
    resource: 'destinationrules',
  },
  istiopeerauthentications: {
    group: 'security.istio.io',
    resource: 'peerauthentications',
  },
  certmanagercertificates: {
    group: 'cert-manager.io',
    resource: 'certificates',
  },
  certmanagercertificaterequests: {
    group: 'cert-manager.io',
    resource: 'certificaterequests',
  },
  certmanagerorders: { group: 'acme.cert-manager.io', resource: 'orders' },
  certmanagerchallenges: {
    group: 'acme.cert-manager.io',
    resource: 'challenges',
  },
  certmanagerissuers: { group: 'cert-manager.io', resource: 'issuers' },
  certmanagerclusterissuers: {
    group: 'cert-manager.io',
    resource: 'clusterissuers',
  },
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
    CERT_MANAGER_GROUP_NAV,
    ARGO_GROUP,
    KARPENTER_GROUP,
    FLUX_GROUP,
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
            crdsByContext[contextName]?.some(
              (crd) => crd.group === requirement.group && crd.resource === requirement.resource,
            ),
          )
        return (
          capabilityVisible &&
          (!item.kind || kindAccessibleInAny(accessByContext, activeContexts, item.kind)) &&
          (!item.view || !hidden.has(item.view))
        )
      }),
    }))
    .filter((group) => group.items.length > 0)
}
