import type { ImageMetadata } from 'astro'
import podsAggregated from '../assets/screenshots/01-pods-aggregated-dracula.png'
import connections from '../assets/screenshots/02-connections-default-dark.png'
import podDiagnosis from '../assets/screenshots/03-pod-diagnosis-default-light.png'
import logsStream from '../assets/screenshots/04-logs-stream-dracula-light.png'
import debugContainer from '../assets/screenshots/05-debug-container-one-dark.png'
import helmUpgrade from '../assets/screenshots/06-helm-upgrade-diff-tokyo-night-day.png'
import argoApplications from '../assets/screenshots/07-argo-applications-one-light.png'
import fluxKustomization from '../assets/screenshots/08-flux-kustomization-monokai.png'
import gatewayHttpRoute from '../assets/screenshots/09-gateway-httproute-tokyo-night.png'
import certManagerChain from '../assets/screenshots/10-certmanager-chain-nord-light.png'
import accessReview from '../assets/screenshots/11-access-review-nord.png'
import yamlDiff from '../assets/screenshots/12-yaml-diff-default-dark.png'
import rolloutHistory from '../assets/screenshots/13-rollout-history-monokai-light.png'
import nodeDrain from '../assets/screenshots/14-node-drain-dracula.png'
import terminalDrawer from '../assets/screenshots/15-terminal-drawer-one-dark.png'
import themePicker from '../assets/screenshots/16-theme-picker-default-light.png'
import clusterOverview from '../assets/screenshots/17-cluster-overview-nord.png'
import istioVirtualService from '../assets/screenshots/18-istio-virtualservice-one-light.png'
import karpenterNodeClaims from '../assets/screenshots/19-karpenter-nodeclaims-tokyo-night.png'
import kedaHpa from '../assets/screenshots/20-keda-hpa-nord-light.png'

export type Shot = {
  id: string
  image: ImageMetadata
  title: string
  theme: string
  caption: string
  guide: { href: string; label: string }
}

