import { FaAws, FaDigitalOcean, FaLinode, FaMicrosoft } from 'react-icons/fa'
import { SiDocker, SiGooglecloud, SiKubernetes } from 'react-icons/si'
import { Box, Container, HardDrive } from 'lucide-react'
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

type ProviderMeta = {
  id: Provider
  label: string
  className: string
  Icon: React.ComponentType<{ className?: string }>
}

const META: Record<Provider, ProviderMeta> = {
  aws: { id: 'aws', label: 'AWS EKS', className: 'text-[#FF9900]', Icon: FaAws },
  gcp: { id: 'gcp', label: 'GKE', className: 'text-[#4285F4]', Icon: SiGooglecloud },
  azure: { id: 'azure', label: 'AKS', className: 'text-[#0078D4]', Icon: FaMicrosoft },
  digitalocean: { id: 'digitalocean', label: 'DOKS', className: 'text-[#0080FF]', Icon: FaDigitalOcean },
  linode: { id: 'linode', label: 'LKE', className: 'text-[#00A95C]', Icon: FaLinode },
  orbstack: { id: 'orbstack', label: 'OrbStack', className: 'text-pink-500', Icon: Container },
  docker: { id: 'docker', label: 'Docker Desktop', className: 'text-[#2496ED]', Icon: SiDocker },
  kind: { id: 'kind', label: 'kind', className: 'text-indigo-400', Icon: HardDrive },
  k3d: { id: 'k3d', label: 'k3d', className: 'text-amber-400', Icon: HardDrive },
  k3s: { id: 'k3s', label: 'k3s', className: 'text-amber-400', Icon: HardDrive },
  minikube: { id: 'minikube', label: 'minikube', className: 'text-purple-500', Icon: HardDrive },
  microk8s: { id: 'microk8s', label: 'microk8s', className: 'text-orange-400', Icon: SiKubernetes },
  local: { id: 'local', label: 'Local', className: 'text-muted-foreground', Icon: Box },
  k8s: { id: 'k8s', label: 'Kubernetes', className: 'text-[#326CE5]', Icon: SiKubernetes },
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

  if (/\.eks\.amazonaws\.com(?:[:/]|$)/i.test(server) || name.startsWith('arn:aws:eks:') || /eks/.test(name) || /eks/.test(cluster)) return 'aws'
  if (/\.gke\./i.test(server) || /container\.googleapis/i.test(server) || name.startsWith('gke_') || /gke/.test(name)) return 'gcp'
  if (/\.azmk8s\.io(?:[:/]|$)/i.test(server) || name.startsWith('aks-') || /aks/.test(name)) return 'azure'
  if (/\.k8s\.ondigitalocean\.com(?:[:/]|$)/i.test(server) || /doks/.test(name)) return 'digitalocean'
  if (/\.linodelke\.net(?:[:/]|$)/i.test(server) || /lke/.test(name)) return 'linode'

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

export function providerMeta(c: ContextInfo): ProviderMeta {
  return META[detectProvider(c)]
}

export function ProviderIcon({ context, className }: { context: ContextInfo; className?: string }) {
  const meta = providerMeta(context)
  const Icon = meta.Icon
  return (
    <Icon
      className={[meta.className, className ?? 'size-3.5'].filter(Boolean).join(' ')}
      aria-label={meta.label}
    />
  )
}
