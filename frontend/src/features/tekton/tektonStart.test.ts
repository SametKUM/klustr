import { expect, it } from 'vitest'
import type { TektonParamSpec, TektonWorkspaceSpec } from '@/lib/api'
import { buildStartOptions, emptyStartForm, paramText, startProblems, workspaceForm } from './tektonStart'

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

it('shows defaults and leaves optional workspaces unbound', () => {
  const form = emptyStartForm()
  expect(params.map((p) => paramText(form, p))).toEqual([
    '',
    'linux\ndarwin',
    'repo=registry.example.com/shop',
    'false',
  ])
  expect(workspaceForm(form, workspaces[0]).kind).toBe('volumeClaimTemplate')
  expect(workspaceForm(form, workspaces[1]).kind).toBe('none')
})

it('reports a required param, a missing workspace source and a malformed object line', () => {
  const form = emptyStartForm()
  form.params.image = 'repo'
  form.workspaces.source = { ...workspaceForm(form, workspaces[0]), kind: 'persistentVolumeClaim' }
  expect(startProblems(params, workspaces, form)).toEqual([
    'Param revision is required.',
    'Param image takes key=value lines.',
    'Workspace source needs a claim name.',
  ])
})

it('accepts a required string param cleared on purpose and sends it empty', () => {
  const form = emptyStartForm()
  form.params.revision = ''
  expect(startProblems(params, workspaces, form)).toEqual([])
  expect(buildStartOptions(params, workspaces, form).params).toEqual([
    { name: 'revision', type: 'string', value: '', values: [], object: {} },
  ])
})

it('still requires an object param without a default', () => {
  const settings = param({ name: 'settings', type: 'object' })
  const form = emptyStartForm()
  form.params.settings = ''
  expect(startProblems([settings], [], form)).toEqual(['Param settings is required.'])
})

it('builds typed params, leaves untouched defaults to Tekton and skips unbound optional workspaces', () => {
  const form = emptyStartForm()
  form.params.revision = 'main'
  form.params.targets = 'linux\n\n windows \n'
  form.serviceAccount = ' builder '
  const opts = buildStartOptions(params, workspaces, form)
  expect(opts.params).toEqual([
    { name: 'revision', type: 'string', value: 'main', values: [], object: {} },
    { name: 'targets', type: 'array', value: '', values: ['linux', 'windows'], object: {} },
  ])
  expect(opts.workspaces).toEqual([
    { name: 'source', kind: 'volumeClaimTemplate', source: '', subPath: '', size: '1Gi', storageClass: '' },
  ])
  expect(opts.serviceAccount).toBe('builder')
  expect(startProblems(params, workspaces, form)).toEqual([])
})

it('does not round-trip structured defaults through the line text', () => {
  const padded = param({ name: 'flags', type: 'array', hasDefault: true, defaultValues: ['', ' -v '] })
  const multiline = param({ name: 'files', type: 'object', hasDefault: true, defaultObject: { motd: 'one\ntwo' } })
  const form = emptyStartForm()
  expect(startProblems([padded, multiline], [], form)).toEqual([])
  expect(buildStartOptions([padded, multiline], [], form).params).toEqual([])
  // Text edited back to the default is still the default.
  form.params.flags = paramText(emptyStartForm(), padded)
  expect(buildStartOptions([padded], [], form).params).toEqual([])
})

it('binds a workspace the Pipeline gained after the form was filled', () => {
  const form = emptyStartForm()
  form.workspaces.source = { ...workspaceForm(form, workspaces[0]), kind: 'emptyDir' }
  const grown = [...workspaces, { name: 'output', description: '', optional: false } as TektonWorkspaceSpec]
  expect(startProblems(params, grown, form)).toContain('Param revision is required.')
  form.params.revision = 'main'
  expect(startProblems(params, grown, form)).toEqual([])
  expect(buildStartOptions(params, grown, form).workspaces.map((w) => [w.name, w.kind])).toEqual([
    ['source', 'emptyDir'],
    ['output', 'volumeClaimTemplate'],
  ])
})
