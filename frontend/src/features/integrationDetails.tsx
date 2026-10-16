import type { ReactNode } from 'react'
import type { IntegrationView } from '@/lib/integrationCatalog.generated'
import { AppProjectDetailBody } from '@/features/argocd/AppProjectDetailBody'
import { ApplicationSetDetailBody } from '@/features/argocd/ApplicationSetDetailBody'
import { CertificateDetailBody } from '@/features/cert-manager/CertificateDetailBody'
import { IssuerDetailBody } from '@/features/cert-manager/IssuerDetailBody'
import { CertificateRequestDetailBody } from '@/features/cert-manager/CertificateRequestDetailBody'
import { OrderDetailBody } from '@/features/cert-manager/OrderDetailBody'
import { ChallengeDetailBody } from '@/features/cert-manager/ChallengeDetailBody'
import { CiliumResourceDetailBody } from '@/features/cilium/CiliumResourceDetailBody'
import { CILIUM_RESOURCES, type CiliumView } from '@/features/cilium/ciliumKinds'
import { FluxKustomizationDetailBody } from '@/features/flux/FluxKustomizationDetailBody'
import { FluxHelmReleaseDetailBody } from '@/features/flux/FluxHelmReleaseDetailBody'
import { FluxGitRepositoryDetailBody } from '@/features/flux/FluxGitRepositoryDetailBody'
import { FluxHelmRepositoryDetailBody } from '@/features/flux/FluxHelmRepositoryDetailBody'
import { FluxOCIRepositoryDetailBody } from '@/features/flux/FluxOCIRepositoryDetailBody'
import { FluxBucketDetailBody } from '@/features/flux/FluxBucketDetailBody'
import { FluxProviderDetailBody } from '@/features/flux/FluxProviderDetailBody'
import { FluxAlertDetailBody } from '@/features/flux/FluxAlertDetailBody'
import { FluxReceiverDetailBody } from '@/features/flux/FluxReceiverDetailBody'
import {
  FluxImageRepositoryDetailBody,
  FluxImagePolicyDetailBody,
  FluxImageUpdateAutomationDetailBody,
} from '@/features/flux/FluxImageDetailBodies'
import { IstioVirtualServiceDetailBody } from '@/features/istio/IstioVirtualServiceDetailBody'
import { IstioDestinationRuleDetailBody } from '@/features/istio/IstioDestinationRuleDetailBody'
import { IstioPeerAuthenticationDetailBody } from '@/features/istio/IstioPeerAuthenticationDetailBody'
import {
  IstioAuthorizationPolicyDetailBody,
  IstioGatewayDetailBody,
  IstioRequestAuthenticationDetailBody,
  IstioServiceEntryDetailBody,
  IstioSidecarDetailBody,
} from '@/features/istio/IstioDetailBodies'
import { KarpenterEC2NodeClassDetailBody } from '@/features/karpenter-nodeclasses/KarpenterEC2NodeClassDetailBody'
import {
  KEDAScaledJobDetailBody,
  KEDAScaledObjectDetailBody,
  KEDATriggerAuthenticationDetailBody,
} from '@/features/keda/KEDADetailBodies'
import { KyvernoPolicyDetailBody } from '@/features/kyverno/KyvernoPolicyDetailBody'
import { KyvernoValidatingPolicyDetailBody } from '@/features/kyverno/KyvernoValidatingPolicyDetailBody'
import { KyvernoPolicyExceptionDetailBody } from '@/features/kyverno/KyvernoPolicyExceptionDetailBody'
import { PolicyReportDetailBody } from '@/features/kyverno/PolicyReportDetailBody'
import { TektonPipelineRunDetailBody } from '@/features/tekton/TektonPipelineRunDetailBody'
import { TektonTaskRunDetailBody } from '@/features/tekton/TektonTaskRunDetailBody'
import { TektonPipelineDetailBody } from '@/features/tekton/TektonPipelineDetailBody'
import { TektonTaskDetailBody } from '@/features/tekton/TektonTaskDetailBody'
import {
  TektonEventListenerDetailBody,
  TektonTriggerBindingDetailBody,
  TektonTriggerDetailBody,
  TektonTriggerTemplateDetailBody,
} from '@/features/tekton/TektonTriggersDetailBodies'

export type IntegrationDetailProps = {
  contextName: string | null
  namespace: string
  name: string
}

type DetailBody = (props: IntegrationDetailProps) => ReactNode

const CILIUM_DETAIL_BODIES = Object.fromEntries(
  (Object.keys(CILIUM_RESOURCES) as CiliumView[]).map((view) => [
    view,
    (p: IntegrationDetailProps) => <CiliumResourceDetailBody {...p} resource={view} />,
  ]),
) as Record<CiliumView, DetailBody>

