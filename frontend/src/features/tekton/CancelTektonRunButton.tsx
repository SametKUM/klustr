import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CircleStop } from 'lucide-react'
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
import { ContextBadge } from '@/features/_shared/ContextBadge'

type Props = {
  contextName: string | null
  kind: 'PipelineRun' | 'TaskRun'
  namespace: string
  name: string
  variant?: 'detail' | 'row'
}

const EFFECT: Record<Props['kind'], string> = {
  PipelineRun:
    'Sets spec.status to Cancelled, like `tkn pipelinerun cancel`: running TaskRuns are stopped and finally tasks are skipped.',
  TaskRun:
    'Sets spec.status to TaskRunCancelled, like `tkn taskrun cancel`: its pod is stopped, and a PipelineRun it belongs to fails.',
}

export function CancelTektonRunButton({ contextName, kind, namespace, name, variant = 'detail' }: Props) {
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      if (kind === 'PipelineRun') await api.cancelTektonPipelineRun(contextName, namespace, name)
      else await api.cancelTektonTaskRun(contextName, namespace, name)
    },
    onSuccess: () => {
      toast.success(`Cancelling ${kind} ${name}`)
      setOpen(false)
    },
  })

  const trigger =
    variant === 'row' ? (
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
        title={EFFECT[kind]}
      >
        <CircleStop className="size-3" />
        Cancel
      </Button>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <CircleStop />
            Cancel
          </Button>
        </TooltipTrigger>
        <TooltipContent>{EFFECT[kind]}</TooltipContent>
      </Tooltip>
    )

  // A table row opens the detail on click, and React bubbles clicks from the
  // portaled dialog (overlay included) through this subtree; stop them here.
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      {trigger}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) mutation.reset()
          setOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {kind}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {namespace}/{name}
                </p>
                <p>{EFFECT[kind]}</p>
                <ContextBadge contextName={contextName} label="Target context" />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutation.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(mutation.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Keep running</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending ? 'Cancelling…' : `Cancel ${kind}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
