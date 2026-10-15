import { useMemo, useState } from 'react'
import type { ManifestObject, parseManifestDraft } from './manifestModel'
import { manifestSchemaInputs } from './manifestSchema'

export function useManifestSchemaInputs(draft: ReturnType<typeof parseManifestDraft>, empty: boolean): ManifestObject[] {
  // Incomplete keys are normal while typing. Dropping their schema would stop
  // the worker and remove completion precisely when the user needs it.
  const next = draft.error && !empty ? null : JSON.stringify(manifestSchemaInputs(draft.objects))
  const [input, setInput] = useState(next ?? '[]')
  if (next !== null && next !== input) setInput(next)
  return useMemo(() => JSON.parse(input) as ManifestObject[], [input])
}
