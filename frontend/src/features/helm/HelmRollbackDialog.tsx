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
import { api } from '@/lib/api'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  revision: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onRolledBack?: () => void
}

export function HelmRollbackDialog({
  contextName,
  namespace,
  name,
  revision,
  open,
  onOpenChange,
  onRolledBack,
}: Props) {
  const [wait, setWait] = useState(false)
  const m = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.rollbackHelmRelease(contextName, namespace, name, revision, wait)
    },
    onSuccess: () => {
      toast.success(`Rolled ${name} back to #${revision}`)
      onOpenChange(false)
      onRolledBack?.()
    },
    onError: (e) => toast.error(`Rollback failed: ${String(e)}`),
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => !m.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Roll back {name} to revision #{revision}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Creates a new revision from the chart and values used at revision{' '}
            <span className="font-mono">#{revision}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={wait} onChange={(e) => setWait(e.target.checked)} />
          Wait for resources to become ready
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={m.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              m.mutate()
            }}
            disabled={m.isPending}
          >
            {m.isPending ? 'Rolling back…' : 'Roll back'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
