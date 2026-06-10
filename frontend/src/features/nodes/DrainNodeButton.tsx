import { MoveDownLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type NodeDrainProgress } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

const PENDING_PREVIEW = 6

type Props = {
  contextName: string | null
  resource: SelectedResource
}

export function DrainNodeButton({ contextName, resource }: Props) {
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<NodeDrainProgress | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  const draining =
    progress !== null && progress.phase !== 'done' && progress.phase !== 'error'

  useEffect(
    () => () => {
      unsubRef.current?.()
      unsubRef.current = null
    },
    [],
  )

  const start = () => {
    if (!contextName) return
    setStartError(null)
    setProgress({ node: resource.name, phase: 'cordoning', total: 0, evicted: 0, pending: [], error: '' })
    unsubRef.current?.()
    unsubRef.current = EventsOn(
      `node:drain:${contextName}/${resource.name}`,
      (p: NodeDrainProgress) => {
        setProgress(p)
        if (p.phase === 'done') {
          toast.success(`Drained node/${resource.name}`, {
            description: `${p.total} pod(s) evicted. The node stays cordoned.`,
          })
          unsubRef.current?.()
          unsubRef.current = null
        }
        if (p.phase === 'error') {
          unsubRef.current?.()
          unsubRef.current = null
        }
      },
    )
    api.drainNode(contextName, resource.name).catch((e: unknown) => {
      setStartError(String(e))
      setProgress(null)
      unsubRef.current?.()
      unsubRef.current = null
    })
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <MoveDownLeft />
            Drain
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cordon the node, then evict every pod onto other nodes</TooltipContent>
      </Tooltip>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drain node?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Cordons <span className="font-mono text-xs allow-select">node/{resource.name}</span>{' '}
                  and evicts all pods through the Eviction API, so PodDisruptionBudgets are
                  honored. DaemonSet-managed and static pods are left in place — equivalent to{' '}
                  <code className="font-mono text-xs">
                    kubectl drain --ignore-daemonsets --delete-emptydir-data --force
                  </code>
                  .
                </p>
                {progress && (
                  <div className="space-y-1 rounded border border-border bg-muted/40 p-2 font-mono text-xs">
                    <p>
                      {progress.phase === 'done'
                        ? `done — ${progress.total} pod(s) evicted`
                        : progress.phase === 'error'
                          ? 'failed'
                          : `${progress.phase} — ${progress.evicted}/${progress.total} pod(s) gone`}
                    </p>
                    {progress.pending.length > 0 && progress.phase !== 'done' && (
                      <p className="text-muted-foreground break-words">
                        waiting on:{' '}
                        {progress.pending.slice(0, PENDING_PREVIEW).join(', ')}
                        {progress.pending.length > PENDING_PREVIEW &&
                          ` +${progress.pending.length - PENDING_PREVIEW} more`}
                      </p>
                    )}
                    {progress.error && (
                      <p className="text-destructive break-words">{progress.error}</p>
                    )}
                  </div>
                )}
                {startError && (
                  <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                    {startError}
                  </p>
                )}
                {draining && (
                  <p className="text-xs text-muted-foreground">
                    Closing this dialog does not stop the drain.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{draining || progress?.phase === 'done' ? 'Close' : 'Cancel'}</AlertDialogCancel>
            {progress?.phase !== 'done' && (
              <AlertDialogAction
                disabled={draining || !contextName}
                onClick={(e) => {
                  e.preventDefault()
                  start()
                }}
              >
                {draining ? 'Draining…' : progress?.phase === 'error' ? 'Retry drain' : 'Drain'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