// INTEGRATION_DETAIL_BODIES is the Overview tab of every catalog resource,
// or null for one without (the panel then opens on its other tabs). Keyed by
// IntegrationView, so a resource added to the catalog fails typecheck until
// this decision is made for it.
export const INTEGRATION_DETAIL_BODIES: Record<IntegrationView, DetailBody | null> = {
  ...CILIUM_DETAIL_BODIES,
  argocdapplications: null,
  argocdappprojects: (p) => <AppProjectDetailBody {...p} />,
  argocdapplicationsets: (p) => <ApplicationSetDetailBody {...p} />,
  certmanagercertificates: (p) => <CertificateDetailBody {...p} />,
  certmanagerissuers: (p) => <IssuerDetailBody {...p} cluster={false} />,
  certmanagerclusterissuers: (p) => <IssuerDetailBody {...p} cluster />,
  certmanagercertificaterequests: (p) => <CertificateRequestDetailBody {...p} />,
  certmanagerorders: (p) => <OrderDetailBody {...p} />,
  certmanagerchallenges: (p) => <ChallengeDetailBody {...p} />,
  fluxkustomizations: (p) => <FluxKustomizationDetailBody {...p} />,
  fluxhelmreleases: (p) => <FluxHelmReleaseDetailBody {...p} />,
  fluxgitrepositories: (p) => <FluxGitRepositoryDetailBody {...p} />,
  fluxhelmrepositories: (p) => <FluxHelmRepositoryDetailBody {...p} />,
  fluxocirepositories: (p) => <FluxOCIRepositoryDetailBody {...p} />,
  fluxbuckets: (p) => <FluxBucketDetailBody {...p} />,
  fluxproviders: (p) => <FluxProviderDetailBody {...p} />,
  fluxalerts: (p) => <FluxAlertDetailBody {...p} />,
  fluxreceivers: (p) => <FluxReceiverDetailBody {...p} />,
  fluximagerepositories: (p) => <FluxImageRepositoryDetailBody {...p} />,
  fluximagepolicies: (p) => <FluxImagePolicyDetailBody {...p} />,
  fluximageupdateautomations: (p) => <FluxImageUpdateAutomationDetailBody {...p} />,
  karpenternodepools: null,
  karpenternodeclaims: null,
  karpenterec2nodeclasses: (p) => <KarpenterEC2NodeClassDetailBody contextName={p.contextName} name={p.name} />,
  kedascaledobjects: (p) => <KEDAScaledObjectDetailBody {...p} />,
  kedascaledjobs: (p) => <KEDAScaledJobDetailBody {...p} />,
  kedatriggerauthentications: (p) => <KEDATriggerAuthenticationDetailBody {...p} cluster={false} />,
  kedaclustertriggerauthentications: (p) => <KEDATriggerAuthenticationDetailBody {...p} cluster />,
  istiovirtualservices: (p) => <IstioVirtualServiceDetailBody {...p} />,
  istiodestinationrules: (p) => <IstioDestinationRuleDetailBody {...p} />,
  istiopeerauthentications: (p) => <IstioPeerAuthenticationDetailBody {...p} />,
  istiogateways: (p) => <IstioGatewayDetailBody {...p} />,
  istioserviceentries: (p) => <IstioServiceEntryDetailBody {...p} />,
  istiosidecars: (p) => <IstioSidecarDetailBody {...p} />,
  istioauthorizationpolicies: (p) => <IstioAuthorizationPolicyDetailBody {...p} />,
  istiorequestauthentications: (p) => <IstioRequestAuthenticationDetailBody {...p} />,
  tektonpipelineruns: (p) => <TektonPipelineRunDetailBody {...p} />,
  tektontaskruns: (p) => <TektonTaskRunDetailBody {...p} />,
  tektonpipelines: (p) => <TektonPipelineDetailBody {...p} />,
  tektontasks: (p) => <TektonTaskDetailBody {...p} />,
  tektoneventlisteners: (p) => <TektonEventListenerDetailBody {...p} />,
  tektontriggers: (p) => <TektonTriggerDetailBody {...p} />,
  tektontriggertemplates: (p) => <TektonTriggerTemplateDetailBody {...p} />,
  tektontriggerbindings: (p) => <TektonTriggerBindingDetailBody {...p} cluster={false} />,
  tektonclustertriggerbindings: (p) => <TektonTriggerBindingDetailBody {...p} cluster />,
  kyvernoclusterpolicies: (p) => <KyvernoPolicyDetailBody {...p} cluster />,
  kyvernopolicies: (p) => <KyvernoPolicyDetailBody {...p} cluster={false} />,
  kyvernovalidatingpolicies: (p) => <KyvernoValidatingPolicyDetailBody {...p} namespaced={false} />,
  kyvernonamespacedvalidatingpolicies: (p) => <KyvernoValidatingPolicyDetailBody {...p} namespaced />,
  kyvernopolicyexceptions: (p) => <KyvernoPolicyExceptionDetailBody {...p} />,
  policyreports: (p) => <PolicyReportDetailBody {...p} cluster={false} />,
  clusterpolicyreports: (p) => <PolicyReportDetailBody {...p} cluster />,
}
