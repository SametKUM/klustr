import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseDocument } from 'yaml'
import { api, type MutationDiff } from '@/lib/api'
import { deltaTouches, onKubeChange } from '@/lib/events'
import { useUIStore } from '@/store/ui'
import { Spinner } from '@/components/ui/spinner'
import { CopyButton } from './Copyable'

const Editor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.Editor })))
const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })),
)

import { useThemeMode } from './useThemeMode'

type Props = {
  contextName: string | null
  kind: string
  namespace: string
  name: string
  gvr?: { group: string; version: string; resource: string }
}

// K8s "invalid"/"immutable" errors echo the entire offending object inline, so
// the operative message ("field is immutable") drowns in a wall of JSON.
// Collapse the dumped object to a placeholder so the summary line stays legible
// — the full server response is still available below it.
function summarizeServerError(raw: string): string {
  return raw
    .replace(/\{.*\}/s, '{…}')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ResourceYAMLTab({ contextName, kind, namespace, name, gvr }: Props) {
  const theme = useThemeMode()
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const [source, setSource] = useState<string>('')
  const [draft, setDraft] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [stale, setStale] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)
  const requestRef = useRef(0)
  const gvrGroup = gvr?.group ?? ''
  const gvrVersion = gvr?.version ?? ''
  const gvrResource = gvr?.resource
  const changeKind = gvrResource ? `cr:${gvrGroup}/${gvrResource}` : kind

  const loadYAML = useCallback(async (refresh: boolean) => {
    if (!contextName) return
    const request = ++requestRef.current
    if (refresh) {
      setRefreshing(true)
      setRefreshError(null)
    } else {
      setLoaded(false)
      setLoadError(null)
      setRefreshError(null)
      setStale(false)
    }
    const fetcher = gvrResource
      ? api.getCustomResourceYAML(contextName, gvrGroup, gvrVersion, gvrResource, namespace, name)
      : api.getResourceYAML(contextName, kind, namespace, name)

    try {
      const yaml = await fetcher
      if (request !== requestRef.current) return
      setSource(yaml)
      setDraft(yaml)
      setLoaded(true)
      setStale(false)
    } catch (e: unknown) {
      if (request !== requestRef.current) return
      if (refresh) {
        setRefreshError(String(e))
      } else {
        setLoadError(String(e))
        setLoaded(true)
      }
    } finally {
      if (request === requestRef.current) setRefreshing(false)
    }
  }, [contextName, gvrGroup, gvrVersion, gvrResource, namespace, name, kind])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resource identity starts a fresh remote YAML lifecycle.
    void loadYAML(false)
    return () => {
      requestRef.current += 1
    }
  }, [loadYAML])

  useEffect(() => {
    if (!contextName) return
    return onKubeChange(changeKind, (changedContext, delta) => {
      if (changedContext !== contextName) return
      if (delta && !delta.reset && !deltaTouches(delta, namespace, name)) return
      setStale(true)
    })
  }, [contextName, changeKind, namespace, name])

  const dryRun = useMutation({
    mutationFn: async (): Promise<MutationDiff> => {
      if (!contextName) throw new Error('no context')
      return api.dryRunApplyResourceYAML(contextName, draft)
    },
  })

  const apply = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.applyResourceYAML(contextName, draft)
    },
    onSuccess: () => {
      toast.success(`Applied ${kind.toLowerCase()}/${name}`)
      setSource(draft)
      setEditing(false)
      setDiffOpen(false)
    },
  })

  const openReview = () => {
    apply.reset()
    dryRun.reset()
    setDiffOpen(true)
    dryRun.mutate()
  }

  const dirty = draft !== source

  const reviewError = dryRun.error ?? apply.error
  const reviewErrorFull = reviewError != null ? String(reviewError) : ''
  const reviewErrorSummary = summarizeServerError(reviewErrorFull)

  const formatDraft = () => {
    if (!draft.trim()) return
    try {
      const doc = parseDocument(draft)
      if (doc.errors.length > 0) {
        toast.error('Cannot format: invalid YAML')
        return
      }
      const formatted = doc.toString({ indent: 2 })
      if (formatted !== draft) setDraft(formatted)
    } catch {
      toast.error('Cannot format: invalid YAML')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <span className="text-muted-foreground">YAML</span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => void loadYAML(true)}
          disabled={!loaded || !!loadError || editing || dirty || refreshing}
          title={editing ? 'Finish or cancel editing before refreshing' : 'Refresh YAML'}
        >
          <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        {editing ? (
          <>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                setDraft(source)
                setEditing(false)
                apply.reset()
              }}
              disabled={apply.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={formatDraft}
              disabled={apply.isPending}
            >
              Format
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={openReview}
              disabled={!dirty || apply.isPending}
            >
              Review & apply
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={!loaded || !!loadError || readOnly || stale}
            title={
              readOnly
                ? 'Read-only mode — editing is disabled'
                : stale
                  ? 'Refresh the latest YAML before editing'
                  : undefined
            }
          >
            Edit
          </Button>
        )}
        <span className="ml-auto text-muted-foreground">
          {editing && dirty ? '● unsaved changes' : null}
        </span>
        {loaded && !loadError && (
          <CopyButton
            value={editing ? draft : source}
            toastLabel="YAML"
            ariaLabel="Copy YAML"
            iconClassName="size-3.5"
          />
        )}
      </div>
      {stale && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          Resource changed in the cluster.{' '}
          {editing
            ? 'Finish or cancel your edits, then refresh to load the latest YAML.'
            : 'Refresh to load the latest YAML.'}
        </div>
      )}
      {loadError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {loadError}
        </div>
      )}
      {refreshError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          Refresh failed: {refreshError}
        </div>
      )}
      {apply.error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {String(apply.error)}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}>
          {loaded && !loadError && (
            <Editor
              height="100%"
              language="yaml"
              value={editing ? draft : source}
              onChange={(v) => setDraft(v ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
              options={{
                readOnly: !editing,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                folding: true,
                fontSize: 12,
                fontFamily:
                  '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          )}
        </Suspense>
      </div>
      <Dialog
        open={diffOpen}
        onOpenChange={(o) => !apply.isPending && !dryRun.isPending && setDiffOpen(o)}
      >
        <DialogContent className="flex h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              Apply changes to {kind.toLowerCase()}/{name}
              {dryRun.data && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {dryRun.data.action}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Server-side dry-run: the live object (left) vs what the server predicts after
              defaulting and admission (right). Nothing is written until you click Apply.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {dryRun.isPending && (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                <Spinner size="sm" />
                Running server-side dry-run…
              </div>
            )}
            {dryRun.isError && (
              <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
                The server rejected this change during dry-run — see the error below.
              </div>
            )}
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading diff…</div>}>
              {dryRun.data && (
                <DiffEditor
                  height="100%"
                  language="yaml"
                  original={dryRun.data.before}
                  modified={dryRun.data.after}
                  theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    fontFamily:
                      '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    automaticLayout: true,
                  }}
                />
              )}
            </Suspense>
          </div>
          {reviewError != null && (
            <div className="border-t border-destructive/40 bg-destructive/10 px-6 py-2 text-xs text-destructive">
              <p className="font-medium break-words">{reviewErrorSummary}</p>
              {reviewErrorSummary !== reviewErrorFull && (
                <details className="mt-1">
                  <summary className="cursor-pointer select-none text-[11px] text-destructive/80 hover:text-destructive">
                    Full server response
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-destructive/90">
                    {reviewErrorFull}
                  </pre>
                </details>
              )}
            </div>
          )}
          <DialogFooter className="mx-0 mb-0 flex-row items-center justify-end gap-2 border-t border-border bg-transparent px-6 py-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiffOpen(false)}
              disabled={apply.isPending || dryRun.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => apply.mutate()}
              disabled={apply.isPending || dryRun.isPending || !dryRun.data}
            >
              {apply.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
