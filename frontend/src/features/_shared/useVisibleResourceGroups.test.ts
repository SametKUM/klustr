import { describe, expect, it } from 'vitest'
import { buildVisibleResourceGroups } from './visibleResourceGroups'

function viewsFor(groups: ReturnType<typeof buildVisibleResourceGroups>): string[] {
  return groups.flatMap((group) => group.items.flatMap((item) => (item.view ? [item.view] : [])))
}

describe('buildVisibleResourceGroups', () => {
  it('filters inaccessible and hidden views from the shared navigation model', () => {
    const groups = buildVisibleResourceGroups({
      activeContexts: ['restricted'],
      crds: [],
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
      crds: [],
      accessByContext: {
        restricted: new Set<string>(),
        admin: new Set(['Deployment']),
      },
      hiddenItems: [],
    })

    expect(viewsFor(groups)).toContain('deployments')
  })
})
