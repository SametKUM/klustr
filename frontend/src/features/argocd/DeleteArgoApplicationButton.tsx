import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
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
import { api, type ArgoApplicationResource, type ArgoCascadeMode } from '@/lib/api'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { ContextBadge } from '@/features/_shared/ContextBadge'

type Props = {
  contextName: string | null
  resource: SelectedResource
}

const MODE_OPTIONS: ReadonlyArray<{
  value: ArgoCascadeMode
  label: string
  description: string
}> = [
  {
    value: 'foreground',
    label: 'Foreground',
    description:
      'Add the Argo finalizer, then delete the Application — Kubernetes blocks until Argo has removed every managed resource. Safest; deletion shows progress.',
  },
  {
    value: 'background',
    label: 'Background',
    description:
      'Add the Argo finalizer, then delete the Application — the API returns immediately while Argo cleans up resources in the background.',
  },
  {
    value: 'non-cascading',
    label: 'Non-cascading',
    description:
      "Strip the Argo finalizer first, then delete only the Application CR. Managed resources stay in the cluster — use when handing ownership to another Application or removing Argo from the picture.",
  },
]

export function DeleteArgoApplicationButton({ contextName, resource }: Props) {
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
          Delete this Argo CD Application — choose how managed resources are handled
        </TooltipContent>
      </Tooltip>
      <DeleteArgoApplicationDialog
        contextName={contextName}
        resource={resource}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

type DialogProps = Props & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteArgoApplicationDialog({ contextName, resource, open, onOpenChange }: DialogProps) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [mode, setMode] = useState<ArgoCascadeMode>('foreground')
  const [typed, setTyped] = useState('')
  const [managed, setManaged] = useState<ArgoApplicationResource[] | null>(null)
  const [managedError, setManagedError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !contextName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Closing discards the managed-resource preview.
      setManaged(null)
      setManagedError(null)
      return
    }
    let cancelled = false
    api
      .listArgoApplicationResources(contextName, resource.namespace, resource.name)
      .then((list) => {
        if (!cancelled) setManaged(list)
      })
      .catch((e) => {
        if (!cancelled) setManagedError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [open, contextName, resource.namespace, resource.name])

  const cascading = mode !== 'non-cascading'
  const confirmed = typed === 'DELETE'

  const del = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.deleteArgoApplication(contextName, resource.namespace, resource.name, mode)
    },
    onSuccess: () => {
      const fate =
        mode === 'non-cascading'
          ? 'kept managed resources'
          : `${mode} cascade — Argo is cleaning up`
      toast.success(`Deleted application/${resource.name} (${fate})`)
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
          setMode('foreground')
          setTyped('')
          del.reset()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Application "{resource.name}"?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Choose how Argo CD should handle the {managed?.length ?? '…'} resources this
                Application currently manages.
              </p>
              <ContextBadge contextName={contextName} label="Target context" />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ManagedResourcesPreview list={managed} error={managedError} />

        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => {
            const selected = mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(opt.value)}
                disabled={del.isPending}
                className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-transparent hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-3 shrink-0 rounded-full border ${
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                  {opt.value === 'foreground' && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="mt-1 pl-5 text-xs text-muted-foreground">{opt.description}</div>
              </button>
            )
          })}
        </div>

        {del.error && (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
            {String(del.error)}
          </p>
        )}

        {cascading && (
          <div className="space-y-2">
            <label htmlFor="argo-delete-confirm" className="text-sm">
              Type{' '}
              <span className="allow-select select-all cursor-text rounded bg-muted px-1 font-mono text-xs">
                DELETE
              </span>{' '}
              to confirm a {mode} delete:
            </label>
            <Input
              id="argo-delete-confirm"
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
            disabled={del.isPending || (cascading && !confirmed)}
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

function ManagedResourcesPreview({
  list,
  error,
}: {
  list: ArgoApplicationResource[] | null
  error: string | null
}) {
  if (error) {
    return (
      <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
        Failed to load managed resources: {error}
      </p>
    )
  }
  if (list === null) {
    return <p className="text-xs text-muted-foreground">Loading managed resources…</p>
  }
  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This Application is not currently managing any resources.
      </p>
    )
  }
  return (
    <div className="max-h-40 overflow-y-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-left font-medium">Kind</th>
            <th className="px-2 py-1 text-left font-medium">Namespace</th>
            <th className="px-2 py-1 text-left font-medium">Name</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={`${r.group}/${r.kind}/${r.namespace}/${r.name}`} className="border-t border-border">
              <td className="px-2 py-1 font-mono">{r.kind}</td>
              <td className="px-2 py-1 font-mono">{r.namespace || '—'}</td>
              <td className="px-2 py-1 font-mono">{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
