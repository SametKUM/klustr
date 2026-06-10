import { useMutation } from '@tanstack/react-query'
import { Ban, CircleCheck } from 'lucide-react'
import { useState } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useResources } from '@/store/resources'
import type { SelectedResource } from '@/store/ui'

type Props = {
  contextName: string | null
  resource: SelectedResource
}

export function CordonNodeButton({ contextName, resource }: Props) {
  const [open, setOpen] = useState(false)
  const unschedulable = useResources(
    (s) =>
      (contextName ? s.nodes[contextName] : undefined)
        ?.find((n) => n.name === resource.name)
        ?.status.includes('SchedulingDisabled') ?? false,
  )
  const cordon = !unschedulable

  const mutate = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.cordonNode(contextName, resource.name, cordon)
    },
    onSuccess: () => {
      toast.success(`${cordon ? 'Cordoned' : 'Uncordoned'} node/${resource.name}`)
      setOpen(false)
    },
  })

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            {cordon ? <Ban /> : <CircleCheck />}
            {cordon ? 'Cordon' : 'Uncordon'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {cordon
            ? 'Mark the node unschedulable — running pods are not touched'
            : 'Allow new pods to be scheduled on this node again'}
        </TooltipContent>
      </Tooltip>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) mutate.reset()
          setOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{cordon ? 'Cordon' : 'Uncordon'} node?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Sets <code className="font-mono text-xs">spec.unschedulable</code> to{' '}
                  <code className="font-mono text-xs">{String(cordon)}</code> on{' '}
                  <span className="font-mono text-xs allow-select">node/{resource.name}</span> —
                  equivalent to{' '}
                  <code className="font-mono text-xs">
                    kubectl {cordon ? 'cordon' : 'uncordon'}
                  </code>
                  .{' '}
                  {cordon
                    ? 'New pods stop landing on the node; running pods keep running.'
                    : 'The scheduler can place new pods on the node again.'}
                </p>
                {mutate.error && (
                  <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                    {String(mutate.error)}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutate.isPending}
              onClick={(e) => {
                e.preventDefault()
                mutate.mutate()
              }}
            >
              {mutate.isPending
                ? cordon
                  ? 'Cordoning…'
                  : 'Uncordoning…'
                : cordon
                  ? 'Cordon'
                  : 'Uncordon'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
