import { useMutation } from '@tanstack/react-query'
import { ExternalLink, Network, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { usePortForwards } from '@/store/portForwards'

export function PortForwardIndicator() {
  const list = usePortForwards((s) => s.list)
  const stop = useMutation({
    mutationFn: async (id: string) => {
      await api.stopPortForward(id)
    },
  })

  const active = list.length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Port-forwards">
          <Network className={active ? 'text-emerald-500' : 'text-muted-foreground'} />
          <span className="text-xs">
            {active ? `${list.length} forward${list.length === 1 ? '' : 's'}` : 'No forwards'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active port-forwards
        </div>
        {!active && (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No active port-forwards. Start one from a Pod or Service detail panel.
          </div>
        )}
        <ul className="max-h-80 overflow-auto">
          {list.map((pf) => (
            <li key={pf.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0">
              <button
                type="button"
                onClick={() => BrowserOpenURL(`http://localhost:${pf.localPort}`)}
                title={`Open http://localhost:${pf.localPort} in browser`}
                className="group flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left hover:text-primary"
              >
                <span className="flex w-full min-w-0 items-center gap-1 font-mono">
                  <span className="min-w-0 flex-1 truncate">
                    localhost:{pf.localPort} → {pf.podName}:{pf.remotePort}
                  </span>
                  <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="max-w-full truncate text-[10px] text-muted-foreground">
                  {pf.namespace} · {pf.context}
                </span>
              </button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Stop port-forward"
                disabled={stop.isPending}
                onClick={() => stop.mutate(pf.id)}
                className="shrink-0"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
