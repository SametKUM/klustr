import type { HPAMetricTarget } from '@/lib/api'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { humanizeTrigger } from './triggers'

type Props = {
  metrics: HPAMetricTarget[]
  name?: string
  reference?: string
}

export function HPATargetBars({ metrics, name, reference }: Props) {
  if (!metrics || metrics.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const kedaMetrics = metrics.filter((m) => m.source === 'keda')
  const otherMetrics = metrics.filter((m) => m.source !== 'keda')

  const labelParts = otherMetrics.map((m) => `${m.name} ${readingFor(m) || '—'}`)
  if (kedaMetrics.length > 0) {
    labelParts.push(`${kedaMetrics.length} KEDA trigger${kedaMetrics.length === 1 ? '' : 's'}`)
  }
  const label = `Autoscaler metrics: ${labelParts.join('; ')}`

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div
          className="-mx-1 flex w-32 flex-col gap-1 rounded-sm px-1 transition-colors data-[state=open]:bg-muted/60"
          tabIndex={0}
          role="img"
          aria-label={label}
        >
          {otherMetrics.map((m, i) => (
            <MiniBar key={`row#${i}`} metric={m} />
          ))}
          {kedaMetrics.length > 0 && <KEDARowBadge count={kedaMetrics.length} />}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={24}
        className="max-h-[min(80vh,520px)] w-[min(24rem,calc(100vw-3rem))] overflow-y-auto p-0 font-mono text-[11px]"
      >
        <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
          {name && (
            <div className="border-b border-border/60 pb-2">
              <div className="truncate font-semibold text-foreground">{name}</div>
              {reference && (
                <div className="truncate text-[10px] text-muted-foreground">{reference}</div>
              )}
            </div>
          )}
          {otherMetrics.map((m, i) => (
            <MetricRow key={`o${i}`} metric={m} />
          ))}
          {kedaMetrics.length > 0 && otherMetrics.length > 0 && (
            <div className="h-px bg-border/60" />
          )}
          {kedaMetrics.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center rounded-sm bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-400">
                KEDA
              </span>
              <span>triggers · {kedaMetrics.length}</span>
            </div>
          )}
          {kedaMetrics.map((m, i) => (
            <MetricRow key={`k${i}`} metric={m} />
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function MetricRow({ metric }: { metric: HPAMetricTarget }) {
  const reading = readingFor(metric)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-3">
        <div className="min-w-0 flex-1">
          <MetricName name={metric.name} />
        </div>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
          {reading || '—'}
        </span>
      </div>
      {metric.text && (
        <span title={metric.text} className="break-words leading-snug text-muted-foreground">
          {humanizeTrigger(metric.text)}
        </span>
      )}
    </div>
  )
}

// MetricName badges cpu/memory with the same chips the Pods CPU/Mem popup uses,
// so the two hover popups read as one design. Other metric kinds (pods, object,
// external) keep their plain name.
function MetricName({ name }: { name: string }) {
  if (name === 'cpu') {
    return <ResourceBadge label="CPU" className="bg-sky-500/15 text-sky-400" />
  }
  if (name === 'memory') {
    return <ResourceBadge label="MEM" className="bg-emerald-500/15 text-emerald-400" />
  }
  return <span className="break-words text-foreground">{name}</span>
}

function ResourceBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  )
}

function readingFor(m: HPAMetricTarget): string {
  if (m.reading) return m.reading
  if (m.current >= 0 && m.target > 0) return `${m.current}% / ${m.target}%`
  return ''
}

function KEDARowBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[9px] text-muted-foreground">K</span>
      <div className="flex h-4 flex-1 items-center justify-between rounded-sm bg-sky-500/15 px-1.5 text-[10px] font-medium text-sky-400">
        <span>KEDA</span>
        <span className="tabular-nums opacity-70">×{count}</span>
      </div>
    </div>
  )
}

function MiniBar({ metric }: { metric: HPAMetricTarget }) {
  const label = shortLabel(metric.name)
  if (metric.target <= 0 || metric.current < 0) {
    const fallback =
      metric.reading || metric.text || '—'
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
        <span className="flex-1 truncate text-[11px] text-muted-foreground">
          {fallback}
        </span>
      </div>
    )
  }
  const fillPct = clampPct((metric.current / metric.target) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-muted/40">
        <div
          className={`absolute inset-y-0 left-0 ${usageColor(fillPct)}`}
          style={{ width: fillPct + '%' }}
        />
      </div>
      <span className="shrink-0 whitespace-nowrap text-right text-[10px] tabular-nums text-muted-foreground">
        {metric.current}%/{metric.target}%
      </span>
    </div>
  )
}

function shortLabel(name: string): string {
  if (name === 'cpu') return 'C'
  if (name === 'memory') return 'M'
  return name.charAt(0).toUpperCase()
}

function usageColor(pct: number): string {
  if (pct >= 90) return 'bg-destructive'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function clampPct(v: number): number {
  if (v < 0) return 0
  if (v > 100) return 100
  return v
}
