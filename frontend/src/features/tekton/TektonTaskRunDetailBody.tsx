import { useCallback } from 'react'
import { api, type TektonStep, type TektonTaskRunDetail } from '@/lib/api'
import { formatAge, formatTimestamp } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { useUIStore } from '@/store/ui'
import { LinkButton, ValuesTable, WorkspaceBindingsTable } from './TektonDetailPrimitives'
import { TektonStatePill } from './TektonStatePill'
import { tektonElapsed } from './tektonFormat'
import { useOpenTektonResource } from './useOpenTektonResource'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function TektonTaskRunDetailBody({ contextName, namespace, name }: Props) {
  useNowTick()
  const load = useCallback(
    (ctx: string) => api.getTektonTaskRun(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<TektonTaskRunDetail>(
    contextName,
    'TaskRun',
    namespace,
    name,
    load,
  )
  const openTekton = useOpenTektonResource(contextName)
  const openResource = useUIStore((s) => s.openResource)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="TaskRun">
          <Field label="Status">
            <TektonStatePill state={detail.state} reason={detail.reason} />
          </Field>
          <Field label="Message">{detail.message || '—'}</Field>
          <Field label="Task">
            {detail.taskRefName ? (
              <LinkButton onClick={() => openTekton('Task', namespace, detail.taskRefName)}>
                {detail.task}
              </LinkButton>
            ) : (
              detail.task || '—'
            )}
          </Field>
          {detail.pipelineRun && (
            <Field label="PipelineRun">
              <LinkButton onClick={() => openTekton('PipelineRun', namespace, detail.pipelineRun)}>
                {detail.pipelineRun}
              </LinkButton>
            </Field>
          )}
          {detail.pipelineTask && <Field label="Pipeline task">{detail.pipelineTask}</Field>}
          <Field label="Pod">
            {detail.podName ? (
              <LinkButton
                onClick={() =>
                  openResource({
                    kind: 'Pod',
                    namespace,
                    name: detail.podName,
                    context: contextName ?? undefined,
                  })
                }
              >
                {detail.podName}
              </LinkButton>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Service account">
            {detail.serviceAccount ? (
              <Copyable className="font-mono text-xs" value={detail.serviceAccount} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Timeout">{detail.timeout || '—'}</Field>
          {detail.retries > 0 && <Field label="Retries">{detail.retries}</Field>}
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>

        <Section title="Timing">
          <Field label="Started">
            <span title={detail.startTime}>{formatTimestamp(detail.startTime)}</span>
          </Field>
          <Field label="Completed">
            <span title={detail.completionTime}>{formatTimestamp(detail.completionTime)}</span>
          </Field>
          <Field label="Duration">{tektonElapsed(detail.duration, detail.startTime, detail.state)}</Field>
          <Field label="Steps">
            {detail.stepsTotal ? `${detail.stepsDone}/${detail.stepsTotal} finished` : '—'}
          </Field>
        </Section>
      </div>

      <StepsTable steps={detail.steps} />
      <ValuesTable title="Params" values={detail.params} />
      <WorkspaceBindingsTable workspaces={detail.workspaces} />
      <ValuesTable title="Results" values={detail.results} />
    </div>
  )
}

function StepsTable({ steps }: { steps: TektonStep[] }) {
  if (steps.length === 0) return null
  return (
    <Section title={`Steps (${steps.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Step</Th>
              <Th>State</Th>
              <Th>Image</Th>
              <Th>Duration</Th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.name} className="border-t border-border align-top">
                <Td className="whitespace-nowrap font-mono">{step.name}</Td>
                <Td>
                  <StepState step={step} />
                </Td>
                <Td className="max-w-[28rem] break-all font-mono text-muted-foreground">
                  {step.image || '—'}
                </Td>
                <Td className="whitespace-nowrap">
                  {step.duration || (step.state === 'running' && step.startedAt ? formatAge(step.startedAt) : '—')}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// StepState colors a step by its container state: a terminated step by exit
// code, a running one as active, a waiting one by its reason.
function StepState({ step }: { step: TektonStep }) {
  if (step.state === 'terminated') {
    const ok = step.exitCode === 0
    return (
      <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
        {step.reason || (ok ? 'Completed' : 'Error')}
        {!ok && ` (exit ${step.exitCode})`}
      </span>
    )
  }
  if (step.state === 'running') {
    return <span className="text-sky-700 dark:text-sky-300">Running</span>
  }
  if (step.state === 'waiting') {
    return (
      <span className="text-amber-700 dark:text-amber-300" title={step.message || undefined}>
        {step.reason || 'Waiting'}
      </span>
    )
  }
  return <span className="text-muted-foreground">Pending</span>
}