// Every shot is captured from two kind clusters seeded with realistic
// workloads and deliberate failures, at the app's default 1280×800 window,
// each in a different theme so the tour doubles as a tour of the theme picker.
export const SHOTS: Shot[] = [
  {
    id: 'pods-aggregated',
    image: podsAggregated,
    title: 'Aggregated pods',
    theme: 'Dracula',
    caption:
      'Two clusters and three namespaces in one table. The Context column tells prod from dev, and CrashLoopBackOff, ImagePullBackOff and Pending sit next to the healthy rows instead of in another window.',
    guide: { href: '/docs/multi-context/', label: 'Multi-context guide' },
  },
  {
    id: 'connections',
    image: connections,
    title: 'Connections',
    theme: 'Default Dark',
    caption:
      'Every kubeconfig context on one screen, grouped by tag. Two contexts are checked for an aggregated session, and the saved Payments fleet group reconnects both in one click.',
    guide: { href: '/docs/getting-started/', label: 'Getting started' },
  },
  {
    id: 'pod-diagnosis',
    image: podDiagnosis,
    title: 'Pod diagnosis',
    theme: 'Default Light',
    caption:
      'A crash-looping pod opens on a diagnosis card that says what is wrong and what to check next, above the raw status, conditions and containers you would otherwise piece together.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'logs-stream',
    image: logsStream,
    title: 'Multi-pod logs',
    theme: 'Dracula Light',
    caption:
      'One stream across every pod of a Deployment, a color per pod, filtered live with the regex ERROR|WARN. Follow, pause, clear and save without leaving the dialog.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'debug-container',
    image: debugContainer,
    title: 'Debug container',
    theme: 'One Dark',
    caption:
      'The Exec tab in debug mode injects a netshoot container into a shell-less pod, sharing its process namespace. ps, curl and dig run against the target from inside the pod.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'helm-upgrade',
    image: helmUpgrade,
    title: 'Helm upgrade with dry-run',
    theme: 'Tokyo Night Day',
    caption:
      'New values on the left, the manifest Helm would render on the right. Dry-run renders first; Upgrade applies only after you have read it. No helm binary is involved.',
    guide: { href: '/docs/helm/', label: 'Helm guide' },
  },
  {
    id: 'argo-applications',
    image: argoApplications,
    title: 'Argo CD applications',
    theme: 'One Light',
    caption:
      'Sync and Health pills per Application, auto-sync policy, revision and repo, with Refresh, Suspend and Sync actions on every row. Driven through the Kubernetes API, no argocd CLI or login.',
    guide: { href: '/docs/gitops/', label: 'GitOps guide' },
  },
  {
    id: 'flux-kustomization',
    image: fluxKustomization,
    title: 'Flux Kustomization',
    theme: 'Monokai',
    caption:
      'A failed Kustomization shows its status message, source, path and interval up front, with Reconcile and Suspend one click away. The path typo is readable without opening YAML.',
    guide: { href: '/docs/gitops/', label: 'GitOps guide' },
  },
  {
    id: 'gateway-httproutes',
    image: gatewayHttpRoute,
    title: 'Gateway API route status',
    theme: 'Tokyo Night',
    caption:
      'The rule matrix shows match, backend and weight; the status block shows the route was Accepted but ResolvedRefs is False with RefNotPermitted, the missing ReferenceGrant spelled out.',
    guide: { href: '/docs/gateway-api/', label: 'Gateway API guide' },
  },
  {
    id: 'certmanager-chain',
    image: certManagerChain,
    title: 'cert-manager issuance chain',
    theme: 'Nord Light',
    caption:
      'Drilled from a Certificate through its CertificateRequest and Order to the pending HTTP-01 Challenge, with the ACME self-check error that explains why issuance is stuck.',
    guide: { href: '/docs/integrations/', label: 'Platform integrations' },
  },
  {
    id: 'access-review',
    image: accessReview,
    title: 'Access Review',
    theme: 'Nord',
    caption:
      'What a ServiceAccount can do, as a resource-by-verb matrix per scope. The namespaced Role grants update and patch on Deployments; a wildcard rule elsewhere is flagged in the header.',
    guide: { href: '/docs/getting-started/', label: 'Getting started' },
  },
  {
    id: 'yaml-diff',
    image: yamlDiff,
    title: 'YAML edit with server-side diff',
    theme: 'Default Dark',
    caption:
      'Edit in Monaco, then review the live object against what the API server predicts after defaulting and admission. Nothing is written until Apply.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'rollout-history',
    image: rolloutHistory,
    title: 'Rollout history and rollback',
    theme: 'Monokai Light',
    caption:
      'Revision 2 diffed against the active revision 3, change causes included, with a one-click rollback to the selected revision.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'node-drain',
    image: nodeDrain,
    title: 'PDB-aware node drain',
    theme: 'Dracula',
    caption:
      'A drain in progress through the Eviction API: DaemonSet pods left alone, the pod blocked by a PodDisruptionBudget called out and retried, progress streamed as it happens.',
    guide: { href: '/docs/workloads-and-debugging/', label: 'Workloads and debugging' },
  },
  {
    id: 'terminal-drawer',
    image: terminalDrawer,
    title: 'Terminal drawer',
    theme: 'One Dark',
    caption:
      'A local shell pinned to klustr-prod under the pod table, with KUBECONFIG already set. kubectl in the drawer sees the same cluster as the rows above it.',
    guide: { href: '/docs/terminal/', label: 'Terminal guide' },
  },
  {
    id: 'theme-picker',
    image: themePicker,
    title: 'Twelve themes',
    theme: 'Default Light',
    caption:
      'Six light and six dark themes, switched from the header. Every screenshot in this tour uses a different one.',
    guide: { href: '/docs/getting-started/', label: 'Getting started' },
  },
  {
    id: 'cluster-overview',
    image: clusterOverview,
    title: 'Cluster overview',
    theme: 'Nord',
    caption:
      'CPU, memory and pod capacity per cluster, usage against requests and limits, and a live feed of warning events from both contexts.',
    guide: { href: '/docs/overview/', label: 'Overviews guide' },
  },
  {
    id: 'istio-virtualservice',
    image: istioVirtualService,
    title: 'Istio VirtualService',
    theme: 'One Light',
    caption:
      'A weighted canary read straight from the rule table: 90 percent of traffic to the stable subset, 10 percent to canary, and a header match that pins x-canary requests to the new version.',
    guide: { href: '/docs/integrations/', label: 'Platform integrations' },
  },
  {
    id: 'karpenter-nodeclaims',
    image: karpenterNodeClaims,
    title: 'Karpenter NodeClaims',
    theme: 'Tokyo Night',
    caption:
      'Every claim with its node, pool, instance type, capacity type and zone, plus the Launched, Registered and Initialized steps. The GPU claim is still waiting for its node to register.',
    guide: { href: '/docs/integrations/', label: 'Platform integrations' },
  },
  {
    id: 'keda-hpa',
    image: kedaHpa,
    title: 'KEDA-driven HPA',
    theme: 'Nord Light',
    caption:
      'A KEDA-managed autoscaler whose external metrics are mapped back to their ScaledObject triggers: a weekday 09:00 to 18:00 cron for three replicas and a CPU target, instead of opaque s0 and s1 rows.',
    guide: { href: '/docs/integrations/', label: 'Platform integrations' },
  },
]

export function shotBySlug(id: string): Shot {
  const shot = SHOTS.find((s) => s.id === id)
  if (!shot) throw new Error(`unknown screenshot "${id}"`)
  return shot
}
