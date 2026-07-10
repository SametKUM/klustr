import type { ContextInfo } from '@/lib/api'

export type Provider =
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'digitalocean'
  | 'linode'
  | 'orbstack'
  | 'docker'
  | 'kind'
  | 'k3d'
  | 'k3s'
  | 'minikube'
  | 'microk8s'
  | 'local'
  | 'k8s'

export type ProviderMeta = {
  id: Provider
  label: string
  className: string
}

const PROVIDERS: Record<Provider, ProviderMeta> = {
  aws: { id: 'aws', label: 'AWS EKS', className: 'text-[#FF9900]' },
  gcp: { id: 'gcp', label: 'GKE', className: 'text-[#4285F4]' },
  azure: { id: 'azure', label: 'AKS', className: 'text-[#0078D4]' },
  digitalocean: { id: 'digitalocean', label: 'DOKS', className: 'text-[#0080FF]' },
  linode: { id: 'linode', label: 'LKE', className: 'text-[#00A95C]' },
  orbstack: { id: 'orbstack', label: 'OrbStack', className: 'text-pink-500' },
  docker: { id: 'docker', label: 'Docker Desktop', className: 'text-[#2496ED]' },
  kind: { id: 'kind', label: 'kind', className: '' },
  k3d: { id: 'k3d', label: 'k3d', className: 'text-foreground' },
  k3s: { id: 'k3s', label: 'k3s', className: '' },
  minikube: { id: 'minikube', label: 'minikube', className: '' },
  microk8s: { id: 'microk8s', label: 'microk8s', className: 'text-[#E95420]' },
  local: { id: 'local', label: 'Local', className: 'text-muted-foreground' },
  k8s: { id: 'k8s', label: 'Kubernetes', className: 'text-[#326CE5]' },
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function detectProvider(c: { name: string; server: string; cluster?: string }): Provider {
  const name = (c.name ?? '').toLowerCase()
  const server = c.server ?? ''
  const cluster = (c.cluster ?? '').toLowerCase()

  if (/\.eks\.amazonaws\.com(?:[:/]|$)/i.test(server) || name.startsWith('arn:aws:eks:') || /(^|[-_.])eks([-_.]|$)/.test(name) || /(^|[-_.])eks([-_.]|$)/.test(cluster)) return 'aws'
  if (/\.gke\./i.test(server) || /container\.googleapis/i.test(server) || name.startsWith('gke_') || /(^|[-_.])gke([-_.]|$)/.test(name)) return 'gcp'
  if (/\.azmk8s\.io(?:[:/]|$)/i.test(server) || name.startsWith('aks-') || /(^|[-_.])aks([-_.]|$)/.test(name)) return 'azure'
  if (/\.k8s\.ondigitalocean\.com(?:[:/]|$)/i.test(server) || /(^|[-_.])doks([-_.]|$)/.test(name)) return 'digitalocean'
  if (/\.linodelke\.net(?:[:/]|$)/i.test(server) || /(^|[-_.])lke([-_.]|$)/.test(name)) return 'linode'
  if (/orbstack/.test(name) || /orbstack/i.test(server)) return 'orbstack'
  if (/docker-desktop/.test(name) || /docker\.internal/i.test(server)) return 'docker'
  if (/kind-/.test(name)) return 'kind'
  if (/k3d-/.test(name)) return 'k3d'
  if (/microk8s/.test(name)) return 'microk8s'
  if (/minikube/.test(name)) return 'minikube'
  if (/k3s/.test(name) || /k3s/.test(cluster)) return 'k3s'

  const host = hostname(server)
  if (host && /^(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return 'local'
  }
  return 'k8s'
}

export function providerMeta(context: ContextInfo): ProviderMeta {
  return PROVIDERS[detectProvider(context)]
}
