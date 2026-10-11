import type { FluxKind } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

// Group + resource of the three Flux CRs PR1 supports. The frontend uses
// these to call api.ensureCustomResourceWatch + look up CRDs in the cache,
// and the rest of Klustr (sidebar detection, dispatch) sticks to the
// FluxKind string identifiers.
export const FLUX_KUSTOMIZATION_GROUP = 'kustomize.toolkit.fluxcd.io'
export const FLUX_HELMRELEASE_GROUP = 'helm.toolkit.fluxcd.io'
export const FLUX_SOURCE_GROUP = 'source.toolkit.fluxcd.io'
export const FLUX_NOTIFICATION_GROUP = 'notification.toolkit.fluxcd.io'
export const FLUX_IMAGE_GROUP = 'image.toolkit.fluxcd.io'

export const FLUX_KUSTOMIZATION_RESOURCE = 'kustomizations'
export const FLUX_HELMRELEASE_RESOURCE = 'helmreleases'
export const FLUX_GITREPOSITORY_RESOURCE = 'gitrepositories'
export const FLUX_HELMREPOSITORY_RESOURCE = 'helmrepositories'
export const FLUX_OCIREPOSITORY_RESOURCE = 'ocirepositories'
export const FLUX_BUCKET_RESOURCE = 'buckets'
export const FLUX_PROVIDER_RESOURCE = 'providers'
export const FLUX_ALERT_RESOURCE = 'alerts'
export const FLUX_RECEIVER_RESOURCE = 'receivers'
export const FLUX_IMAGE_REPOSITORY_RESOURCE = 'imagerepositories'
export const FLUX_IMAGE_POLICY_RESOURCE = 'imagepolicies'
export const FLUX_IMAGE_UPDATE_AUTOMATION_RESOURCE = 'imageupdateautomations'

// fluxKind label used in the detail dialog header, distinct from the
// Klustr-internal "FluxKustomization" identifier so the UI reads naturally.
export const FLUX_KIND_LABEL: Record<FluxKind, string> = {
  FluxKustomization: 'Kustomization',
  FluxHelmRelease: 'HelmRelease',
  FluxGitRepository: 'GitRepository',
  FluxHelmRepository: 'HelmRepository',
  FluxOCIRepository: 'OCIRepository',
  FluxBucket: 'Bucket',
  FluxProvider: 'Provider',
  FluxAlert: 'Alert',
  FluxReceiver: 'Receiver',
  FluxImageRepository: 'ImageRepository',
  FluxImagePolicy: 'ImagePolicy',
  FluxImageUpdateAutomation: 'ImageUpdateAutomation',
}

const FLUX_KINDS = new Set<string>([
  'FluxKustomization',
  'FluxHelmRelease',
  'FluxGitRepository',
  'FluxHelmRepository',
  'FluxOCIRepository',
  'FluxBucket',
  'FluxProvider',
  'FluxAlert',
  'FluxReceiver',
  'FluxImageRepository',
  'FluxImagePolicy',
  'FluxImageUpdateAutomation',
])

export function isFluxResource(resource: SelectedResource | null): resource is SelectedResource & { kind: FluxKind } {
  return resource !== null && FLUX_KINDS.has(resource.kind as string)
}

// stripFluxKindPrefix maps the Klustr-side kind ("FluxKustomization") to
// the bare CR kind ("Kustomization"). The EventsTab needs the bare form
// because core/v1 Events store .involvedObject.kind as the actual CR kind.
export function stripFluxKindPrefix(kind: string): string {
  return kind.startsWith('Flux') ? kind.slice(4) : kind
}

export function canReconcileFluxKind(kind: FluxKind): boolean {
  return kind !== 'FluxImagePolicy'
}

export function canSuspendFluxKind(kind: FluxKind, version?: string): boolean {
  return kind !== 'FluxImagePolicy' || version === 'v1'
}
