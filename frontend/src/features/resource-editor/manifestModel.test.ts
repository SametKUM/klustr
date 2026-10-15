import { describe, expect, it } from 'vitest'
import type { ManifestOperation } from '@/lib/api'
import {
  canCreateManifest,
  formatManifest,
  MAX_MANIFEST_BYTES,
  mergeManifestOperation,
  parseManifestDraft,
  resourceTemplate,
} from './manifestModel'

const manifest = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example\n'
const operation = (revision: number, phase = 'review', status = 'ready') =>
  ({
    id: 'review',
    revision,
    contextName: 'ctx',
    phase,
    resources: [{ index: 0, status }],
    warnings: [],
  }) as unknown as ManifestOperation

describe('manifest draft', () => {
  it('keeps document offsets and flattens Kubernetes Lists for the outline', () => {
    const draft = parseManifestDraft(
      `${manifest}---\napiVersion: v1\nkind: List\nitems:\n  - apiVersion: v1\n    kind: Secret\n    metadata:\n      name: credentials\n`,
    )
    expect(draft.error).toBeNull()
    expect(draft.outline.map((item) => [item.kind, item.name, item.document, item.line])).toEqual([
      ['ConfigMap', 'example', 1, 1],
      ['Secret', 'credentials', 2, 6],
    ])
    expect(draft.objects).toHaveLength(2)
  })

  it('does not echo sensitive scalars in syntax diagnostics', () => {
    const draft = parseManifestDraft('stringData: [top-secret')
    expect(draft.error).toMatch(/Invalid YAML.*line/)
    expect(draft.error).not.toContain('top-secret')
  })

  it('rejects duplicate keys, excessive resources and oversized UTF-8 input', () => {
    expect(parseManifestDraft(`${manifest}kind: Secret\n`).error).toMatch(/Invalid YAML/)
    expect(
      parseManifestDraft(Array.from({ length: 201 }, () => manifest).join('---\n')).error,
    ).toMatch(/limit/)
    expect(parseManifestDraft('😀'.repeat(MAX_MANIFEST_BYTES / 4 + 1)).error).toMatch(/2 MiB/)
  })

  it('formats all documents without losing comments or block scalar content', () => {
    const formatted = formatManifest(
      `# keep this\n${manifest}data: {key: value}\n---\n${manifest}data:\n  script: |\n    ---\n    run\n`,
    )
    const parsed = parseManifestDraft(formatted)
    expect(parsed.outline).toHaveLength(2)
    expect(formatted).toContain('# keep this')
    expect((parsed.objects[1].data as Record<string, string>).script).toBe('---\nrun\n')
  })

  it('uses Kubernetes YAML 1.1 scalar semantics', () => {
    expect(parseManifestDraft(`${manifest}data:\n  enabled: yes\n`).objects[0].data).toEqual({
      enabled: true,
    })
  })

  it.each([
    'Deployment',
    'Pod',
    'Service',
    'Secret',
    'ConfigMap',
    'Job',
    'CronJob',
    'Role',
    'RoleBinding',
    'Ingress',
    'PersistentVolumeClaim',
    'NetworkPolicy',
    'Namespace',
  ])('creates a parseable %s starter', (kind) => {
    const source = resourceTemplate({
      apiVersion: kind === 'Deployment' ? 'apps/v1' : 'v1',
      kind,
      resource: '',
      namespaced: kind !== 'Namespace',
    })
    const draft = parseManifestDraft(source)
    expect(draft.error).toBeNull()
    expect(draft.outline[0].kind).toBe(kind)
  })
})

describe('review lifecycle', () => {
  it('ignores late responses from an earlier operation or revision', () => {
    const current = operation(4, 'results', 'created')
    expect(mergeManifestOperation(current, operation(2, 'creating'))).toBe(current)
    expect(mergeManifestOperation(current, Object.assign(operation(6), { id: 'other' }))).toBe(
      current,
    )
    expect(mergeManifestOperation(current, operation(5))).toEqual(operation(5))
  })

  it('requires a reviewed, writable, error-free stage with ready resources', () => {
    expect(canCreateManifest(operation(1), false)).toBe(true)
    expect(canCreateManifest(operation(1), true)).toBe(false)
    expect(canCreateManifest(operation(1, 'results'), false)).toBe(false)
    expect(canCreateManifest(operation(1, 'review', 'failed'), false)).toBe(false)
    expect(canCreateManifest(operation(1, 'review', 'unknown'), false)).toBe(false)
    expect(canCreateManifest(operation(1, 'review', 'blocked'), false)).toBe(false)
  })
})
