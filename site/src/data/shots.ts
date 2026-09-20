import type { ImageMetadata } from 'astro'
import welcome from '../assets/screenshots/01-welcome-default-dark.png'
import podsAggregated from '../assets/screenshots/02-pods-aggregated-dracula.png'
import clusterOverview from '../assets/screenshots/03-cluster-overview-nord.png'
import nodesUsage from '../assets/screenshots/04-nodes-usage-one-dark.png'
import helmUpgrade from '../assets/screenshots/05-helm-upgrade-tokyo-night-day.png'
import argoApplications from '../assets/screenshots/06-argo-applications-one-light.png'
import fluxKustomization from '../assets/screenshots/07-flux-kustomization-monokai.png'
import certManagerChain from '../assets/screenshots/08-certmanager-chain-nord-light.png'
import gatewayHttpRoutes from '../assets/screenshots/09-gateway-httproutes-tokyo-night.png'
import podDiagnosis from '../assets/screenshots/10-pod-diagnosis-default-light.png'
import logsStream from '../assets/screenshots/11-logs-stream-dracula-light.png'
import podDetail from '../assets/screenshots/12-pod-detail-monokai-light.png'
import kedaHpa from '../assets/screenshots/13-keda-hpa-nord.png'
import readOnly from '../assets/screenshots/14-read-only-tokyo-night.png'
import yamlDiff from '../assets/screenshots/15-yaml-diff-default-dark.png'
import terminalDrawer from '../assets/screenshots/16-terminal-drawer-one-dark.png'

export type Shot = {
  id: string
  image: ImageMetadata
  title: string
  theme: string
  caption: string
}

// Every shot is captured live from a real cluster, each in a different one of
// the app's themes, so the slider doubles as a tour of the theme picker.
export const SHOTS: Shot[] = [
  {
    id: 'pods-aggregated',
    image: podsAggregated,
    title: 'Aggregated pods',
    theme: 'Dracula',
    caption: 'Two clusters in one table. The Context column tells the rows apart.',
  },
  {
    id: 'cluster-overview',
    image: clusterOverview,
    title: 'Cluster overview',
    theme: 'Nord',
    caption: 'CPU, memory and pod capacity donuts with a live warnings feed.',
  },
  {
    id: 'connections',
    image: welcome,
    title: 'Connections',
    theme: 'Default Dark',
    caption: 'Every kubeconfig context on one screen, with groups, tags and auto-connect.',
  },
  {
    id: 'nodes-usage',
    image: nodesUsage,
    title: 'Node usage and pressure',
    theme: 'One Dark',
    caption: 'Per-node CPU and memory bars beside the pressure conditions.',
  },
  {
    id: 'helm-upgrade',
    image: helmUpgrade,
    title: 'Helm upgrade',
    theme: 'Tokyo Night Day',
    caption: 'Values editor, Wait and Atomic options, and the dry-run diff before anything is applied.',
  },
  {
    id: 'argo-applications',
    image: argoApplications,
    title: 'Argo CD applications',
    theme: 'One Light',
    caption: 'Sync and Health pills with per-row Sync and Refresh. No argocd CLI, no Argo login.',
  },
  {
    id: 'flux-kustomization',
    image: fluxKustomization,
    title: 'Flux CD',
    theme: 'Monokai',
    caption: 'Kustomization conditions, source and applied revision, Reconcile and Suspend buttons.',
  },
  {
    id: 'certmanager-chain',
    image: certManagerChain,
    title: 'cert-manager chain',
    theme: 'Nord Light',
    caption: 'Certificate readiness, issuer and SANs, with the issuance chain one tab away.',
  },
  {
    id: 'gateway-httproutes',
    image: gatewayHttpRoutes,
    title: 'Gateway API HTTPRoutes',
    theme: 'Tokyo Night',
    caption: 'Routes with their parents, hostnames and accepted status.',
  },
  {
    id: 'pod-diagnosis',
    image: podDiagnosis,
    title: 'Pod diagnosis',
    theme: 'Default Light',
    caption: 'A card that explains why a pod is unhealthy instead of leaving you with raw status fields.',
  },
  {
    id: 'logs-stream',
    image: logsStream,
    title: 'Multi-pod log stream',
    theme: 'Dracula Light',
    caption: 'One stream across pods, each in its own color, with log-level highlighting.',
  },
  {
    id: 'keda-hpa',
    image: kedaHpa,
    title: 'KEDA-driven HPA',
    theme: 'Nord',
    caption: 'External metrics mapped back to the ScaledObject triggers that drive them.',
  },
  {
    id: 'yaml-diff',
    image: yamlDiff,
    title: 'YAML edit with diff',
    theme: 'Default Dark',
    caption: 'Monaco editor with a server-side dry-run diff before apply.',
  },
  {
    id: 'pod-detail',
    image: podDetail,
    title: 'Pod detail',
    theme: 'Monokai Light',
    caption: 'Containers, conditions, volumes and events for one pod.',
  },
  {
    id: 'read-only',
    image: readOnly,
    title: 'Read-only mode',
    theme: 'Tokyo Night',
    caption: 'A per-context switch that blocks every mutation while you browse production.',
  },
  {
    id: 'terminal-drawer',
    image: terminalDrawer,
    title: 'Terminal drawer',
    theme: 'One Dark',
    caption: 'A local shell with KUBECONFIG already pointed at the active context.',
  },
]

export function shotBySlug(id: string): Shot {
  const shot = SHOTS.find((s) => s.id === id)
  if (!shot) throw new Error(`unknown screenshot "${id}"`)
  return shot
}
