import { useState } from 'react'
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
import { api } from '@/lib/api'

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

function reportOutcome(action: 'Deleted' | 'Restarted', ok: number, failed: number, label: string) {
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
  const label = kindLabel(items)
  const { shown, rest } = preview(items)
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
            Delete {items.length} {label}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This issues <code className="font-mono text-xs">DELETE</code> against each item via
                the Kubernetes API. This cannot be undone.
              </p>
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
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
              {del.error && (
                <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                  {String(del.error)}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            {del.isPending ? 'Deleting…' : `Delete ${items.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BulkRestartDialog({ items, open, onOpenChange, onSuccess }: DialogProps) {
  const label = kindLabel(items)
  const { shown, rest } = preview(items)

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
            Restart {items.length} {label}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Triggers a rolling restart on each workload by patching{' '}
                <code className="font-mono text-xs">spec.template.metadata.annotations</code> —
                equivalent to <code className="font-mono text-xs">kubectl rollout restart</code>.
              </p>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restart.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={restart.isPending}
            onClick={(e) => {
              e.preventDefault()
              restart.mutate()
            }}
          >
            {restart.isPending ? 'Restarting…' : `Restart ${items.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
