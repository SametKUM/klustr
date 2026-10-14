import { describe, expect, it } from 'vitest'
import { ALL_RESOURCE_VIEWS } from '@/features/_shared/resourceGroups'
import { INTEGRATION_RESOURCES } from './integrationCatalog.generated'
import { integrationFor, isIntegrationView } from './integrations'

describe('integration catalog', () => {
  it.each(INTEGRATION_RESOURCES.map((r) => [r.view, r] as const))('%s has a sidebar entry and round-trips', (view, r) => {
    // Without a sidebar item the view is unreachable, which no type check catches.
    expect(ALL_RESOURCE_VIEWS.has(view)).toBe(true)
    expect(isIntegrationView(view)).toBe(true)
    expect(integrationFor({ group: r.group, resource: r.resource })).toBe(r)
  })

  it('does not match on a shared resource name from another group', () => {
    expect(integrationFor({ group: 'example.com', resource: 'certificates' })).toBeUndefined()
    expect(isIntegrationView('pods')).toBe(false)
  })
})
