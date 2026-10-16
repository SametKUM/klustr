import type { ReactNode } from 'react'
import type { IntegrationView } from '@/lib/integrationCatalog.generated'
import { ApplicationsView } from '@/features/argocd/ApplicationsView'
import { AppProjectsView } from '@/features/argocd/AppProjectsView'
import { ApplicationSetsView } from '@/features/argocd/ApplicationSetsView'
import { CertificatesView } from '@/features/cert-manager/CertificatesView'
import { IssuersView } from '@/features/cert-manager/IssuersView'
import { CertificateRequestsView } from '@/features/cert-manager/CertificateRequestsView'
import { OrdersView } from '@/features/cert-manager/OrdersView'
import { ChallengesView } from '@/features/cert-manager/ChallengesView'
import { CiliumResourcesView } from '@/features/cilium/CiliumResourcesView'
import { CILIUM_RESOURCES, type CiliumView } from '@/features/cilium/ciliumKinds'
import {
  FluxImageRepositoriesView,
  FluxImagePoliciesView,
  FluxImageUpdateAutomationsView,
} from '@/features/flux/FluxImageViews'
import { FluxKustomizationsView } from '@/features/flux/FluxKustomizationsView'
import { FluxHelmReleasesView } from '@/features/flux/FluxHelmReleasesView'
import { FluxGitRepositoriesView } from '@/features/flux/FluxGitRepositoriesView'
import { FluxHelmRepositoriesView } from '@/features/flux/FluxHelmRepositoriesView'
import { FluxOCIRepositoriesView } from '@/features/flux/FluxOCIRepositoriesView'
import { FluxBucketsView } from '@/features/flux/FluxBucketsView'
import { FluxProvidersView } from '@/features/flux/FluxProvidersView'
import { FluxAlertsView } from '@/features/flux/FluxAlertsView'
import { FluxReceiversView } from '@/features/flux/FluxReceiversView'
import { IstioVirtualServicesView } from '@/features/istio/IstioVirtualServicesView'
import { IstioDestinationRulesView } from '@/features/istio/IstioDestinationRulesView'
import { IstioPeerAuthenticationsView } from '@/features/istio/IstioPeerAuthenticationsView'
import {
  IstioAuthorizationPoliciesView,
  IstioGatewaysView,
  IstioRequestAuthenticationsView,
  IstioServiceEntriesView,
  IstioSidecarsView,
} from '@/features/istio/IstioViews'
import { KEDAScaledJobsView, KEDAScaledObjectsView, KEDATriggerAuthenticationsView } from '@/features/keda/KEDAViews'
import { KarpenterNodePoolsView } from '@/features/karpenter-nodepools/KarpenterNodePoolsView'
import { KarpenterNodeClaimsView } from '@/features/karpenter-nodeclaims/KarpenterNodeClaimsView'
import { KarpenterEC2NodeClassesView } from '@/features/karpenter-nodeclasses/KarpenterEC2NodeClassesView'
import { KyvernoPoliciesView } from '@/features/kyverno/KyvernoPoliciesView'
import { KyvernoValidatingPoliciesView } from '@/features/kyverno/KyvernoValidatingPoliciesView'
import { KyvernoPolicyExceptionsView } from '@/features/kyverno/KyvernoPolicyExceptionsView'
import { PolicyReportsView } from '@/features/kyverno/PolicyReportsView'
import { TektonPipelineRunsView } from '@/features/tekton/TektonPipelineRunsView'
import { TektonTaskRunsView } from '@/features/tekton/TektonTaskRunsView'
import { TektonPipelinesView } from '@/features/tekton/TektonPipelinesView'
import { TektonTasksView } from '@/features/tekton/TektonTasksView'

const CILIUM_LIST_VIEWS = Object.fromEntries(
  (Object.keys(CILIUM_RESOURCES) as CiliumView[]).map((view) => [view, () => <CiliumResourcesView resource={view} />]),
) as Record<CiliumView, () => ReactNode>

// INTEGRATION_LIST_VIEWS renders the list of every catalog resource. Keyed by
// IntegrationView, so a resource added to the catalog fails typecheck until
// its view is registered here.
export const INTEGRATION_LIST_VIEWS: Record<IntegrationView, () => ReactNode> = {
  ...CILIUM_LIST_VIEWS,
  argocdapplications: () => <ApplicationsView />,
  argocdappprojects: () => <AppProjectsView />,
  argocdapplicationsets: () => <ApplicationSetsView />,
  certmanagercertificates: () => <CertificatesView />,
  certmanagerissuers: () => <IssuersView cluster={false} />,
  certmanagerclusterissuers: () => <IssuersView cluster />,
  certmanagercertificaterequests: () => <CertificateRequestsView />,
  certmanagerorders: () => <OrdersView />,
  certmanagerchallenges: () => <ChallengesView />,
  fluxkustomizations: () => <FluxKustomizationsView />,
  fluxhelmreleases: () => <FluxHelmReleasesView />,
  fluxgitrepositories: () => <FluxGitRepositoriesView />,
  fluxhelmrepositories: () => <FluxHelmRepositoriesView />,
  fluxocirepositories: () => <FluxOCIRepositoriesView />,
  fluxbuckets: () => <FluxBucketsView />,
  fluxproviders: () => <FluxProvidersView />,
  fluxalerts: () => <FluxAlertsView />,
  fluxreceivers: () => <FluxReceiversView />,
  fluximagerepositories: () => <FluxImageRepositoriesView />,
  fluximagepolicies: () => <FluxImagePoliciesView />,
  fluximageupdateautomations: () => <FluxImageUpdateAutomationsView />,
  karpenternodepools: () => <KarpenterNodePoolsView />,
  karpenternodeclaims: () => <KarpenterNodeClaimsView />,
  karpenterec2nodeclasses: () => <KarpenterEC2NodeClassesView />,
  kedascaledobjects: () => <KEDAScaledObjectsView />,
  kedascaledjobs: () => <KEDAScaledJobsView />,
  kedatriggerauthentications: () => <KEDATriggerAuthenticationsView cluster={false} />,
  kedaclustertriggerauthentications: () => <KEDATriggerAuthenticationsView cluster />,
  istiovirtualservices: () => <IstioVirtualServicesView />,
  istiodestinationrules: () => <IstioDestinationRulesView />,
  istiopeerauthentications: () => <IstioPeerAuthenticationsView />,
  istiogateways: () => <IstioGatewaysView />,
  istioserviceentries: () => <IstioServiceEntriesView />,
  istiosidecars: () => <IstioSidecarsView />,
  istioauthorizationpolicies: () => <IstioAuthorizationPoliciesView />,
  istiorequestauthentications: () => <IstioRequestAuthenticationsView />,
  tektonpipelineruns: () => <TektonPipelineRunsView />,
  tektontaskruns: () => <TektonTaskRunsView />,
  tektonpipelines: () => <TektonPipelinesView />,
  tektontasks: () => <TektonTasksView />,
  kyvernoclusterpolicies: () => <KyvernoPoliciesView cluster />,
  kyvernopolicies: () => <KyvernoPoliciesView cluster={false} />,
  kyvernovalidatingpolicies: () => <KyvernoValidatingPoliciesView namespaced={false} />,
  kyvernonamespacedvalidatingpolicies: () => <KyvernoValidatingPoliciesView namespaced />,
  kyvernopolicyexceptions: () => <KyvernoPolicyExceptionsView />,
  policyreports: () => <PolicyReportsView cluster={false} />,
  clusterpolicyreports: () => <PolicyReportsView cluster />,
}
