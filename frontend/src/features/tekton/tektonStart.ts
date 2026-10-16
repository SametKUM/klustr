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

// StartForm holds only what the user changed, keyed by name; everything else
// is derived from the Pipeline's current spec (paramText, workspaceForm), so
// a live Pipeline update that adds or drops params or workspaces keeps the
// edits and never leaves a field without a value.
export type StartForm = {
  // Param text as typed: an array takes one item per line, an object one
  // key=value per line.
  params: Record<string, string | undefined>
  workspaces: Record<string, WorkspaceForm | undefined>
  serviceAccount: string
  timeout: string
}

export function emptyStartForm(): StartForm {
  return { params: {}, workspaces: {}, serviceAccount: '', timeout: '' }
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

export function paramText(form: StartForm, p: TektonParamSpec): string {
  return form.params[p.name] ?? defaultText(p)
}

// keepsDefault is true while a param still shows its default. Such a param is
// left to Tekton, which applies the default exactly: the line-per-item text
// cannot carry empty or padded array items, or a value with a newline in it.
function keepsDefault(form: StartForm, p: TektonParamSpec): boolean {
  return p.hasDefault && paramText(form, p) === defaultText(p)
}

export function workspaceForm(form: StartForm, w: TektonWorkspaceSpec): WorkspaceForm {
  return (
    form.workspaces[w.name] ?? {
      // An optional workspace is left unbound unless the user picks a source.
      kind: w.optional ? 'none' : 'volumeClaimTemplate',
      source: '',
      size: '1Gi',
      storageClass: '',
      subPath: '',
    }
  )
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

// startProblems lists what keeps the form from starting a run: a required
// param never filled in, a workspace without the name its kind needs, a
// malformed object line.
export function startProblems(params: TektonParamSpec[], workspaces: TektonWorkspaceSpec[], form: StartForm): string[] {
  const out: string[] = []
  for (const p of params) {
    if (keepsDefault(form, p)) continue
    const text = paramText(form, p)
    // Tekton needs a value for a param without a default, but an empty string
    // or array is one: a string counts as missing only until the user edits
    // it, so clearing the field sends "". An object needs its keys.
    const missing =
      !p.hasDefault &&
      (p.type === 'object' ? text.trim() === '' : p.type !== 'array' && form.params[p.name] === undefined)
    if (missing) out.push(`Param ${p.name} is required.`)
    if (p.type === 'object' && lines(text).some((l) => !l.includes('='))) out.push(`Param ${p.name} takes key=value lines.`)
  }
  for (const w of workspaces) {
    const binding = workspaceForm(form, w)
    if (binding.kind === 'none' && !w.optional) out.push(`Workspace ${w.name} is required.`)
    const kind = WORKSPACE_KINDS.find((k) => k.value === binding.kind)
    if (kind?.source && binding.source.trim() === '') out.push(`Workspace ${w.name} needs a ${kind.source.toLowerCase()}.`)
  }
  return out
}

export function buildStartOptions(params: TektonParamSpec[], workspaces: TektonWorkspaceSpec[], form: StartForm): TektonStartOptions {
  return {
    params: params.flatMap((p) => {
      if (keepsDefault(form, p)) return []
      const text = paramText(form, p)
      const type = p.type || 'string'
      return [
        {
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
        },
      ]
    }),
    workspaces: workspaces
      .map((w) => ({ w, b: workspaceForm(form, w) }))
      .filter(({ b }) => b.kind !== 'none')
      .map(({ w, b }) => ({
        name: w.name,
        kind: b.kind,
        source: b.source.trim(),
        subPath: b.subPath.trim(),
        size: b.size.trim(),
        storageClass: b.storageClass.trim(),
      })),
    serviceAccount: form.serviceAccount.trim(),
    timeout: form.timeout.trim(),
  } as TektonStartOptions
}
