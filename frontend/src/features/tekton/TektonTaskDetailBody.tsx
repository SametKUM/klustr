import { useCallback } from 'react'
import { api, type TektonTaskDetail, type TektonTaskStep } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { ParamSpecsTable, ResultSpecsTable, WorkspaceSpecsTable } from './TektonDetailPrimitives'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function TektonTaskDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getTektonTask(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<TektonTaskDetail>(contextName, 'Task', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Task">
        {detail.displayName && <Field label="Display name">{detail.displayName}</Field>}
        {detail.description && (
          <Field label="Description">
            <span className="whitespace-pre-wrap">{detail.description}</span>
          </Field>
        )}
        {detail.sidecars.length > 0 && <Field label="Sidecars">{detail.sidecars.join(', ')}</Field>}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title={`Steps (${detail.steps.length})`}>
        {detail.steps.length === 0 ? (
          <div className="text-xs text-muted-foreground">This task declares no steps.</div>
        ) : (
          <div className="space-y-3">
            {detail.steps.map((step, i) => (
              <StepSpec key={step.name || i} step={step} index={i} />
            ))}
          </div>
        )}
      </Section>

      <ParamSpecsTable params={detail.params} />
      <WorkspaceSpecsTable workspaces={detail.workspaces} />
      <ResultSpecsTable results={detail.results} />
    </div>
  )
}

function StepSpec({ step, index }: { step: TektonTaskStep; index: number }) {
  const command = [...step.command, ...step.args].join(' ')
  return (
    <div className="rounded border border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-mono font-medium">{step.name || `step ${index + 1}`}</span>
        {step.image && <Copyable className="font-mono text-muted-foreground" value={step.image} />}
        {step.ref && <span className="text-muted-foreground">StepAction {step.ref}</span>}
      </div>
      {command && (
        <pre className="overflow-x-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">{command}</pre>
      )}
      {step.script && (
        <pre className="max-h-80 overflow-auto px-3 py-2 font-mono text-xs">{step.script}</pre>
      )}
    </div>
  )
}
