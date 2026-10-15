import { useMemo, useState } from 'react'
import type { ManifestObject, parseManifestDraft } from './manifestModel'
import { manifestSchemaInputs } from './manifestSchema'

export function useManifestSchemaInputs(draft: ReturnType<typeof parseManifestDraft>, empty: boolean): ManifestObject[] {
  // Incomplete keys are normal while typing. Dropping their schema would stop
  // the worker and remove completion precisely when the user needs it.
  const [input, setInput] = useState('[]')
  const previous = useMemo(() => JSON.parse(input) as ManifestObject[], [input])
  const prefix = manifestSchemaInputs(draft.objects)
  const next = JSON.stringify(draft.error && !empty
    ? [...prefix, ...previous.slice(prefix.length)]
    : prefix)
  if (next !== input) setInput(next)
  return previous
}
