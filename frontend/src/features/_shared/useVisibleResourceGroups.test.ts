import { describe, expect, it } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { buildVisibleResourceGroups } from './visibleResourceGroups'

function viewsFor(groups: ReturnType<typeof buildVisibleResourceGroups>): string[] {
  return groups.flatMap((group) => group.items.flatMap((item) => (item.view ? [item.view] : [])))
}

describe('buildVisibleResourceGroups', () => {
  it.each([
    ['tlsroutes', 'TLSRoute'],
    ['tcproutes', 'TCPRoute'],
    ['udproutes', 'UDPRoute'],
    ['listenersets', 'ListenerSet'],
    ['backendtlspolicies', 'BackendTLSPolicy'],
  ])('shows %s only when the same active context serves and permits it', (resource, kind) => {
    const input = {
      activeContexts: ['with-crd', 'without-crd'],
      crdsByContext: {
        'with-crd': [{ group: 'gateway.networking.k8s.io', resource } as CRDInfo],
        'without-crd': [],
      },
      accessByContext: {
        'with-crd': new Set<string>(),
        'without-crd': new Set([kind]),
      },
      hiddenItems: [],
    }
    expect(viewsFor(buildVisibleResourceGroups(input))).not.toContain(resource)
    expect(viewsFor(buildVisibleResourceGroups({
      ...input, accessByContext: { 'with-crd': new Set([kind]) },
    }))).toContain(resource)
    expect(viewsFor(buildVisibleResourceGroups({ ...input, accessByContext: {} })))
      .toContain(resource)
    expect(viewsFor(buildVisibleResourceGroups({
      ...input, accessByContext: { 'without-crd': new Set<string>() },
    }))).toContain(resource)
  })

  it('does not promote the old XListenerSet API or unrelated groups', () => {
    const groups = buildVisibleResourceGroups({
      activeContexts: ['test'],
      crdsByContext: {
        test: [
          { group: 'gateway.networking.x-k8s.io', resource: 'xlistenersets' } as CRDInfo,
          { group: 'example.com', resource: 'backendtlspolicies' } as CRDInfo,
        ],
      },
      accessByContext: {},
      hiddenItems: [],
    })
    expect(viewsFor(groups)).not.toContain('listenersets')
    expect(viewsFor(groups)).not.toContain('backendtlspolicies')
  })

  it('filters inaccessible and hidden views from the shared navigation model', () => {
    const groups = buildVisibleResourceGroups({
      activeContexts: ['restricted'],
      crdsByContext: {},
      accessByContext: {
        restricted: new Set(['Pod']),
      },
      hiddenItems: ['pods'],
    })
    const views = viewsFor(groups)

    expect(views).not.toContain('pods')
    expect(views).not.toContain('deployments')
    expect(views).toContain('overview')
  })

  it('keeps a kind visible when any active context can access it', () => {
    const groups = buildVisibleResourceGroups({
      activeContexts: ['restricted', 'admin'],
      crdsByContext: {},
      accessByContext: {
        restricted: new Set<string>(),
        admin: new Set(['Deployment']),
      },
      hiddenItems: [],
    })

    expect(viewsFor(groups)).toContain('deployments')
  })

  it('shows each integration item when any active context has its CRD', () => {
    const groups = buildVisibleResourceGroups({
      activeContexts: ['prod', 'staging'],
      crdsByContext: {
        prod: [
          {
            group: 'argoproj.io',
            resource: 'applications',
          } as CRDInfo,
        ],
        staging: [],
      },
      accessByContext: {},
      hiddenItems: [],
    })
    const views = viewsFor(groups)

    expect(views).toContain('argocdapplications')
    expect(views).not.toContain('argocdappprojects')
  })
})
