import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
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
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE } from './tektonKinds'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  variant?: 'detail' | 'row'
}

const EFFECT =
  'Creates a new PipelineRun with the same pipeline, params and workspaces. The new run starts right away.'

export function RerunTektonPipelineRunButton({ contextName, namespace, name, variant = 'detail' }: Props) {
  const [open, setOpen] = useState(false)
  const openResource = useUIStore((s) => s.openResource)
  const crd = useCRDStore((s) =>
    contextName ? findCRD(s.byContext, contextName, TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE) : null,
  )
  const mutation = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      return api.rerunTektonPipelineRun(contextName, namespace, name)
    },
    onSuccess: (created) => {
      toast.success(`Started PipelineRun ${created}`)
      setOpen(false)
      if (contextName && crd) {
        openResource({
          kind: 'PipelineRun',
          namespace,
          name: created,
          context: contextName,
          gvr: { group: crd.group, version: crd.version, resource: crd.resource },
        })
      }
    },
  })

  const trigger =
    variant === 'row' ? (
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
        title={EFFECT}
      >
        <RotateCw className="size-3" />
        Rerun
      </Button>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <RotateCw />
            Rerun
          </Button>
        </TooltipTrigger>
        <TooltipContent>{EFFECT}</TooltipContent>
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
            <AlertDialogTitle>Rerun PipelineRun?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {namespace}/{name}
                </p>
                <p>{EFFECT}</p>
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
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              {mutation.isPending ? 'Starting…' : 'Rerun'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
