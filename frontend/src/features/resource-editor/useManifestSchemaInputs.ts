import { useMemo, useState } from 'react'
import type { ManifestObject, parseManifestDraft } from './manifestModel'
import { manifestSchemaInputs } from './manifestSchema'

export function useManifestSchemaInputs(draft: ReturnType<typeof parseManifestDraft>, empty: boolean): ManifestObject[] {
  // Incomplete keys are normal while typing. Dropping their schema would stop
  // the worker and remove completion precisely when the user needs it.
  const [input, setInput] = useState('[]')
  const previous = useMemo(() => JSON.parse(input) as ManifestObject[], [input])
  const prefix = manifestSchemaInputs(draft.objects)
  // A malformed paste can replace a document with a completely different GVK.
  const suffix = draft.schemaIdentities.slice(prefix.length).map((identity, index) => {
    const last = previous[prefix.length + index]
    return last?.apiVersion === identity.apiVersion && last?.kind === identity.kind ? last : identity
  })
  const next = JSON.stringify(draft.error && !empty
    ? [...prefix, ...suffix]
    : prefix)
  if (next !== input) setInput(next)
  return previous
}
