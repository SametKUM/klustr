import { describe, expect, it } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import type { ResourceView } from '@/store/ui'
import { buildVisibleResourceGroups } from './visibleResourceGroups'

const resources: [ResourceView, string, string][] = [
  ['karpenterec2nodeclasses', 'karpenter.k8s.aws', 'ec2nodeclasses'],
  ['fluximagerepositories', 'image.toolkit.fluxcd.io', 'imagerepositories'],
  ['fluximagepolicies', 'image.toolkit.fluxcd.io', 'imagepolicies'],
  ['fluximageupdateautomations', 'image.toolkit.fluxcd.io', 'imageupdateautomations'],
]

describe('image integration navigation', () => {
  it.each(resources)('gates %s on its exact CRD in an active context', (view, group, resource) => {
    const input = {
      activeContexts: ['dev'],
      crdsByContext: { dev: [], inactive: [{ group, resource } as CRDInfo] },
      accessByContext: {},
      hiddenItems: [],
    }
    const views = (crdsByContext: Record<string, CRDInfo[]>, hiddenItems: ResourceView[] = []) =>
      buildVisibleResourceGroups({ ...input, crdsByContext, hiddenItems }).flatMap((item) =>
        item.items.map((entry) => entry.view),
      )
    expect(views(input.crdsByContext)).not.toContain(view)
    expect(views({ dev: [{ group: 'example.com', resource } as CRDInfo] })).not.toContain(view)
    expect(views({ dev: [{ group, resource } as CRDInfo] })).toContain(view)
    expect(views({ dev: [{ group, resource } as CRDInfo] }, [view])).not.toContain(view)
  })
})
