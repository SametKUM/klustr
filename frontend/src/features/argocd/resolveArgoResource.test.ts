import { describe, expect, it } from 'vitest'
import type { ArgoApplicationResource, CRDInfo } from '@/lib/api'
import { isArgoResourceClickable, resolveArgoResource } from './resolveArgoResource'

function row(group: string, kind: string, name = 'web', namespace = 'apps'): ArgoApplicationResource {
  return { group, version: 'v1', kind, namespace, name, sync: 'Synced', health: 'Healthy', message: '' }
}

function crd(group: string, kind: string, resource: string): CRDInfo {
  return { group, version: 'v1', resource, kind } as CRDInfo
}

const knativeService = crd('serving.knative.dev', 'Service', 'services')
const calicoPolicy = crd('crd.projectcalico.org', 'NetworkPolicy', 'networkpolicies')
const certificate = crd('cert-manager.io', 'Certificate', 'certificates')

describe('resolveArgoResource', () => {
  it('opens a core kind as the built-in view', () => {
    expect(resolveArgoResource(row('', 'Service'), 'dev', [knativeService])).toEqual({
      kind: 'Service',
      namespace: 'apps',
      name: 'web',
      context: 'dev',
    })
  })

  it('opens a built-in from a named API group', () => {
    expect(resolveArgoResource(row('apps', 'Deployment'), 'dev', [])).toEqual({
      kind: 'Deployment',
      namespace: 'apps',
      name: 'web',
      context: 'dev',
    })
  })

  it('opens a CRD that reuses a built-in kind name through its CRD', () => {
    expect(resolveArgoResource(row('serving.knative.dev', 'Service'), 'dev', [knativeService])).toEqual({
      kind: 'Service',
      namespace: 'apps',
      name: 'web',
      context: 'dev',
      gvr: { group: 'serving.knative.dev', version: 'v1', resource: 'services' },
    })
    expect(
      resolveArgoResource(row('crd.projectcalico.org', 'NetworkPolicy'), 'dev', [calicoPolicy])?.gvr,
    ).toEqual({ group: 'crd.projectcalico.org', version: 'v1', resource: 'networkpolicies' })
  })

  it('returns null for a reused kind name whose CRD is not known', () => {
    expect(resolveArgoResource(row('serving.knative.dev', 'Service'), 'dev', [])).toBeNull()
  })

  it('opens other custom resources through their CRD', () => {
    expect(resolveArgoResource(row('cert-manager.io', 'Certificate'), 'dev', [certificate])?.gvr).toEqual({
      group: 'cert-manager.io',
      version: 'v1',
      resource: 'certificates',
    })
    expect(resolveArgoResource(row('example.com', 'Widget'), 'dev', [certificate])).toBeNull()
  })
})

describe('isArgoResourceClickable', () => {
  it('matches the kind and the API group', () => {
    expect(isArgoResourceClickable(row('', 'Service'), [])).toBe(true)
    expect(isArgoResourceClickable(row('batch', 'Job'), [])).toBe(true)
    expect(isArgoResourceClickable(row('batch.volcano.sh', 'Job'), [])).toBe(false)
    expect(isArgoResourceClickable(row('serving.knative.dev', 'Service'), [knativeService])).toBe(true)
    expect(isArgoResourceClickable(row('example.com', 'Widget'), [certificate])).toBe(false)
  })
})
