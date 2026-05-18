import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api, type HelmRevisionInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  currentRevision: number
  revisions: HelmRevisionInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRolledBack?: () => void
}

export function HelmRollbackPickerDialog({
  contextName,
  namespace,
  name,
  currentRevision,
  revisions,
  open,
  onOpenChange,
  onRolledBack,
}: Props) {
  const selectable = useMemo(
    () => revisions.filter((r) => r.revision !== currentRevision),
    [revisions, currentRevision],
  )
  const [picked, setPicked] = useState<number | null>(null)
  const [wait, setWait] = useState(false)

  useEffect(() => {
    if (!open) return
    setPicked(selectable[0]?.revision ?? null)
    setWait(false)
    // We intentionally only re-initialise when the dialog opens, not when the
    // user clicks a different revision. Including `selectable` here would reset
    // the picker on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const m = useMutation({
    mutationFn: async () => {
      if (!contextName || picked === null) throw new Error('no revision selected')
      await api.rollbackHelmRelease(contextName, namespace, name, picked, wait)
    },
    onSuccess: () => {
      toast.success(`Rolled ${name} back to #${picked}`)
      onOpenChange(false)
      onRolledBack?.()
    },
    onError: (e) => toast.error(`Rollback failed: ${String(e)}`),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !m.isPending && onOpenChange(o)}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Roll back {name}</DialogTitle>
          <DialogDescription>
            Pick a previous revision to roll back to. A new revision is created from
            the chart and values used at the chosen revision.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          {selectable.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No earlier revisions available.
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {selectable.map((r) => {
                const active = picked === r.revision
                return (
                  <li key={r.revision}>
                    <button
                      type="button"
                      onClick={() => setPicked(r.revision)}
                      className={[
                        'flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-xs',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/40',
                      ].join(' ')}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border">
                        {active && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <span className="font-mono">#{r.revision}</span>
                      <span className="font-mono text-muted-foreground">{r.chart}</span>
                      <span className="ml-auto text-muted-foreground">{r.status}</span>
                      <span className="w-20 text-right text-muted-foreground">
                        {r.updated ? formatAge(r.updated) : '—'}
                      </span>
                    </button>
                    {r.description && (
                      <div className="ml-7 pb-1 text-[10px] text-muted-foreground/80">
                        {r.description}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <label className="flex items-center gap-2 border-t border-border px-6 py-2 text-xs">
          <input
            type="checkbox"
            checked={wait}
            onChange={(e) => setWait(e.target.checked)}
          />
          Wait for resources to become ready
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={m.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => m.mutate()}
            disabled={m.isPending || picked === null}
          >
            {m.isPending ? 'Rolling back…' : picked !== null ? `Roll back to #${picked}` : 'Roll back'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
