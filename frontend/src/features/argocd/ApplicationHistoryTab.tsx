import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, RotateCcw, User } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { api, type ArgoApplicationHistoryEntry } from '@/lib/api'
import { formatAge } from '@/lib/time'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function ApplicationHistoryTab({ contextName, namespace, name }: Props) {
  const [rows, setRows] = useState<ArgoApplicationHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<ArgoApplicationHistoryEntry | null>(null)

  // The Argo detail panel keeps a navigation stack, so drilling App A → App B
  // while A's history request is in flight would otherwise resolve the stale
  // promise and overwrite B's rows. Gate setState on a generation token; the
  // RollbackDialog's onSuccess reuses the same reload.
  const genRef = useRef(0)
  const reload = useCallback(() => {
    if (!contextName) return
    const gen = ++genRef.current
    setRows(null)
    setError(null)
    api
      .listArgoApplicationHistory(contextName, namespace, name)
      .then((list) => {
        if (gen === genRef.current) setRows(list ?? [])
      })
      .catch((e) => {
        if (gen === genRef.current) setError(e instanceof Error ? e.message : String(e))
      })
  }, [contextName, namespace, name])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial load belongs to this resource lifecycle.
  useEffect(reload, [reload])

  if (error) {
    return (
      <div className="px-6 py-4 text-xs text-destructive">
        Failed to load history: {error}
      </div>
    )
  }
  if (rows === null) {
    return <div className="px-6 py-4 text-xs text-muted-foreground">Loading history…</div>
  }
  if (rows.length === 0) {
    return (
      <div className="px-6 py-4 text-xs text-muted-foreground">
        This Application has not been deployed yet — Argo hasn't recorded any history.
      </div>
    )
  }

  const current = rows[0]

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">ID</th>
            <th className="px-2 py-1.5 text-left font-medium">Revision</th>
            <th className="px-2 py-1.5 text-left font-medium">Source</th>
            <th className="px-2 py-1.5 text-left font-medium">Deployed</th>
            <th className="px-2 py-1.5 text-left font-medium">By</th>
            <th className="px-2 py-1.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isCurrent = r.id === current.id
            return (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-2 py-1.5 font-mono text-xs">{r.id}</td>
                <td className="px-2 py-1.5 font-mono text-xs">
                  {r.revision ? r.revision.slice(0, 8) : '—'}
                </td>
                <td className="px-2 py-1.5">
                  <SourceCell entry={r} />
                </td>
                <td className="px-2 py-1.5 text-xs" title={r.deployedAt || ''}>
                  {r.deployedAt ? formatAge(r.deployedAt) : '—'}
                </td>
                <td className="px-2 py-1.5 text-xs">
                  <InitiatorCell entry={r} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  {isCurrent ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Current
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPending(r)}
                    >
                      <RotateCcw className="size-3" />
                      Rollback
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {pending && (
        <RollbackDialog
          contextName={contextName}
          namespace={namespace}
          name={name}
          entry={pending}
          onOpenChange={(o) => {
            if (!o) setPending(null)
          }}
          onSuccess={() => {
            setPending(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function SourceCell({ entry }: { entry: ArgoApplicationHistoryEntry }) {
  if (!entry.path && !entry.targetRevision) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col text-xs">
      {entry.path && <span className="font-mono">{entry.path}</span>}
      {entry.targetRevision && (
        <span className="font-mono text-muted-foreground">@ {entry.targetRevision}</span>
      )}
    </div>
  )
}

function InitiatorCell({ entry }: { entry: ArgoApplicationHistoryEntry }) {
  const Icon = entry.automated ? Bot : User
  const label = entry.initiatedBy || (entry.automated ? 'auto-sync' : 'unknown')
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <Icon className="size-3 text-muted-foreground" />
      {label}
    </span>
  )
}

function RollbackDialog({
  contextName,
  namespace,
  name,
  entry,
  onOpenChange,
  onSuccess,
}: {
  contextName: string | null
  namespace: string
  name: string
  entry: ArgoApplicationHistoryEntry
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [prune, setPrune] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.rollbackArgoApplication(contextName, namespace, name, entry.id, prune)
    },
    onSuccess: () => {
      toast.success(`Rollback queued: ${name} → id=${entry.id}`)
      onSuccess()
    },
    onError: (e) => {
      toast.error(`Rollback failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          mutation.reset()
          setPrune(false)
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Rollback {name} to history id {entry.id}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Argo CD will run a sync against revision{' '}
            <span className="font-mono">
              {entry.revision ? entry.revision.slice(0, 8) : '(unknown)'}
            </span>{' '}
            from path <span className="font-mono">{entry.path || '/'}</span>. Any resources
            that don't exist in that revision can be left in place or pruned.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={prune}
            onChange={(e) => setPrune(e.target.checked)}
            disabled={mutation.isPending}
          />
          <span>
            Prune resources not in the target revision (
            <span className="font-mono text-xs">argocd app rollback --prune</span>)
          </span>
        </label>

        {mutation.error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
            {String(mutation.error)}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            {mutation.isPending ? 'Queuing…' : 'Rollback'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
