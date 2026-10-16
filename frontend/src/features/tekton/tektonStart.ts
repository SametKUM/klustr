import type { TektonParamSpec, TektonStartOptions, TektonWorkspaceSpec } from '@/lib/api'

export type WorkspaceKind = 'none' | 'emptyDir' | 'volumeClaimTemplate' | 'persistentVolumeClaim' | 'configMap' | 'secret'

export const WORKSPACE_KINDS: { value: WorkspaceKind; label: string; source?: string }[] = [
  { value: 'volumeClaimTemplate', label: 'New volume per run' },
  { value: 'emptyDir', label: 'Empty directory' },
  { value: 'persistentVolumeClaim', label: 'Existing PVC', source: 'Claim name' },
  { value: 'configMap', label: 'ConfigMap', source: 'ConfigMap name' },
  { value: 'secret', label: 'Secret', source: 'Secret name' },
]

export type WorkspaceForm = { kind: WorkspaceKind; source: string; size: string; storageClass: string; subPath: string }

export type StartForm = {
  // Param text as typed: an array takes one item per line, an object one
  // key=value per line.
  params: Record<string, string>
  workspaces: Record<string, WorkspaceForm>
  serviceAccount: string
  timeout: string
}

function defaultText(p: TektonParamSpec): string {
  if (!p.hasDefault) return ''
  if (p.type === 'array') return p.defaultValues.join('\n')
  if (p.type === 'object') {
    return Object.entries(p.defaultObject)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
  }
  return p.default
}

export function initialStartForm(params: TektonParamSpec[], workspaces: TektonWorkspaceSpec[]): StartForm {
  return {
    params: Object.fromEntries(params.map((p) => [p.name, defaultText(p)])),
    workspaces: Object.fromEntries(
      workspaces.map((w) => [
        w.name,
        // An optional workspace is left unbound unless the user picks a source.
        { kind: w.optional ? 'none' : 'volumeClaimTemplate', source: '', size: '1Gi', storageClass: '', subPath: '' },
      ]),
    ),
    serviceAccount: '',
    timeout: '',
  }
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

// startProblems lists what keeps the form from starting a run: a required
// param left empty, a workspace without the name its kind needs, a malformed
// object line.
export function startProblems(params: TektonParamSpec[], workspaces: TektonWorkspaceSpec[], form: StartForm): string[] {
  const out: string[] = []
  for (const p of params) {
    const text = form.params[p.name] ?? ''
    // An empty array is a valid value; an empty string or object is not
    // when the param has no default.
    if (!p.hasDefault && p.type !== 'array' && text.trim() === '') out.push(`Param ${p.name} is required.`)
    if (p.type === 'object' && lines(text).some((l) => !l.includes('='))) out.push(`Param ${p.name} takes key=value lines.`)
  }
  for (const w of workspaces) {
    const binding = form.workspaces[w.name]
    if (!binding) continue
    if (binding.kind === 'none' && !w.optional) out.push(`Workspace ${w.name} is required.`)
    const kind = WORKSPACE_KINDS.find((k) => k.value === binding.kind)
    if (kind?.source && binding.source.trim() === '') out.push(`Workspace ${w.name} needs a ${kind.source.toLowerCase()}.`)
  }
  return out
}

export function buildStartOptions(params: TektonParamSpec[], workspaces: TektonWorkspaceSpec[], form: StartForm): TektonStartOptions {
  return {
    params: params.map((p) => {
      const text = form.params[p.name] ?? ''
      const type = p.type || 'string'
      return {
        name: p.name,
        type,
        value: type === 'string' ? text : '',
        values: type === 'array' ? lines(text) : [],
        object:
          type === 'object'
            ? Object.fromEntries(
                lines(text).map((l) => {
                  const i = l.indexOf('=')
                  return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
                }),
              )
            : {},
      }
    }),
    workspaces: workspaces
      .filter((w) => form.workspaces[w.name] && form.workspaces[w.name].kind !== 'none')
      .map((w) => {
        const b = form.workspaces[w.name]
        return {
          name: w.name,
          kind: b.kind,
          source: b.source.trim(),
          subPath: b.subPath.trim(),
          size: b.size.trim(),
          storageClass: b.storageClass.trim(),
        }
      }),
    serviceAccount: form.serviceAccount.trim(),
    timeout: form.timeout.trim(),
  } as TektonStartOptions
}
