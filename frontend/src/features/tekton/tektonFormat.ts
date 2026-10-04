import type { TektonStep, TektonTaskCounts } from '@/lib/api'
import { formatAge } from '@/lib/time'

// Run states from the backend (tekton.go), bucketed from the Succeeded
// condition. skipped and notrun only appear on a PipelineRun's task rows.
export type TektonRunState =
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'running'
  | 'pending'
  | 'skipped'
  | 'notrun'

export function isTektonRunActive(state: string): boolean {
  return state === 'running' || state === 'pending'
}

const STATE_LABEL: Record<TektonRunState, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  running: 'Running',
  pending: 'Pending',
  skipped: 'Skipped',
  notrun: 'Not run',
}

// tektonStateLabel prefers the controller's reason ("Completed",
// "PipelineRunTimeout") over the generic bucket name, since it is what
// `tkn` and the Tekton Dashboard show.
export function tektonStateLabel(state: string, reason?: string): string {
  if (reason && state !== 'skipped' && state !== 'notrun') return reason
  return STATE_LABEL[state as TektonRunState] ?? (state || '—')
}

export function tektonStateClass(state: string): string {
  switch (state) {
    case 'succeeded':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'failed':
      return 'bg-destructive/15 text-destructive'
    case 'running':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'pending':
    case 'cancelled':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// tektonTaskSummary renders the PipelineRun task tally for the list, e.g.
// "11 done, 1 failed, 4 skipped". Zero counts other than done are omitted.
export function tektonTaskSummary(counts: TektonTaskCounts | undefined): string {
  if (!counts?.known) return '—'
  const parts = [`${counts.completed} done`]
  if (counts.failed) parts.push(`${counts.failed} failed`)
  if (counts.cancelled) parts.push(`${counts.cancelled} cancelled`)
  if (counts.incomplete) parts.push(`${counts.incomplete} running`)
  if (counts.skipped) parts.push(`${counts.skipped} skipped`)
  return parts.join(', ')
}

// tektonElapsed is a finished run's backend duration, or the live elapsed
// time of a run still going (the row re-renders on the clock tick).
export function tektonElapsed(duration: string, startTime: string, state: string): string {
  if (duration) return duration
  if (startTime && isTektonRunActive(state)) return formatAge(startTime)
  return '—'
}

// stepContainer picks the TaskRun step whose logs a reader most likely wants:
// the one running, else the first that failed, else the last that ran.
export function stepContainer(steps: TektonStep[]): string | undefined {
  const container = (s: TektonStep) => s.container || `step-${s.name}`
  const running = steps.find((s) => s.state === 'running')
  if (running) return container(running)
  const failed = steps.find((s) => s.state === 'terminated' && s.exitCode !== 0)
  if (failed) return container(failed)
  const ran = steps.filter((s) => s.state === 'terminated')
  if (ran.length > 0) return container(ran[ran.length - 1])
  return steps[0] ? container(steps[0]) : undefined
}
