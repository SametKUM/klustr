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
  open: boolean
  onOpenChange: (open: boolean) => void
  onUninstalled?: () => void
}

export function HelmUninstallDialog({
  contextName,
  namespace,
  name,
  open,
  onOpenChange,
  onUninstalled,
}: Props) {
  const [keepHistory, setKeepHistory] = useState(false)
  const m = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.uninstallHelmRelease(contextName, namespace, name, keepHistory)
    },
    onSuccess: () => {
      toast.success(`Uninstalled ${name}`)
      onOpenChange(false)
      onUninstalled?.()
    },
    onError: (e) => toast.error(`Uninstall failed: ${String(e)}`),
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => !m.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uninstall {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the Helm release and the resources it owns from{' '}
            <span className="font-mono">{namespace}</span>. This is not reversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={keepHistory}
            onChange={(e) => setKeepHistory(e.target.checked)}
          />
          Keep release history (allows rollback)
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
            {m.isPending ? 'Uninstalling…' : 'Uninstall'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
