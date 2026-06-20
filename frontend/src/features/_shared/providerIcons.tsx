import { FaAws, FaDigitalOcean, FaLinode, FaMicrosoft, SiDocker, SiGooglecloud, SiKubernetes } from './brandIcons'
import { Box } from 'lucide-react'
import type { ContextInfo } from '@/lib/api'
import kindLogoUrl from './kind.png'
import minikubeLogoUrl from './minikube.png'
import k3sLogoUrl from './k3s.png'
import k3dSvgSource from './k3d.svg?raw'

const K3D_INNER = (() => {
  const m = k3dSvgSource.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  return m ? m[1] : ''
})()

function PngIcon({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={[className, 'object-contain'].filter(Boolean).join(' ')}
    />
  )
}

function KindIcon({ className }: { className?: string }) {
  return <PngIcon src={kindLogoUrl} className={className} />
}

function MinikubeIcon({ className }: { className?: string }) {
  return <PngIcon src={minikubeLogoUrl} className={className} />
}

function K3sIcon({ className }: { className?: string }) {
  return <PngIcon src={k3sLogoUrl} className={className} />
}

function K3dIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 165.5865631 62.7499199"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: K3D_INNER }}
    />
  )
}

function OrbstackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.4" opacity="0.65" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}


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
  Icon: React.ComponentType<{ className?: string; role?: string; 'aria-label'?: string }>
}

const META: Record<Provider, ProviderMeta> = {
  aws: { id: 'aws', label: 'AWS EKS', className: 'text-[#FF9900]', Icon: FaAws },
  gcp: { id: 'gcp', label: 'GKE', className: 'text-[#4285F4]', Icon: SiGooglecloud },
  azure: { id: 'azure', label: 'AKS', className: 'text-[#0078D4]', Icon: FaMicrosoft },
  digitalocean: { id: 'digitalocean', label: 'DOKS', className: 'text-[#0080FF]', Icon: FaDigitalOcean },
  linode: { id: 'linode', label: 'LKE', className: 'text-[#00A95C]', Icon: FaLinode },
  orbstack: { id: 'orbstack', label: 'OrbStack', className: 'text-pink-500', Icon: OrbstackIcon },
  docker: { id: 'docker', label: 'Docker Desktop', className: 'text-[#2496ED]', Icon: SiDocker },
  kind: { id: 'kind', label: 'kind', className: '', Icon: KindIcon },
  k3d: { id: 'k3d', label: 'k3d', className: 'text-foreground', Icon: K3dIcon },
  k3s: { id: 'k3s', label: 'k3s', className: '', Icon: K3sIcon },
  minikube: { id: 'minikube', label: 'minikube', className: '', Icon: MinikubeIcon },
  microk8s: { id: 'microk8s', label: 'microk8s', className: 'text-[#E95420]', Icon: SiKubernetes },
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

  // Name/cluster fallbacks match the provider token only at a segment boundary
  // ([-_.] or string edge), so 'geeks-dev' doesn't read as EKS or 'speaks' as
  // AKS. The precise server-host regexes stay the primary signal.
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

export function providerMeta(c: ContextInfo): ProviderMeta {
  return META[detectProvider(c)]
}

export function ProviderIcon({ context, className }: { context: ContextInfo; className?: string }) {
  const meta = providerMeta(context)
  const Icon = meta.Icon
  return (
    <Icon
      className={[meta.className, className ?? 'size-3.5'].filter(Boolean).join(' ')}
      role="img"
      aria-label={meta.label}
    />
  )
}

// Overlapping avatar stack of provider icons. Used in both the welcome-screen
// group card badge (size='md') and the header context switcher trigger
// (size='sm'). The avatar border matches the surrounding surface so the cut-out
// effect reads correctly — pass `borderClass` if the container isn't `bg-card`.
export function ProviderIconStack({
  contexts,
  size = 'sm',
  cap = 3,
  borderClass = 'border-card',
}: {
  contexts: ContextInfo[]
  size?: 'sm' | 'md'
  cap?: number
  borderClass?: string
}) {
  const visible = contexts.slice(0, cap)
  const overflow = contexts.length - visible.length
  const dims =
    size === 'sm'
      ? 'size-7 border'
      : 'size-9 border-2 shadow-sm'
  const overlap = size === 'sm' ? '-space-x-2.5' : '-space-x-3'
  const iconSize = size === 'sm' ? 'size-4' : 'size-4'
  const overflowText = size === 'sm' ? 'text-[10px]' : 'text-[10px]'
  return (
    <span className={`flex items-center ${overlap}`}>
      {visible.map((c, i) => (
        <span
          key={`${c.name}-${i}`}
          style={{ zIndex: visible.length - i }}
          className={`relative inline-flex ${dims} items-center justify-center rounded-full ${borderClass} bg-muted`}
        >
          <ProviderIcon context={c} className={iconSize} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{ zIndex: 0 }}
          className={`relative inline-flex ${dims} items-center justify-center rounded-full ${borderClass} bg-muted ${overflowText} font-semibold tabular-nums text-muted-foreground`}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
