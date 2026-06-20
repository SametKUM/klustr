import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

type Props = {
  cpuUsageMC: number
  cpuAllocMC: number
  memUsageB: number
  memAllocB: number
}

// Node CPU/memory usage rendered against allocatable (the node's "limit").
// Same visual language as the pod resource bars, minus the request marker —
// nodes have allocatable, not requests.
export function NodeResourceBars({ cpuUsageMC, cpuAllocMC, memUsageB, memAllocB }: Props) {
  const cpu = computeBar(cpuUsageMC, cpuAllocMC)
  const mem = computeBar(memUsageB, memAllocB)

  if (!cpu && !mem) {
    return <span className="text-muted-foreground">—</span>
  }

  const label = `CPU ${formatCPU(cpuUsageMC)} of ${cpuAllocMC > 0 ? formatCPU(cpuAllocMC) : '—'} allocatable; memory ${formatMem(memUsageB)} of ${memAllocB > 0 ? formatMem(memAllocB) : '—'} allocatable`

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="flex w-28 flex-col gap-1" tabIndex={0} role="img" aria-label={label}>
          <MiniBar label="C" value={cpu} />
          <MiniBar label="M" value={mem} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={8} className="min-w-0 max-w-none p-0 font-mono text-[11px]">
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 px-3 py-2.5">
          <ResourceBlock
            badge="CPU"
            badgeClass="bg-sky-500/15 text-sky-400"
            usage={formatCPU(cpuUsageMC)}
            alloc={cpuAllocMC > 0 ? formatCPU(cpuAllocMC) : '—'}
            pct={cpu}
          />
          <div className="col-span-2 my-1 h-px bg-border/60" />
          <ResourceBlock
            badge="MEM"
            badgeClass="bg-emerald-500/15 text-emerald-400"
            usage={formatMem(memUsageB)}
            alloc={memAllocB > 0 ? formatMem(memAllocB) : '—'}
            pct={mem}
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function ResourceBlock({
  badge,
  badgeClass,
  usage,
  alloc,
  pct,
}: {
  badge: string
  badgeClass: string
  usage: string
  alloc: string
  pct: Bar | null
}) {
  return (
    <>
      <div className="col-span-2 mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 font-semibold ${badgeClass}`}>
          {badge}
        </span>
        {pct && <span className="tabular-nums">{Math.round(pct.usagePct)}%</span>}
      </div>
      <span className="opacity-70">usage</span>
      <span className="whitespace-nowrap text-right tabular-nums">{usage}</span>
      <span className="opacity-70">allocatable</span>
      <span className="whitespace-nowrap text-right tabular-nums">{alloc}</span>
    </>
  )
}

type Bar = { usagePct: number }

function computeBar(usage: number, alloc: number): Bar | null {
  if (alloc <= 0) return null
  return { usagePct: clampPct((usage / alloc) * 100) }
}

function MiniBar({ label, value }: { label: string; value: Bar | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-muted/40">
        {value && (
          <div
            className={`absolute inset-y-0 left-0 ${usageColor(value)}`}
            style={{ width: value.usagePct + '%' }}
          />
        )}
      </div>
    </div>
  )
}

function usageColor(bar: Bar): string {
  if (bar.usagePct >= 90) return 'bg-destructive'
  if (bar.usagePct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function clampPct(v: number): number {
  if (v < 0) return 0
  if (v > 100) return 100
  return v
}

function formatCPU(mc: number): string {
  if (mc <= 0) return '0'
  const cores = mc / 1000
  return cores >= 10 ? `${cores.toFixed(0)} cores` : `${cores.toFixed(2)} cores`
}

function formatMem(b: number): string {
  if (b <= 0) return '0'
  const gi = b / 1024 ** 3
  if (gi >= 1) return `${gi.toFixed(1)} Gi`
  return `${Math.round(b / 1024 ** 2)} Mi`
}
