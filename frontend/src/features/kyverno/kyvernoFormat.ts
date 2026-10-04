import type { KyvernoKind } from './kyvernoKinds'

export type PolicyResult = 'fail' | 'error' | 'warn' | 'skip' | 'pass'

export function policyResultClass(result: string): string {
  switch (result) {
    case 'fail':
    case 'error':
      return 'bg-destructive/15 text-destructive'
    case 'warn':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    case 'pass':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function failureActionClass(action: string): string {
  switch (action) {
    case 'Enforce':
    case 'Deny':
      return 'text-destructive'
    case 'Audit':
    case 'Warn':
      return 'text-amber-700 dark:text-amber-300'
    default:
      return 'text-muted-foreground'
  }
}

// ruleSummary renders a policy's rule counts, e.g. "2 validate, 1 mutate".
export function ruleSummary(counts: {
  validate: number
  mutate: number
  generate: number
  verifyImages: number
}): string {
  const parts: string[] = []
  if (counts.validate) parts.push(`${counts.validate} validate`)
  if (counts.mutate) parts.push(`${counts.mutate} mutate`)
  if (counts.generate) parts.push(`${counts.generate} generate`)
  if (counts.verifyImages) parts.push(`${counts.verifyImages} verify images`)
  return parts.join(', ') || '—'
}

// policyRefFromResult maps a report result back to the policy object that
// produced it. Kyverno names a cluster-wide policy "<name>" and a namespaced
// one "<namespace>/<name>"; the source tells a CEL ValidatingPolicy from a
// classic policy. Results from other tools have no policy object to open.
export function policyRefFromResult(
  policy: string,
  source: string,
): { kind: KyvernoKind; namespace: string; name: string } | null {
  if (!policy) return null
  const slash = policy.indexOf('/')
  const namespace = slash > 0 ? policy.slice(0, slash) : ''
  const name = slash > 0 ? policy.slice(slash + 1) : policy
  if (source === 'kyverno') {
    return { kind: namespace ? 'Policy' : 'ClusterPolicy', namespace, name }
  }
  if (source === 'KyvernoValidatingPolicy') {
    return { kind: namespace ? 'NamespacedValidatingPolicy' : 'ValidatingPolicy', namespace, name }
  }
  return null
}
