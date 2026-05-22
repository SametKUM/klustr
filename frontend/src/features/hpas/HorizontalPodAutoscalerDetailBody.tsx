import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Minus, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api, type HPAMetricTarget, type HorizontalPodAutoscalerDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

const HARD_MAX_REPLICAS = 1000

export function HorizontalPodAutoscalerDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getHorizontalPodAutoscaler(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<HorizontalPodAutoscalerDetail>(contextName, 'HorizontalPodAutoscaler', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Reference">{detail.reference}</Field>
        <ReplicaBoundsEditor
          contextName={contextName}
          namespace={namespace}
          name={name}
          minReplicas={detail.minReplicas}
          maxReplicas={detail.maxReplicas}
        />
        <Field label="Current Replicas">{detail.currentReplicas}</Field>
        <Field label="Desired Replicas">{detail.desiredReplicas}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.metrics.length > 0 && (
        <Section title="Metrics">
          <div className="space-y-2">
            {detail.metrics.map((m, i) => (
              <MetricBar key={`${m.name}-${i}`} metric={m} />
            ))}
          </div>
        </Section>
      )}
      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{c.type}</Td>
                    <Td>{c.status}</Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}

function ReplicaBoundsEditor({
  contextName,
  namespace,
  name,
  minReplicas,
  maxReplicas,
}: {
  contextName: string | null
  namespace: string
  name: string
  minReplicas: number
  maxReplicas: number
}) {
  const [editing, setEditing] = useState(false)
  const [draftMin, setDraftMin] = useState(minReplicas)
  const [draftMax, setDraftMax] = useState(maxReplicas)

  const startEditing = () => {
    setDraftMin(minReplicas)
    setDraftMax(maxReplicas)
    setEditing(true)
  }

  const patch = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      await api.patchHPAReplicas(contextName, namespace, name, draftMin, draftMax)
    },
    onSuccess: () => {
      toast.success(`Updated min/max for hpa/${name}`)
      setEditing(false)
    },
    onError: (e: unknown) => {
      toast.error(`Update failed: ${String(e)}`)
    },
  })

  const dirty = draftMin !== minReplicas || draftMax !== maxReplicas
  const validation = validate(draftMin, draftMax)
  const canSave = dirty && validation === null && !patch.isPending

  if (!editing) {
    return (
      <Field label="Replicas">
        <div className="group flex items-center gap-2">
          <span className="font-mono tabular-nums">
            <span className="text-muted-foreground">min</span> {minReplicas}
            <span className="px-1.5 text-muted-foreground">→</span>
            <span className="text-muted-foreground">max</span> {maxReplicas}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Edit min/max replicas"
            onClick={startEditing}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="size-3" />
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <Field label="Replicas">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <LabeledNumberInput
            label="Min"
            value={draftMin}
            onChange={setDraftMin}
            disabled={patch.isPending}
            ariaLabel="Minimum replicas"
          />
          <span className="text-muted-foreground">→</span>
          <LabeledNumberInput
            label="Max"
            value={draftMax}
            onChange={setDraftMax}
            disabled={patch.isPending}
            ariaLabel="Maximum replicas"
          />
          <div className="ml-1 flex items-center gap-1">
            <Button size="xs" onClick={() => patch.mutate()} disabled={!canSave}>
              {patch.isPending && <Spinner size="sm" />}
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={patch.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
        {validation && <div className="text-xs text-destructive">{validation}</div>}
      </div>
    </Field>
  )
}

function validate(min: number, max: number): string | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 'Values must be numbers'
  if (min < 1) return 'Min must be ≥ 1'
  if (max < 1) return 'Max must be ≥ 1'
  if (min > max) return 'Min cannot exceed Max'
  return null
}

function LabeledNumberInput({
  label,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const clamp = (n: number) => Math.min(HARD_MAX_REPLICAS, Math.max(1, n))
  const bump = (delta: number) => onChange(clamp(value + delta))
  return (
    <InputGroup className="h-7 w-[150px]">
      <InputGroupAddon align="inline-start" className="gap-1.5">
        <InputGroupButton
          size="icon-xs"
          aria-label={`Decrement ${label}`}
          onClick={() => bump(-1)}
          disabled={disabled || value <= 1}
        >
          <Minus />
        </InputGroupButton>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </InputGroupAddon>
      <InputGroupInput
        aria-label={ariaLabel}
        type="number"
        min={1}
        max={HARD_MAX_REPLICAS}
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number.parseInt(e.target.value, 10) || 0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            bump(1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            bump(-1)
          }
        }}
        className="h-full px-1.5 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={`Increment ${label}`}
          onClick={() => bump(1)}
          disabled={disabled || value >= HARD_MAX_REPLICAS}
        >
          <Plus />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

function MetricBar({ metric }: { metric: HPAMetricTarget }) {
  if (metric.target <= 0 || metric.current < 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded border border-border bg-muted/20 px-3 py-2 text-xs">
        <span className="font-mono uppercase tracking-wide text-muted-foreground">{metric.name}</span>
        <span className="font-mono">{metric.text || '—'}</span>
      </div>
    )
  }
  const fillPct = Math.min(100, Math.max(0, (metric.current / metric.target) * 100))
  return (
    <div className="rounded border border-border bg-muted/20 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wide text-muted-foreground">{metric.name}</span>
        <span className="font-mono tabular-nums">
          {metric.current}% <span className="text-muted-foreground">/ target {metric.target}%</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-sm bg-muted/40">
        <div
          className={`absolute inset-y-0 left-0 ${usageColor(fillPct)}`}
          style={{ width: fillPct + '%' }}
        />
      </div>
    </div>
  )
}

function usageColor(pct: number): string {
  if (pct >= 90) return 'bg-destructive'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}
