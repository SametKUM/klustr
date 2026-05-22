import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Td, Th } from '@/features/_shared/DetailPrimitives'
import { api, type WorkloadRevision } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { onKubeChange } from '@/lib/events'
import { useThemeMode } from '@/features/_shared/useThemeMode'

const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })),
)

type Kind = 'Deployment' | 'StatefulSet' | 'DaemonSet'

type Props = {
  contextName: string | null
  kind: Kind
  namespace: string
  name: string
}

function listFor(kind: Kind) {
  switch (kind) {
    case 'Deployment':
      return api.listDeploymentRevisions
    case 'StatefulSet':
      return api.listStatefulSetRevisions
    case 'DaemonSet':
      return api.listDaemonSetRevisions
  }
}

function rollbackFor(kind: Kind) {
  switch (kind) {
    case 'Deployment':
      return api.rollbackDeployment
    case 'StatefulSet':
      return api.rollbackStatefulSet
    case 'DaemonSet':
      return api.rollbackDaemonSet
  }
}

export function RolloutHistoryTab({ contextName, kind, namespace, name }: Props) {
  const [revisions, setRevisions] = useState<WorkloadRevision[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [targetRevision, setTargetRevision] = useState<number | null>(null)
  const [diffRevision, setDiffRevision] = useState<number | null>(null)
  const [diffCurrent, setDiffCurrent] = useState<string>('')
  const [diffSelected, setDiffSelected] = useState<string>('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const themeMode = useThemeMode()
  const activeRevision = revisions.find((r) => r.active)?.revision ?? null

  const reload = useCallback(() => {
    if (!contextName) return
    setLoading(true)
    listFor(kind)(contextName, namespace, name)
      .then((list) => {
        setRevisions(list ?? [])
        setError(null)
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [contextName, kind, namespace, name])

  useEffect(() => {
    reload()
    return onKubeChange(kind, (ctx) => {
      if (ctx === contextName) reload()
    })
  }, [reload, kind, contextName])

  useEffect(() => {
    if (diffRevision === null || activeRevision === null || !contextName) {
      setDiffCurrent('')
      setDiffSelected('')
      setDiffError(null)
      return
    }
    let cancelled = false
    setDiffLoading(true)
    setDiffError(null)
    Promise.all([
      api.getWorkloadRevisionTemplate(contextName, kind, namespace, name, activeRevision),
      api.getWorkloadRevisionTemplate(contextName, kind, namespace, name, diffRevision),
    ])
      .then(([current, selected]) => {
        if (cancelled) return
        setDiffCurrent(current)
        setDiffSelected(selected)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDiffError(String(e))
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [diffRevision, activeRevision, contextName, kind, namespace, name])

  const rollback = useMutation({
    mutationFn: async (toRevision: number) => {
      if (!contextName) throw new Error('no context')
      await rollbackFor(kind)(contextName, namespace, name, toRevision)
    },
    onSuccess: (_data, toRevision) => {
      toast.success(`Rolled ${kind.toLowerCase()}/${name} back to revision ${toRevision}`)
      setTargetRevision(null)
      setDiffRevision(null)
      reload()
    },
    onError: (e: unknown) => {
      toast.error(`Rollback failed: ${String(e)}`)
    },
  })

  if (error) {
    return (
      <div className="px-6 py-4">
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      </div>
    )
  }

  if (loading && revisions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Spinner />
        Loading rollout history…
      </div>
    )
  }

  if (revisions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <History className="size-5 opacity-60" />
        No revisions found for this {kind.toLowerCase()}.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-4">
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Revision</Th>
              <Th>Age</Th>
              <Th>Change cause</Th>
              <Th>Images</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((r) => {
              const isSelected = diffRevision === r.revision
              return (
                <tr
                  key={r.revision}
                  className={[
                    'cursor-pointer border-t border-border align-top transition-colors',
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-muted/40',
                  ].join(' ')}
                  onClick={() =>
                    setDiffRevision((cur) =>
                      cur === r.revision || r.active ? null : r.revision,
                    )
                  }
                  aria-selected={isSelected}
                >
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">#{r.revision}</span>
                      {r.active && (
                        <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          active
                        </span>
                      )}
                      {isSelected && (
                        <span className="rounded bg-primary/20 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          diff
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>{formatAge(r.createdAt)}</Td>
                  <Td className="font-mono">{r.changeCause || '—'}</Td>
                  <Td className="font-mono">{r.images.join(', ') || '—'}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTargetRevision(r.revision)
                      }}
                      disabled={r.active || rollback.isPending}
                      className="gap-1"
                    >
                      <RotateCcw className="size-3" />
                      Rollback
                    </Button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Dialog
        open={diffRevision !== null}
        onOpenChange={(o) => {
          if (!o) setDiffRevision(null)
        }}
      >
        <DialogContent className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>
              {kind} revision diff — #{diffRevision} vs active #{activeRevision}
            </DialogTitle>
            <DialogDescription>
              Pod template of the selected revision (right) compared to the current active
              revision (left). Rollback applies the selected revision.
            </DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1">
            {diffError ? (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-xs font-mono text-destructive break-words">
                {diffError}
              </div>
            ) : diffLoading ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                Loading diff…
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    Loading editor…
                  </div>
                }
              >
                <DiffEditor
                  height="100%"
                  language="yaml"
                  original={diffCurrent}
                  modified={diffSelected}
                  theme={themeMode === 'dark' ? 'vs-dark' : 'vs-light'}
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
              </Suspense>
            )}
          </div>
          <DialogFooter className="mx-0 mb-0 flex-row items-center justify-end gap-2 border-t border-border bg-transparent px-6 py-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDiffRevision(null)}
              disabled={rollback.isPending}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (diffRevision !== null) setTargetRevision(diffRevision)
              }}
              disabled={diffLoading || diffError !== null || rollback.isPending}
              className="gap-1"
            >
              <RotateCcw className="size-3.5" />
              Rollback to #{diffRevision}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={targetRevision !== null}
        onOpenChange={(o) => {
          if (!o && !rollback.isPending) setTargetRevision(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to revision {targetRevision}?</AlertDialogTitle>
            <AlertDialogDescription>
              Restores the pod template from revision {targetRevision} onto {kind.toLowerCase()}/
              {name}
              {namespace ? ` in namespace ${namespace}` : ''}. Pods will be replaced with the
              older template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollback.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollback.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (targetRevision !== null) rollback.mutate(targetRevision)
              }}
            >
              {rollback.isPending ? 'Rolling back…' : 'Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
