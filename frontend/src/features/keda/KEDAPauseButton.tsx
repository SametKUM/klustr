import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { ContextBadge } from '@/features/_shared/ContextBadge'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

type Props = {
  contextName: string | null
  kind: 'ScaledObject' | 'ScaledJob'
  namespace: string
  name: string
}

const PAUSE_EFFECT: Record<Props['kind'], string> = {
  ScaledObject: 'KEDA stops scaling the target until resumed.',
  ScaledJob: 'KEDA stops creating Jobs until resumed. Running Jobs keep running.',
}

// KEDAPauseButton pauses or resumes a ScaledObject or ScaledJob through
// KEDA's pause annotations. Resume shows while any pause is in effect, a
// one-direction one included, so it can also clear a pause someone else
// applied.
export function KEDAPauseButton({ contextName, kind, namespace, name }: Props) {
  const load = useCallback(
    async (ctx: string) => {
      const d =
        kind === 'ScaledObject'
          ? await api.getKEDAScaledObject(ctx, namespace, name)
          : await api.getKEDAScaledJob(ctx, namespace, name)
      return {
        paused: d.paused || d.scaleInPaused || d.scaleOutPaused,
        annotated: d.annotated,
        minReplicas: d.minReplicas,
      }
    },
    [kind, namespace, name],
  )
  const { detail } = useResourceDetail(contextName, kind, namespace, name, load)
  const [open, setOpen] = useState(false)
  const [atReplicas, setAtReplicas] = useState(false)
  const [replicas, setReplicas] = useState(0)

  const mutation = useMutation({
    mutationFn: async (pause: boolean) => {
      if (!contextName) throw new Error('no context')
      if (kind === 'ScaledJob') await api.setKEDAScaledJobPaused(contextName, namespace, name, pause)
      else if (pause) await api.pauseKEDAScaledObject(contextName, namespace, name, atReplicas ? replicas : -1)
      else await api.resumeKEDAScaledObject(contextName, namespace, name)
    },
    onSuccess: (_, pause) => {
      toast.success(`${pause ? 'Paused' : 'Resumed'} ${kind} ${name}`)
      setOpen(false)
    },
    onError: (e) => toast.error(`${kind} pause toggle failed: ${e instanceof Error ? e.message : String(e)}`),
  })

  if (!detail) return null

  if (detail.annotated || detail.paused) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>
            <Play />
            Resume
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove the pause annotations so KEDA scales this {kind} again</TooltipContent>
      </Tooltip>
    )
  }

  if (kind === 'ScaledJob') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
            <Pause />
            Pause
          </Button>
        </TooltipTrigger>
        <TooltipContent>{PAUSE_EFFECT.ScaledJob}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          mutation.reset()
          setAtReplicas(false)
          setReplicas(detail.minReplicas)
          setOpen(true)
        }}
      >
        <Pause />
        Pause
      </Button>
      <Dialog open={open} onOpenChange={(o) => !mutation.isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pause ScaledObject</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-mono text-xs">
                    {namespace}/{name}
                  </span>
                  . {PAUSE_EFFECT.ScaledObject}
                </p>
                <ContextBadge contextName={contextName} label="Target context" />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="keda-pause" checked={!atReplicas} onChange={() => setAtReplicas(false)} />
              Keep the current replica count
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="keda-pause" checked={atReplicas} onChange={() => setAtReplicas(true)} />
              Scale to
              <input
                type="number"
                min={0}
                aria-label="Paused replicas"
                value={replicas}
                disabled={!atReplicas}
                onChange={(e) => setReplicas(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                className="h-7 w-16 rounded-md border border-border bg-transparent text-center text-sm disabled:opacity-50"
              />
              replicas and hold
            </label>
          </div>
          {mutation.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(mutation.error)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
              {mutation.isPending ? 'Pausing…' : 'Pause'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
