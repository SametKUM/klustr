import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useUIStore } from '@/store/ui'
import type { PodContainerBrief } from '@/lib/api'

const TONE_CLASS: Record<string, string> = {
  ready: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-destructive',
  done: 'bg-muted-foreground/40',
}

function toneClass(tone: string): string {
  return TONE_CLASS[tone] ?? 'bg-muted-foreground/40'
}

export function PodContainerSquares({
  containers,
  namespace,
  name,
  context,
}: {
  containers: PodContainerBrief[]
  namespace: string
  name: string
  context: string
}) {
  const openResource = useUIStore((s) => s.openResource)
  if (!containers || containers.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const firstInit = containers.findIndex((c) => c.init)
  const openLogs = (containerName: string) => {
    openResource({ kind: 'Pod', namespace, name, context, logContainer: containerName }, 'logs')
  }
  const label = `${containers.length} container${containers.length === 1 ? '' : 's'}: ${containers
    .map((c) => `${c.name}${c.init ? ' (init)' : ''} ${c.state}`)
    .join(', ')}`
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="flex w-fit items-center" tabIndex={0} role="img" aria-label={label}>
          {containers.map((c, i) => (
            <span
              key={i}
              className={[
                'h-2 w-2 rounded-[2px]',
                i === 0 ? '' : i === firstInit ? 'ml-2' : 'ml-[3px]',
                toneClass(c.tone),
                c.init ? 'opacity-50' : '',
              ].join(' ')}
            />
          ))}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-auto min-w-0 max-w-none p-1 font-mono text-[11px]"
      >
        <div className="space-y-0.5">
          {containers.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openLogs(c.name)
              }}
              title={`Open ${c.name} logs`}
              className="flex w-full items-center gap-2 whitespace-nowrap rounded px-2 py-1 text-left hover:bg-muted"
            >
              <span className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${toneClass(c.tone)} ${c.init ? 'opacity-50' : ''}`} />
              <span>{c.name}</span>
              {c.init && <span className="text-muted-foreground">(init)</span>}
              <span className="ml-auto pl-4 text-muted-foreground">{c.state}</span>
            </button>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
