import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Scaling } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { api, type ContainerDetail } from '@/lib/api'

type Props = {
  contextName: string | null
  namespace: string
  podName: string
}

type Fields = {
  cpuRequest: string
  cpuLimit: string
  memRequest: string
  memLimit: string
}

function fieldsFor(c: ContainerDetail | undefined): Fields {
  return {
    cpuRequest: c?.resources?.cpuRequest ?? '',
    cpuLimit: c?.resources?.cpuLimit ?? '',
    memRequest: c?.resources?.memRequest ?? '',
    memLimit: c?.resources?.memLimit ?? '',
  }
}

export function ResizePodButton({ contextName, namespace, podName }: Props) {
  const [open, setOpen] = useState(false)
  const [containers, setContainers] = useState<ContainerDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [container, setContainer] = useState('')
  const [fields, setFields] = useState<Fields>(fieldsFor(undefined))

  const names = containers.map((c) => c.name)
  const current = containers.find((c) => c.name === container)

  useEffect(() => {
    if (!open || !contextName) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    api
      .getPod(contextName, namespace, podName)
      .then((p) => {
        if (cancelled) return
        setContainers(p.containers)
        const first = p.containers[0]
        setContainer(first?.name ?? '')
        setFields(fieldsFor(first))
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, contextName, namespace, podName])

  const selectContainer = (name: string) => {
    setContainer(name)
    setFields(fieldsFor(containers.find((c) => c.name === name)))
  }

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  const resize = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.resizePodResources(
        contextName,
        namespace,
        podName,
        container,
        fields.cpuRequest.trim(),
        fields.cpuLimit.trim(),
        fields.memRequest.trim(),
        fields.memLimit.trim(),
      )
    },
    onSuccess: () => {
      toast.success(`Resized ${container} on pod/${podName}`, {
        description: 'Applied in place via the resize subresource — watch the container status for the new allocation.',
      })
      setOpen(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) resize.reset()
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="xs" variant="outline">
              <Scaling />
              Resize
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Change CPU / memory in place, without recreating the pod</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resize pod resources</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <p>
                Changes a running container's CPU / memory requests and limits in place via the{' '}
                <code className="font-mono text-xs">pods/resize</code> subresource — the pod is not
                recreated. Whether the container restarts is governed by its{' '}
                <code className="font-mono text-xs">resizePolicy</code>.
              </p>
              <p>
                Leave a field blank to keep it unchanged. The QoS class can't change, and the node
                must have room or the request is deferred.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="sm" />
              Loading current resources…
            </div>
          )}
          {loadError && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {loadError}
            </p>
          )}

          {names.length > 1 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Container</span>
              <InlinePicker
                value={container}
                options={names}
                onChange={selectContainer}
                ariaLabel="Select container"
                minWidth={160}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPU request" placeholder="e.g. 250m" value={fields.cpuRequest} onChange={set('cpuRequest')} />
            <Field label="CPU limit" placeholder="e.g. 500m" value={fields.cpuLimit} onChange={set('cpuLimit')} />
            <Field label="Memory request" placeholder="e.g. 128Mi" value={fields.memRequest} onChange={set('memRequest')} />
            <Field label="Memory limit" placeholder="e.g. 256Mi" value={fields.memLimit} onChange={set('memLimit')} />
          </div>

          {current?.allocated && (current.allocated.cpuRequest || current.allocated.memRequest) && (
            <p className="text-[11px] text-muted-foreground">
              Currently allocated: CPU {current.allocated.cpuRequest || '—'}
              {current.allocated.cpuLimit ? ` / ${current.allocated.cpuLimit}` : ''}, Memory{' '}
              {current.allocated.memRequest || '—'}
              {current.allocated.memLimit ? ` / ${current.allocated.memLimit}` : ''}
            </p>
          )}

          {resize.error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
              {String(resize.error)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={resize.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => resize.mutate()}
            disabled={resize.isPending || !contextName || loading || !container}
          >
            {resize.isPending ? 'Resizing…' : 'Resize'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input value={value} onChange={onChange} placeholder={placeholder} className="font-mono" />
    </label>
  )
}
