import { lazy, Suspense } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileUp,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/lib/api'
import { canCreateManifest, formatManifest, resourceTemplate } from './manifestModel'
import { useManifestWorkspace, type ResourceEditorProps } from './useManifestWorkspace'
import { ResourceKindPicker } from './ResourceKindPicker'

const YAMLPane = lazy(() => import('./ManifestYAMLPane'))
const DiffPane = lazy(() =>
  import('./ManifestYAMLPane').then((module) => ({ default: module.ManifestDiffPane })),
)
const selectClass =
  'h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
export default function ResourceEditor(props: ResourceEditorProps) {
  const { open } = props
  const {
    activeContexts,
    selectedNamespaces,
    readOnly,
    namespaces,
    setSelectedNamespaces,
    contextName,
    namespace,
    changeNamespace,
    targetLocked,
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
  } = useManifestWorkspace(props)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[90vh] min-h-[min(28rem,90vh)] max-h-[94vh] w-[94vw] max-w-[94vw] min-w-[min(36rem,94vw)] resize flex-col gap-0 overflow-hidden p-0 sm:max-w-[94vw]"
          onEscapeKeyDown={(event) => {
            if (busy || (event.target instanceof Element && event.target.closest('.monaco-editor')))
              event.preventDefault()
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <DialogTitle>Create resource</DialogTitle>
                <DialogDescription className="text-xs">
                  Write or import YAML, review the server preview, then create. Existing resources
                  are never updated.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close resource editor"
                onClick={close}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
              <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                Context
                <select
                  aria-label="Target context"
                  className={`${selectClass} max-w-80`}
                  value={contextName}
                  disabled={busy || targetLocked}
                  onChange={(event) => changeTarget(event.target.value)}
                >
                  <option value="">Select a context</option>
                  {contextName && !connected && (
                    <option value={contextName}>{contextName} (disconnected)</option>
                  )}
                  {activeContexts.map((context) => (
                    <option key={context} value={context}>
                      {context}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Default namespace
                <Input
                  aria-label="Default namespace"
                  className="h-8 w-44 text-xs"
                  value={namespace}
                  list={`${modelId}-namespaces`}
                  disabled={busy || targetLocked}
                  onChange={(event) => changeNamespace(event.target.value)}
                />
                <datalist id={`${modelId}-namespaces`}>
                  {(namespaces[contextName] ?? []).map((item) => (
                    <option key={item.name} value={item.name} />
                  ))}
                </datalist>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Used only when metadata.namespace is absent
              </span>
            </div>
          </DialogHeader>
          {(readOnly || (contextName && !connected)) && (
            <Notice>
              {readOnly
                ? 'Read-only mode is enabled. Creating resources is disabled.'
                : 'The target context is disconnected. Reconnect it or select another context.'}
            </Notice>
          )}
          {targetLocked && (
            <Notice>
              {operation?.resources.some((item) => item.status === 'unknown')
                ? 'Check resources with unknown outcomes in the cluster before starting a new draft.'
                : 'Edit remaining resources or start a new draft to change the target.'}
            </Notice>
          )}
          {catalogError && (
            <Notice>
              <span>{catalogError}</span>
              <Button variant="ghost" size="xs" onClick={() => setRefresh((value) => value + 1)}>
                Retry discovery
              </Button>
            </Notice>
          )}
          {catalog?.warnings.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
          {error && (
            <div
              role="alert"
              className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            {operation ? (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy || operation.resources.some((item) => item.status === 'unknown')}
                  onClick={() => {
                    if (created > 0) editRemaining.mutate()
                    else discardPreview()
                  }}
                >
                  <ArrowLeft className="size-3" />{' '}
                  {created > 0 ? 'Edit remaining' : 'Edit manifest'}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setClearOpen(true)}
                >
                  <FilePlus2 className="size-3" /> New draft
                </Button>
                <span className="text-xs text-muted-foreground">
                  {operation.phase === 'review'
                    ? 'Review'
                    : operation.phase === 'creating'
                      ? 'Creating resources…'
                      : 'Results'}{' '}
                  · {created}/{operation.resources.length} created
                  {blocked > 0 ? ` · ${blocked} awaiting prerequisites` : ''}
                </span>
              </>
            ) : (
              <>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="xs" disabled={busy || !catalog}>
                      <Plus className="size-3" /> Add resource <ChevronDown className="size-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 max-w-[85vw] p-0" align="start">
                    <ResourceKindPicker
                      resources={catalog?.resources ?? []}
                      onSelect={(mapping) => {
                        changeSource(
                          source.trim()
                            ? `${source.trimEnd()}\n---\n${resourceTemplate(mapping)}`
                            : resourceTemplate(mapping),
                        )
                        setPickerOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileUp className="size-3" /> Import YAML
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={busy || !source.trim()}
                  onClick={() => {
                    try {
                      changeSource(formatManifest(source))
                    } catch {
                      setError('Cannot format invalid YAML.')
                    }
                  }}
                >
                  Format
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={busy || !source}
                  onClick={() => setClearOpen(true)}
                >
                  <RotateCcw className="size-3" /> Clear
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              disabled={!source.trim()}
              onClick={exportDraft}
            >
              <Download className="size-3" /> Export YAML
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml"
              className="hidden"
              aria-label="Import YAML file"
              onChange={(event) => {
                void importFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col sm:flex-row"
            onDragOver={(event) => {
              if (!operation && !busy) event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (!operation && !busy) void importFile(event.dataTransfer.files[0])
            }}
          >
            <aside
              className="max-h-36 w-full shrink-0 overflow-y-auto border-b border-border bg-muted/20 sm:max-h-none sm:w-60 sm:border-r sm:border-b-0"
              aria-label="Manifest resources"
            >
              <div className="border-b border-border px-3 py-2 text-xs font-medium">
                Resources{' '}
                <span className="text-muted-foreground">
                  ({operation?.resources.length ?? draft.outline.length})
                </span>
              </div>
              {operation
                ? operation.resources.map((item) => (
                    <button
                      type="button"
                      key={item.index}
                      onClick={() => {
                        setSelected(item.index)
                        setReveal(false)
                      }}
                      aria-pressed={selected === item.index}
                      className={`flex w-full items-start gap-2 border-b border-border/50 px-3 py-3 text-left hover:bg-muted ${selected === item.index ? 'bg-accent' : ''}`}
                    >
                      <StatusIcon status={item.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {item.kind}/{item.name || `${item.generateName}…`}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                          {item.namespace || 'Cluster-scoped'}
                        </span>
                        <span
                          className={`mt-1 block text-[11px] ${item.status === 'failed' || item.status === 'unknown' ? 'text-destructive' : 'text-muted-foreground'}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </span>
                    </button>
                  ))
                : draft.outline.map((item) => (
                    <button
                      key={item.index}
                      type="button"
                      onClick={() => jumpToResource(item.index)}
                      className={`w-full border-b border-border/50 px-3 py-3 text-left hover:bg-muted ${selected === item.index ? 'bg-accent' : ''}`}
                    >
                      <span className="block truncate text-xs font-medium">
                        {item.kind || 'Missing kind'}/{item.name || 'Unnamed'}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                        {item.namespace || namespace || 'Namespace from manifest'} · line{' '}
                        {item.line}
                      </span>
                    </button>
                  ))}
              {!operation && draft.outline.length === 0 && (
                <p className="px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                  Choose a resource type, paste a manifest, or drop a YAML file here.
                </p>
              )}
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {selectedResource && (
                <div className="shrink-0 space-y-2 border-b border-border px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">
                        {selectedResource.kind}/
                        {selectedResource.name || `${selectedResource.generateName}…`}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {operation!.contextName} · {selectedResource.namespace || 'Cluster-scoped'}
                      </span>
                    </span>
                    {selectedResource.sensitive && (
                      <Button size="xs" variant="outline" onClick={() => setReveal(!reveal)}>
                        {reveal ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        {reveal ? 'Hide values' : 'Reveal values'}
                      </Button>
                    )}
                  </div>
                  {selectedResource.error && (
                    <p role="alert" className="text-destructive">
                      {selectedResource.error}
                    </p>
                  )}
                  {selectedResource.status === 'blocked' && (
                    <p className="text-muted-foreground">
                      Create the prerequisites first:{' '}
                      {selectedResource.dependencies
                        .map((index) => {
                          const item = operation!.resources[index]
                          return `${item.kind}/${item.name}`
                        })
                        .join(', ')}
                      . Then review the remaining resources.
                    </p>
                  )}
                  {selectedResource.generateName && (
                    <p className="text-muted-foreground">
                      The final name is assigned during creation and may differ from the preview.
                    </p>
                  )}
                  {selectedResource.warnings.map((warning, index) => (
                    <p key={index} className="text-amber-700 dark:text-amber-300">
                      {warning}
                    </p>
                  ))}
                  {selectedResource.namespace &&
                    selectedNamespaces.length > 0 &&
                    !selectedNamespaces.includes(selectedResource.namespace) && (
                      <p className="text-muted-foreground">
                        This resource is outside the current namespace filter.{' '}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setSelectedNamespaces([selectedResource.namespace])}
                        >
                          Use {selectedResource.namespace}
                        </Button>
                      </p>
                    )}
                  {(selectedResource.status === 'created' ||
                    selectedResource.reason === 'AlreadyExists' ||
                    (selectedResource.status === 'unknown' && selectedResource.name)) && (
                    <Button variant="outline" size="xs" onClick={() => navigate(selectedResource)}>
                      Open{' '}
                      {selectedResource.status === 'created' ? 'resource' : 'existing resource'}
                    </Button>
                  )}
                </div>
              )}
              {operation && (
                <div className="flex shrink-0 justify-between gap-3 border-b border-border bg-muted/20 px-4 py-1.5 text-[11px] text-muted-foreground">
                  <span>Submitted manifest</span>
                  <span>
                    {selectedResource?.status === 'created'
                      ? 'Created resource'
                      : 'Server preview (not persisted)'}
                  </span>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <Suspense fallback={<LoadingEditor />}>
                  {operation ? (
                    preview ? (
                      <DiffPane before={preview.before} after={preview.after} />
                    ) : previewError ? (
                      <p className="p-4 text-xs text-destructive">{previewError}</p>
                    ) : (
                      <LoadingEditor />
                    )
                  ) : (
                    <YAMLPane
                      path={path}
                      source={source}
                      onChange={changeSource}
                      schema={schema}
                      readOnly={busy}
                      location={editorLocation}
                    />
                  )}
                </Suspense>
              </div>
            </div>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div
              className="min-w-0 flex-1 text-[11px] text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  {review.isPending || remaining.isPending
                    ? 'Running server-side validation…'
                    : 'Creating reviewed resources…'}
                </span>
              ) : operation ? (
                created === operation.resources.length ? (
                  'All resources were created.'
                ) : operation.phase === 'review' ? (
                  'Only resources marked Ready will be created in this step.'
                ) : (
                  'Created resources remain in the cluster. Review remaining resources before retrying.'
                )
              ) : (
                draft.error ||
                (schemaUnavailable.length
                  ? `Schema unavailable: ${schemaUnavailable.join(', ')}. Server validation remains available.`
                  : 'Draft stays in memory for this app session. No changes until you click Create.')
              )}
            </div>
            {operation?.phase === 'creating' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api
                    .cancelManifest(operation.id)
                    .catch(() => setError('Could not cancel. Check the operation status.'))
                }}
              >
                <Square className="size-3" /> Stop after current request
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={close}>
                  Close
                </Button>
                {operation?.phase === 'results' && created < operation.resources.length && (
                  <Button
                    size="sm"
                    disabled={
                      busy ||
                      !connected ||
                      operation.resources.some((item) => item.status === 'unknown')
                    }
                    onClick={() => remaining.mutate()}
                  >
                    <ShieldCheck className="size-3.5" /> Review remaining
                  </Button>
                )}
                {operation?.phase === 'review' && (
                  <Button
                    size="sm"
                    disabled={busy || !connected || !canCreateManifest(operation, readOnly)}
                    onClick={() => {
                      setError('')
                      create.mutate()
                    }}
                  >
                    Create {ready} {ready === 1 ? 'resource' : 'resources'}
                  </Button>
                )}
                {!operation && (
                  <Button
                    size="sm"
                    disabled={busy || !connected || readOnly || !source.trim() || !!draft.error}
                    onClick={startReview}
                  >
                    <ShieldCheck className="size-3.5" /> Review resources
                  </Button>
                )}
              </>
            )}
          </footer>
        </DialogContent>
      </Dialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the YAML from the editor. Export it first if you want to keep a copy.
              {operation && ' Resources already created remain in the cluster.'}
              {operation?.resources.some((item) => item.status === 'unknown') &&
                ' Check resources with unknown outcomes before creating them again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                changeSource('')
                setSelected(0)
                toast.success('Draft cleared')
              }}
            >
              Clear draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function LoadingEditor() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
      <Spinner size="sm" /> Loading editor…
    </div>
  )
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-300">
      {children}
    </div>
  )
}
function StatusIcon({ status }: { status: string }) {
  return status === 'creating' ? (
    <Spinner size="sm" />
  ) : status === 'created' || status === 'ready' ? (
    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
  ) : status === 'failed' || status === 'unknown' ? (
    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
  ) : (
    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/40" />
  )
}
function statusLabel(status: string) {
  return (
    (
      {
        pending: 'Pending',
        ready: 'Ready',
        created: 'Created',
        creating: 'Creating',
        blocked: 'Awaiting prerequisite',
        failed: 'Failed',
        unknown: 'Outcome unknown',
      } as Record<string, string>
    )[status] ?? status
  )
}
