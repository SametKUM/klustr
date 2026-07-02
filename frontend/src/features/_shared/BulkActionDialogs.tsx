import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type NodeDrainProgress } from '@/lib/api'

export type BulkItem = {
  contextName: string
  kind: string
  namespace: string
  name: string
}

type DialogProps = {
  items: BulkItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const PREVIEW_LIMIT = 8

function preview(items: BulkItem[]): { shown: BulkItem[]; rest: number } {
  if (items.length <= PREVIEW_LIMIT) return { shown: items, rest: 0 }
  return { shown: items.slice(0, PREVIEW_LIMIT), rest: items.length - PREVIEW_LIMIT }
}

function kindLabel(items: BulkItem[]): string {
  if (items.length === 0) return 'resource'
  const kinds = new Set(items.map((i) => i.kind))
  if (kinds.size === 1) {
    const kind = items[0].kind.toLowerCase()
    return items.length === 1 ? kind : `${kind}s`
  }
  return 'resources'
}

async function runAll<T extends BulkItem>(
  items: T[],
  op: (item: T) => Promise<void>,
): Promise<{ ok: number; failed: { item: T; err: unknown }[] }> {
  const results = await Promise.allSettled(items.map((it) => op(it)))
  const failed: { item: T; err: unknown }[] = []
  let ok = 0
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') ok += 1
    else failed.push({ item: items[idx], err: r.reason })
  })
  return { ok, failed }
}

function reportOutcome(
  action: 'Deleted' | 'Restarted' | 'Cordoned' | 'Uncordoned' | 'Drained',
  ok: number,
  failed: number,
  label: string,
) {
  if (failed === 0) {
    toast.success(`${action} ${ok} ${label}`)
  } else if (ok === 0) {
    toast.error(`Failed to ${action.toLowerCase().replace(/ed$/, '')} ${failed} ${label}`)
  } else {
    toast.warning(`${action} ${ok} ${label} — ${failed} failed`)
  }
}

