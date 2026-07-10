import { FaAws, FaDigitalOcean, FaLinode, FaMicrosoft, SiDocker, SiGooglecloud, SiKubernetes } from './brandIcons'
import { Box } from 'lucide-react'
import type { ContextInfo } from '@/lib/api'
import { providerMeta, type Provider } from './providerInfo'
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


const PROVIDER_ICONS: Record<Provider, React.ComponentType<{ className?: string; role?: string; 'aria-label'?: string }>> = {
  aws: FaAws,
  gcp: SiGooglecloud,
  azure: FaMicrosoft,
  digitalocean: FaDigitalOcean,
  linode: FaLinode,
  orbstack: OrbstackIcon,
  docker: SiDocker,
  kind: KindIcon,
  k3d: K3dIcon,
  k3s: K3sIcon,
  minikube: MinikubeIcon,
  microk8s: SiKubernetes,
  local: Box,
  k8s: SiKubernetes,
}

export function ProviderIcon({ context, className }: { context: ContextInfo; className?: string }) {
  const meta = providerMeta(context)
  const Icon = PROVIDER_ICONS[meta.id]
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
