import { useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useUIStore, type ResourceKind, type SelectedResource } from '@/store/ui'

const CONFIRM_BY_TYPING_KINDS: ReadonlySet<ResourceKind> = new Set<ResourceKind>([
  'Namespace',
  'Node',
  'PersistentVolume',
  'PersistentVolumeClaim',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'CronJob',
  'Job',
  'HorizontalPodAutoscaler',
  'PodDisruptionBudget',
  'NetworkPolicy',
  'Ingress',
  'Service',
  'Secret',
])

type DialogProps = {
  contextName: string | null
  resource: SelectedResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteResourceDialog({ contextName, resource, open, onOpenChange }: DialogProps) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [typed, setTyped] = useState('')

  const requireConfirmation = CONFIRM_BY_TYPING_KINDS.has(resource.kind as ResourceKind)
  const confirmed = typed === 'DELETE'

  const del = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.deleteResource(contextName, resource.kind, resource.namespace, resource.name)
    },
    onSuccess: () => {
      toast.success(`Deleted ${resource.kind.toLowerCase()}/${resource.name}`)
      onOpenChange(false)
      if (useUIStore.getState().selectedResource?.name === resource.name) {
        setSelectedResource(null)
      }
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
          <AlertDialogTitle>Delete {resource.kind}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will issue DELETE against {resource.kind.toLowerCase()}/{resource.name}
            {resource.namespace ? ` in namespace ${resource.namespace}` : ''}. The cluster's default
            propagation policy applies.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {del.error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
            {String(del.error)}
          </p>
        )}
        {requireConfirmation && (
          <div className="space-y-2">
            <label htmlFor="delete-confirm" className="text-sm">
              Type{' '}
              <span className="allow-select select-all cursor-text rounded bg-muted px-1 font-mono text-xs">
                DELETE
              </span>{' '}
              to confirm:
            </label>
            <Input
              id="delete-confirm"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmed && !del.isPending) {
                  e.preventDefault()
                  del.mutate()
                }
              }}
              disabled={del.isPending}
              className="font-mono text-sm"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={del.isPending || (requireConfirmation && !confirmed)}
            onClick={(e) => {
              e.preventDefault()
              del.mutate()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
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

export function DeleteResourceButton({ contextName, resource }: ButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="xs"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setOpen(true)}
          >
            <Trash2 />
            Delete
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Delete this {resource.kind.toLowerCase()} from the cluster — not reversible
        </TooltipContent>
      </Tooltip>
      <DeleteResourceDialog
        contextName={contextName}
        resource={resource}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
