import { expect, it } from 'vitest'
import type { TektonParamSpec, TektonWorkspaceSpec } from '@/lib/api'
import { buildStartOptions, initialStartForm, startProblems } from './tektonStart'

function param(over: Partial<TektonParamSpec>): TektonParamSpec {
  return {
    name: 'p',
    type: 'string',
    default: '',
    hasDefault: false,
    description: '',
    defaultValues: [],
    defaultObject: {},
    ...over,
  } as TektonParamSpec
}

const params = [
  param({ name: 'revision' }),
  param({ name: 'targets', type: 'array', hasDefault: true, default: 'linux, darwin', defaultValues: ['linux', 'darwin'] }),
  param({ name: 'image', type: 'object', hasDefault: true, defaultObject: { repo: 'registry.example.com/shop' } }),
  param({ name: 'verbose', hasDefault: true, default: 'false' }),
]
const workspaces = [
  { name: 'source', description: '', optional: false },
  { name: 'cache', description: '', optional: true },
] as TektonWorkspaceSpec[]

it('prefills defaults and leaves optional workspaces unbound', () => {
  const form = initialStartForm(params, workspaces)
  expect(form.params).toEqual({
    revision: '',
    targets: 'linux\ndarwin',
    image: 'repo=registry.example.com/shop',
    verbose: 'false',
  })
  expect(form.workspaces.source.kind).toBe('volumeClaimTemplate')
  expect(form.workspaces.cache.kind).toBe('none')
})

it('reports a required param, a missing workspace source and a malformed object line', () => {
  const form = initialStartForm(params, workspaces)
  form.params.image = 'repo'
  form.workspaces.source = { ...form.workspaces.source, kind: 'persistentVolumeClaim' }
  expect(startProblems(params, workspaces, form)).toEqual([
    'Param revision is required.',
    'Param image takes key=value lines.',
    'Workspace source needs a claim name.',
  ])
})

it('builds typed params and skips unbound optional workspaces', () => {
  const form = initialStartForm(params, workspaces)
  form.params.revision = 'main'
  form.params.targets = 'linux\n\n windows \n'
  form.serviceAccount = ' builder '
  const opts = buildStartOptions(params, workspaces, form)
  expect(opts.params).toEqual([
    { name: 'revision', type: 'string', value: 'main', values: [], object: {} },
    { name: 'targets', type: 'array', value: '', values: ['linux', 'windows'], object: {} },
    { name: 'image', type: 'object', value: '', values: [], object: { repo: 'registry.example.com/shop' } },
    { name: 'verbose', type: 'string', value: 'false', values: [], object: {} },
  ])
  expect(opts.workspaces).toEqual([
    { name: 'source', kind: 'volumeClaimTemplate', source: '', subPath: '', size: '1Gi', storageClass: '' },
  ])
  expect(opts.serviceAccount).toBe('builder')
  expect(startProblems(params, workspaces, form)).toEqual([])
})
