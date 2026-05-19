import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Network } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type ContainerPort, type PodDetail } from '@/lib/api'
import { usePortForwards } from '@/store/portForwards'
import type { SelectedResource } from '@/store/ui'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'

type PortOption = ContainerPort & { containerName: string }

function suggestLocalPort(remote: number, used: Set<number>): number {
  const candidates: number[] = []
  if (remote >= 1024) candidates.push(remote)
  candidates.push(remote + 8000)
  candidates.push(remote + 10000)
  for (const p of candidates) {
    if (p >= 1024 && p <= 65535 && !used.has(p)) return p
  }
  for (let p = 30000; p < 60000; p++) {
    if (!used.has(p)) return p
  }
  return 0
}

type DialogProps = {
  contextName: string | null
  resource: SelectedResource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PortForwardDialog({ contextName, resource, open, onOpenChange }: DialogProps) {
  const activeForwards = usePortForwards((s) => s.list)
  const [remotePort, setRemotePort] = useState<number>(80)
  const [localPort, setLocalPort] = useState<number>(0)
  const [localPortTouched, setLocalPortTouched] = useState(false)
  const [openInBrowser, setOpenInBrowser] = useState(true)
  const [detail, setDetail] = useState<PodDetail | null>(null)

  useEffect(() => {
    if (!open || !contextName) return
    let cancelled = false
    api
      .getPod(contextName, resource.namespace, resource.name)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {
        /* fall back to manual entry */
      })
    return () => {
      cancelled = true
    }
  }, [open, contextName, resource.namespace, resource.name])

  const suggestions = useMemo<PortOption[]>(() => {
    if (!detail) return []
    const all: PortOption[] = []
    for (const c of detail.containers) {
      for (const p of c.ports ?? []) {
        all.push({ ...p, containerName: c.name })
      }
    }
    return all
  }, [detail])

  useEffect(() => {
    if (suggestions.length > 0) {
      setRemotePort(suggestions[0].containerPort)
    }
  }, [suggestions])

  useEffect(() => {
    if (localPortTouched) return
    const used = new Set(activeForwards.map((f) => f.localPort))
    setLocalPort(suggestLocalPort(remotePort, used))
  }, [remotePort, activeForwards, localPortTouched])

  const start = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      return api.startPortForward(contextName, resource.namespace, resource.name, localPort, remotePort)
    },
    onSuccess: (info) => {
      toast.success(`Forwarding localhost:${info.localPort} → ${resource.name}:${info.remotePort}`)
      if (openInBrowser) {
        BrowserOpenURL(`http://localhost:${info.localPort}`)
      }
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          start.reset()
          setLocalPortTouched(false)
          setOpenInBrowser(true)
        } else {
          setDetail(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Port-forward</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Forward a container port from{' '}
                <span className="font-mono text-xs">pod/{resource.name}</span> in{' '}
                <span className="font-mono text-xs">{resource.namespace}</span> to your machine.
                A free local port is suggested; set it to{' '}
                <span className="font-mono text-xs">0</span> to let the OS pick one.
              </p>
              {start.error && (
                <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                  {String(start.error)}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {suggestions.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Container ports</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((p, i) => {
                const active = remotePort === p.containerPort
                return (
                  <button
                    key={`${p.containerName}-${p.containerPort}-${i}`}
                    type="button"
                    onClick={() => setRemotePort(p.containerPort)}
                    className={[
                      'rounded border px-2 py-0.5 font-mono text-xs',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    {p.name ? `${p.name} ` : ''}
                    {p.containerPort}/{p.protocol}
                    <span className="ml-1 text-[10px] opacity-70">{p.containerName}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="w-28 text-sm text-muted-foreground">Local port</label>
          <input
            type="number"
            min={0}
            max={65535}
            value={localPort}
            onChange={(e) => {
              setLocalPortTouched(true)
              setLocalPort(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
            }}
            className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="w-28 text-sm text-muted-foreground">Remote port</label>
          <input
            type="number"
            min={1}
            max={65535}
            value={remotePort}
            onChange={(e) => setRemotePort(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={openInBrowser}
            onChange={(e) => setOpenInBrowser(e.target.checked)}
          />
          Open in browser after starting
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={start.isPending}>
            Cancel
          </Button>
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? 'Starting…' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ButtonProps = {
  contextName: string | null
  resource: SelectedResource
}

export function PortForwardButton({ contextName, resource }: ButtonProps) {
  const [open, setOpen] = useState(false)
  const [probe, setProbe] = useState<PodDetail | null>(null)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    api
      .getPod(contextName, resource.namespace, resource.name)
      .then((d) => {
        if (!cancelled) setProbe(d)
      })
      .catch(() => {
        /* leave optimistic until proven otherwise */
      })
    return () => {
      cancelled = true
    }
  }, [contextName, resource.namespace, resource.name])

  if (probe && !probe.containers.some((c) => (c.ports ?? []).length > 0)) {
    return null
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            <Network />
            Forward
          </Button>
        </TooltipTrigger>
        <TooltipContent>Forward a container port to your machine</TooltipContent>
      </Tooltip>
      <PortForwardDialog
        contextName={contextName}
        resource={resource}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
