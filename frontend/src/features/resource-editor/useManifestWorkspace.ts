import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  api,
  type ManifestCatalog,
  type ManifestOperation,
  type ManifestPreview,
  type ManifestResource,
} from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { useResources } from '@/store/resources'
import { useActiveContexts, useUIStore, type ResourceKind } from '@/store/ui'
import { buildManifestSchema } from './manifestSchema'
import {
  asObject,
  MAX_MANIFEST_BYTES,
  mergeManifestOperation,
  parseManifestDraft,
  resourceTemplate,
} from './manifestModel'
import type { ResourceEditorRequest } from './resourceEditorContext'

export type ResourceEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: { serial: number; target: ResourceEditorRequest }
}

export function useManifestWorkspace({ open, onOpenChange, request }: ResourceEditorProps) {
  const activeContexts = useActiveContexts()
  const selectedNamespaces = useUIStore((state) => state.selectedNamespaces)
  const readOnly = useUIStore((state) => state.globalReadOnly)
  const namespaces = useResources((state) => state.namespaces)
  const openResource = useUIStore((state) => state.openResource)
  const setSelectedNamespaces = useUIStore((state) => state.setSelectedNamespaces)
  const [contextName, setContextName] = useState('')
  const [namespace, setNamespace] = useState('')
  const [source, setSource] = useState('')
  const [catalog, setCatalog] = useState<ManifestCatalog | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [operation, setOperation] = useState<ManifestOperation | null>(null)
  const [selected, setSelected] = useState(0)
  const [editorLocation, setEditorLocation] = useState({ line: 1 })
  const [previewState, setPreviewState] = useState<{
    key: string
    value: ManifestPreview | null
    error: string
  }>({ key: '', value: null, error: '' })
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [sources, setSources] = useState<Record<string, unknown>>({})
  const [schemaUnavailable, setSchemaUnavailable] = useState<string[]>([])
  const [refresh, setRefresh] = useState(0)
  const schemaCache = useRef(new Map<string, { promise: Promise<unknown>; expires: number }>())
  const inputRef = useRef<HTMLInputElement>(null)
  const serialRef = useRef(0)
  const draftEpoch = useRef(0)
  const operationRef = useRef(operation)
  useEffect(() => {
    operationRef.current = operation
  }, [operation])
  const modelId = useId().replace(/:/g, '')
  const path = `file:///klustr/resource-editor/${encodeURIComponent(contextName)}/${modelId}.yaml`
  const deferredSource = useDeferredValue(source)
  const draft = useMemo(() => parseManifestDraft(deferredSource), [deferredSource])
  const schema = useMemo(
    () => buildManifestSchema(draft.objects, sources),
    [draft.objects, sources],
  )
  const connected = activeContexts.includes(contextName)

  const review = useMutation({
    mutationFn: (input: { contextName: string; namespace: string; source: string; epoch: number }) => api.reviewManifest(input.contextName, input.namespace, input.source),
    onSuccess: (next, input) => {
      if (input.epoch !== draftEpoch.current) { void api.releaseManifest(next.id).catch(() => {}); return }
      setOperation(next)
      setSelected(0)
      setReveal(false)
      setError('')
    },
    onError: (reason, input) => { if (input.epoch === draftEpoch.current) setError(String(reason)) },
  })
  const remaining = useMutation({
    mutationFn: () => api.reviewRemainingManifest(operation!.id),
    onSuccess: (next) => {
      setOperation(next)
      setReveal(false)
      setError('')
    },
    onError: (reason) => setError(String(reason)),
  })
  const create = useMutation({
    mutationFn: () => api.createManifest(operation!.id),
    onSuccess: (next) => setOperation((current) => mergeManifestOperation(current, next)),
    onError: (reason) => setError(String(reason)),
  })
  const editRemaining = useMutation({
    mutationFn: () => api.getRemainingManifest(operation!.id),
    onSuccess: (value) => {
      discardPreview()
      setSource(value)
      setSelected(0)
    },
    onError: (reason) => setError(String(reason)),
  })
  const busy =
    review.isPending ||
    remaining.isPending ||
    create.isPending ||
    editRemaining.isPending ||
    operation?.phase === 'creating'
  const busyRef = useRef(busy)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])
  const ready = operation?.resources.filter((item) => item.status === 'ready').length ?? 0
  const created = operation?.resources.filter((item) => item.status === 'created').length ?? 0
  const blocked = operation?.resources.filter((item) => item.status === 'blocked').length ?? 0
  const selectedResource = operation?.resources[selected]
  const previewKey = `${operation?.id}/${operation?.revision}/${selected}/${reveal}/${open}`
  const preview = previewState.key === previewKey ? previewState.value : null
  const previewError = previewState.key === previewKey ? previewState.error : ''

  const discardPreview = () => {
    draftEpoch.current++
    const current = operationRef.current
    operationRef.current = null
    if (current && current.phase !== 'creating')
      void api.releaseManifest(current.id).catch(() => {})
    setOperation(null)
    setReveal(false)
    setError('')
  }
  const changeSource = (value: string) => {
    discardPreview()
    setSource(value)
  }
  const changeTarget = (value: string) => {
    discardPreview()
    setContextName(value)
    setNamespace('')
    setSources({})
    setSchemaUnavailable([])
    setCatalog(null)
    setCatalogError('')
  }

  useEffect(() => {
    if (!open || serialRef.current === request.serial) return
    serialRef.current = request.serial
    const target =
      request.target.contextName ?? (activeContexts.length === 1 ? activeContexts[0] : '')
    if (!busy) {
      if (target && target !== contextName) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- An explicit external open request seeds this editor session.
        changeTarget(target)
      } else if (!namespace && selectedNamespaces.length === 1) setNamespace(selectedNamespaces[0])
    }
    // A repeated entry point resumes the existing in-memory draft. Templates
    // are inserted only into an empty editor after discovery has completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Handle each explicit open request once.
  }, [open, request.serial])

  useEffect(() => {
    if (!open || !contextName) return
    let cancelled = false
    api
      .getManifestCatalog(contextName)
      .then((value) => {
        if (cancelled) return
        setCatalog(value)
        setCatalogError('')
        setNamespace(
          (current) =>
            current ||
            (selectedNamespaces.length === 1 ? selectedNamespaces[0] : value.defaultNamespace),
        )
        if (!source.trim() && (request.target.kind || request.target.resource)) {
          const mapping = value.resources.find(
            (item) =>
              (!request.target.kind || item.kind === request.target.kind) &&
              (!request.target.resource || item.resource === request.target.resource) &&
              (request.target.group === undefined ||
                item.apiVersion.split('/')[0] === request.target.group) &&
              (!request.target.apiVersion || item.apiVersion === request.target.apiVersion),
          )
          if (mapping) setSource((current) => current.trim() || busyRef.current ? current : resourceTemplate(mapping))
        }
      })
      .catch(() => {
        if (!cancelled)
          setCatalogError(
            'Could not discover resource types. Check the connection and discovery permissions.',
          )
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Namespace filters seed a target; they must not change an open editor's destination.
  }, [open, contextName, refresh, request.serial])

  useEffect(() => {
    if (!open || !contextName) return
    return onKubeChange('_crds', (changed) => {
      if (changed !== contextName) return
      schemaCache.current.clear()
      setRefresh((value) => value + 1)
    })
  }, [open, contextName])

  useEffect(() => {
    if (!open || !contextName) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      const versions = new Set<string>()
      const visit = (object: Record<string, unknown>) => {
        if (typeof object.apiVersion === 'string' && object.apiVersion)
          versions.add(object.apiVersion)
        if (object.kind === 'List' && Array.isArray(object.items))
          object.items.forEach((item) => visit(asObject(item)))
      }
      draft.objects.forEach(visit)
      void Promise.all(
        [...versions].map(async (version) => {
          const key = `${contextName}\n${version}`
          try {
            let cached = schemaCache.current.get(key)
            if (!cached || cached.expires < Date.now()) {
              const promise = api
                .getManifestSchema(contextName, version)
                .then((value) => JSON.parse(value) as unknown)
                .catch(() => null)
              cached = { promise, expires: Date.now() + 30_000 }
              schemaCache.current.set(key, cached)
            }
            return { version, value: await cached.promise }
          } catch {
            return { version, value: null }
          }
        }),
      ).then((results) => {
        if (cancelled) return
        setSources(
          Object.fromEntries(
            results
              .filter((result) => result.value)
              .map((result) => [result.version, result.value]),
          ),
        )
        setSchemaUnavailable(
          results.filter((result) => !result.value).map((result) => result.version),
        )
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, contextName, draft.objects, refresh])

  useEffect(() => {
    if (!operation) return
    let cancelled = false
    const accept = (incoming: ManifestOperation) => {
      if (!cancelled && incoming.id === operation.id && operationRef.current?.id === operation.id)
        setOperation((current) => mergeManifestOperation(current, incoming))
    }
    const unsubscribe = EventsOn('manifest:progress', accept)
    // Progress events can arrive while the dialog is hidden. Recover a missed
    // event on reopen/focus without polling the Kubernetes resource lists.
    const sync = () => {
      void api
        .getManifestOperation(operation.id)
        .then(accept)
        .catch(() => {})
    }
    sync()
    window.addEventListener('focus', sync)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('focus', sync)
    }
  }, [operation?.id, open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!operation || !open) return
    let cancelled = false
    api
      .getManifestPreview(operation.id, selected, reveal)
      .then((value) => {
        if (!cancelled) setPreviewState({ key: previewKey, value, error: '' })
      })
      .catch(() => {
        if (!cancelled)
          setPreviewState({
            key: previewKey,
            value: null,
            error: 'Preview expired or unavailable. Review the manifest again.',
          })
      })
    return () => {
      cancelled = true
    }
  }, [operation?.id, operation?.revision, selected, reveal, open, previewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const importFile = async (file?: File) => {
    if (!file || busy) return
    if (file.size > MAX_MANIFEST_BYTES) {
      setError('Manifest exceeds the 2 MiB limit.')
      return
    }
    try {
      const text = await file.text()
      if (busyRef.current) {
        setError('Wait for the current operation before importing a file.')
        return
      }
      discardPreview()
      setSource((current) => (current.trim() ? `${current.trimEnd()}\n---\n${text}` : text))
    } catch {
      setError('Could not read the selected file.')
    }
  }
  const exportDraft = () => {
    void api
      .saveTextFile('resources.yaml', source)
      .catch(() => setError('Could not export the manifest.'))
  }
  const navigate = (item: ManifestResource) => {
    const gv = item.apiVersion.includes('/') ? item.apiVersion.split('/') : ['', item.apiVersion]
    openResource(
      {
        context: operation!.contextName,
        namespace: item.namespace,
        name: item.name,
        kind: item.kind as ResourceKind,
        gvr: { group: gv[0], version: gv[1], resource: item.resource },
      },
      'yaml',
    )
    onOpenChange(false)
    setReveal(false)
  }
  const close = () => {
    setReveal(false)
    onOpenChange(false)
  }
  const startReview = () => { setError(''); review.mutate({ contextName, namespace, source, epoch: draftEpoch.current }) }
  const jumpToResource = (index: number) => { setSelected(index); setEditorLocation({ line: draft.outline[index]?.line ?? 1 }) }
  return {
    activeContexts,
    selectedNamespaces,
    readOnly,
    namespaces,
    setSelectedNamespaces,
    contextName,
    namespace,
    setNamespace,
    source,
    catalog,
    catalogError,
    operation,
    selected,
    editorLocation,
    jumpToResource,
    setSelected,
    reveal,
    setReveal,
    error,
    setError,
    pickerOpen,
    setPickerOpen,
    clearOpen,
    setClearOpen,
    schemaUnavailable,
    setRefresh,
    inputRef,
    modelId,
    path,
    draft,
    schema,
    connected,
    review,
    startReview,
    remaining,
    create,
    editRemaining,
    busy,
    ready,
    created,
    blocked,
    selectedResource,
    preview,
    previewError,
    discardPreview,
    changeSource,
    changeTarget,
    importFile,
    exportDraft,
    navigate,
    close,
  }
}