export function BulkDeleteDialog({ items, open, onOpenChange, onSuccess }: DialogProps) {
  const [typed, setTyped] = useState('')
  // onSuccess clears the selection, emptying `items` while the dialog is still
  // mounted for its ~100ms close animation, which would flash "Delete 0" and an
  // empty list. Render from the last non-empty snapshot so the closing view
  // stays stable; the mutation still operates on the live `items`.
  const displayRef = useRef(items)
  if (items.length > 0) displayRef.current = items
  const display = items.length > 0 ? items : displayRef.current
  const label = kindLabel(display)
  const { shown, rest } = preview(display)
  const confirmed = typed === 'DELETE'

  const del = useMutation({
    mutationFn: async () => {
      return runAll(items, (it) =>
        api.deleteResource(it.contextName, it.kind, it.namespace, it.name),
      )
    },
    onSuccess: (res) => {
      reportOutcome('Deleted', res.ok, res.failed.length, label)
      onOpenChange(false)
      onSuccess?.()
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped('')
          del.reset()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {display.length} {label}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This issues DELETE against each item via the Kubernetes API. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs">
            {shown.map((it) => (
              <li key={`${it.contextName}/${it.namespace}/${it.name}`} className="truncate">
                {it.namespace ? `${it.namespace}/` : ''}
                {it.name}
              </li>
            ))}
            {rest > 0 && (
              <li className="text-muted-foreground">… and {rest} more</li>
            )}
          </ul>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Type{' '}
              <span className="allow-select select-all cursor-text rounded bg-muted px-1 font-mono">
                DELETE
              </span>{' '}
              to confirm.
            </p>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="font-mono"
            />
          </div>
          {del.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(del.error)}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmed || del.isPending}
            onClick={(e) => {
              e.preventDefault()
              del.mutate()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {del.isPending ? 'Deleting…' : `Delete ${display.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BulkRestartDialog({ items, open, onOpenChange, onSuccess }: DialogProps) {
  // See BulkDeleteDialog: render from the last non-empty snapshot so the
  // close animation doesn't flash "Restart 0" after the selection clears.
  const displayRef = useRef(items)
  if (items.length > 0) displayRef.current = items
  const display = items.length > 0 ? items : displayRef.current
  const label = kindLabel(display)
  const { shown, rest } = preview(display)

  const restart = useMutation({
    mutationFn: async () => {
      return runAll(items, (it) =>
        api.restartWorkload(it.contextName, it.kind, it.namespace, it.name),
      )
    },
    onSuccess: (res) => {
      reportOutcome('Restarted', res.ok, res.failed.length, label)
      onOpenChange(false)
      onSuccess?.()
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) restart.reset()
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restart {display.length} {label}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Triggers a rolling restart on each workload by patching
            spec.template.metadata.annotations — equivalent to kubectl rollout restart.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs">
            {shown.map((it) => (
              <li key={`${it.contextName}/${it.namespace}/${it.name}`} className="truncate">
                {it.namespace ? `${it.namespace}/` : ''}
                {it.name}
              </li>
            ))}
            {rest > 0 && (
              <li className="text-muted-foreground">… and {rest} more</li>
            )}
          </ul>
          {restart.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(restart.error)}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restart.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={restart.isPending}
            onClick={(e) => {
              e.preventDefault()
              restart.mutate()
            }}
          >
            {restart.isPending ? 'Restarting…' : `Restart ${display.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BulkCordonDialog({
  items,
  open,
  onOpenChange,
  onSuccess,
  cordon,
}: DialogProps & { cordon: boolean }) {
  // See BulkDeleteDialog: render from the last non-empty snapshot so the
  // close animation doesn't flash an empty list after the selection clears.
  const displayRef = useRef(items)
  if (items.length > 0) displayRef.current = items
  const display = items.length > 0 ? items : displayRef.current
  const { shown, rest } = preview(display)
  const verb = cordon ? 'Cordon' : 'Uncordon'

  const mut = useMutation({
    mutationFn: async () => {
      return runAll(items, (it) => api.cordonNode(it.contextName, it.name, cordon))
    },
    onSuccess: (res) => {
      reportOutcome(cordon ? 'Cordoned' : 'Uncordoned', res.ok, res.failed.length, kindLabel(display))
      onOpenChange(false)
      onSuccess?.()
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) mut.reset()
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {verb} {display.length} {kindLabel(display)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {cordon
              ? 'Sets spec.unschedulable=true on each node so no new pods are scheduled there. Running pods are not affected — equivalent to kubectl cordon.'
              : 'Sets spec.unschedulable=false on each node so it accepts new pods again — equivalent to kubectl uncordon.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs">
            {shown.map((it) => (
              <li key={`${it.contextName}/${it.name}`} className="truncate">
                {it.name}
              </li>
            ))}
            {rest > 0 && <li className="text-muted-foreground">… and {rest} more</li>}
          </ul>
          {mut.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(mut.error)}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mut.isPending}
            onClick={(e) => {
              e.preventDefault()
              mut.mutate()
            }}
          >
            {mut.isPending ? `${verb}ing…` : `${verb} ${display.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function drainKey(it: BulkItem): string {
  return `${it.contextName}/${it.name}`
}

function isTerminal(p: NodeDrainProgress): boolean {
  return p.phase === 'done' || p.phase === 'error'
}

export function BulkDrainDialog({ items, open, onOpenChange, onSuccess }: DialogProps) {
  // See BulkDeleteDialog: render from the last non-empty snapshot so the
  // close animation doesn't flash an empty list after the selection clears.
  const displayRef = useRef(items)
  if (items.length > 0) displayRef.current = items
  const display = items.length > 0 ? items : displayRef.current
  const { shown, rest } = preview(display)

  const [progress, setProgress] = useState<Record<string, NodeDrainProgress> | null>(null)
  const unsubsRef = useRef<(() => void)[]>([])
  const reportedRef = useRef(false)
  const unsubAll = () => {
    unsubsRef.current.forEach((u) => u())
    unsubsRef.current = []
  }
  useEffect(() => unsubAll, [])

  const started = progress !== null
  const allDone =
    started && display.every((it) => {
      const p = progress[drainKey(it)]
      return p !== undefined && isTerminal(p)
    })
  const draining = started && !allDone

  useEffect(() => {
    if (!allDone || reportedRef.current || progress === null) return
    reportedRef.current = true
    unsubAll()
    const failed = display.filter((it) => progress[drainKey(it)]?.phase === 'error').length
    reportOutcome('Drained', display.length - failed, failed, kindLabel(display))
    onSuccess?.()
  }, [allDone, progress, display, onSuccess])

  const start = () => {
    reportedRef.current = false
    unsubAll()
    const init: Record<string, NodeDrainProgress> = {}
    for (const it of items) {
      init[drainKey(it)] = { node: it.name, phase: 'cordoning', total: 0, evicted: 0, pending: [], error: '' }
    }
    setProgress(init)
    for (const it of items) {
      const key = drainKey(it)
      unsubsRef.current.push(
        EventsOn(`node:drain:${it.contextName}/${it.name}`, (p: NodeDrainProgress) => {
          setProgress((prev) => ({ ...prev, [key]: p }))
        }),
      )
      api.drainNode(it.contextName, it.name, false).catch((e: unknown) => {
        setProgress((prev) => ({
          ...prev,
          [key]: { node: it.name, phase: 'error', total: 0, evicted: 0, pending: [], error: String(e) },
        }))
      })
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // The backend keeps draining if the dialog closes mid-run; keep the
        // subscriptions so the summary toast still fires on completion.
        if (!next && !draining) {
          setProgress(null)
          unsubAll()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Drain {display.length} {kindLabel(display)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cordons each node, then evicts all pods through the Eviction API, so
            PodDisruptionBudgets are honored. DaemonSet-managed and static pods are left in
            place — equivalent to kubectl drain --ignore-daemonsets --delete-emptydir-data.
            Nodes stay cordoned afterwards. A node with pods not managed by a controller
            fails its drain; use the drain button on that node for the force option.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs">
            {shown.map((it) => {
              const p = progress?.[drainKey(it)]
              return (
                <li key={drainKey(it)} className="flex items-baseline gap-2">
                  <span className="truncate">{it.name}</span>
                  {p && (
                    <span
                      className={
                        p.phase === 'error'
                          ? 'ml-auto shrink-0 text-destructive'
                          : 'ml-auto shrink-0 text-muted-foreground'
                      }
                    >
                      {p.phase === 'done'
                        ? `done — ${p.total} pod(s) evicted`
                        : p.phase === 'error'
                          ? 'failed'
                          : `${p.phase} ${p.evicted}/${p.total}`}
                    </span>
                  )}
                </li>
              )
            })}
            {rest > 0 && <li className="text-muted-foreground">… and {rest} more</li>}
          </ul>
          {progress &&
            Object.values(progress)
              .filter((p) => p.error)
              .map((p) => (
                <p
                  key={p.node}
                  className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words"
                >
                  {p.node}: {p.error}
                </p>
              ))}
          {draining && (
            <p className="text-xs text-muted-foreground">
              Closing this dialog does not stop the drains.
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{started ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {!allDone && (
            <AlertDialogAction
              disabled={draining}
              onClick={(e) => {
                e.preventDefault()
                start()
              }}
            >
              {draining ? 'Draining…' : `Drain ${display.length}`}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
