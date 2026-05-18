import { useMutation } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
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
import type { ResourceKind, SelectedResource } from '@/store/ui'

const RESTARTABLE_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
])

export function isRestartable(kind: string): boolean {
  return RESTARTABLE_KINDS.has(kind as ResourceKind)
}

type DialogProps = {
  contextName: string | null
  resource: SelectedResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RestartWorkloadDialog({ contextName, resource, open, onOpenChange }: DialogProps) {
  const restart = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.restartWorkload(contextName, resource.kind, resource.namespace, resource.name)
    },
    onSuccess: () => {
      toast.success(`Restarted ${resource.kind.toLowerCase()}/${resource.name}`)
      onOpenChange(false)
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
          <AlertDialogTitle>Restart {resource.kind}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Triggers a rolling restart of{' '}
                <span className="font-mono text-xs allow-select">{resource.kind.toLowerCase()}/{resource.name}</span>
                {' '}in <span className="font-mono text-xs allow-select">{resource.namespace}</span> by patching{' '}
                <code className="font-mono text-xs">spec.template.metadata.annotations</code>{' '}
                — equivalent to <code className="font-mono text-xs">kubectl rollout restart</code>.
              </p>
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
            {restart.isPending ? 'Restarting…' : 'Restart'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type ButtonProps = {
  contextName: string | null
  resource: SelectedResource
}

export function RestartWorkloadButton({ contextName, resource }: ButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <RotateCcw />
            Restart
          </Button>
        </TooltipTrigger>
        <TooltipContent>Trigger a rolling restart of the pod template</TooltipContent>
      </Tooltip>
      <RestartWorkloadDialog
        contextName={contextName}
        resource={resource}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
