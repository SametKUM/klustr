import { useCallback } from 'react'
import { api, type TektonPipelineDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import {
  LinkButton,
  ParamSpecsTable,
  ResultSpecsTable,
  WorkspaceSpecsTable,
} from './TektonDetailPrimitives'
import { useOpenTektonResource } from './useOpenTektonResource'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function TektonPipelineDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getTektonPipeline(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<TektonPipelineDetail>(
    contextName,
    'Pipeline',
    namespace,
    name,
    load,
  )
  const openTekton = useOpenTektonResource(contextName)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Pipeline">
        {detail.displayName && <Field label="Display name">{detail.displayName}</Field>}
        {detail.description && (
          <Field label="Description">
            <span className="whitespace-pre-wrap">{detail.description}</span>
          </Field>
        )}
        <Field label="Tasks">
          {detail.taskCount}
          {detail.finallyCount > 0 && ` + ${detail.finallyCount} finally`}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title={`Tasks (${detail.pipelineTasks.length})`}>
        {detail.pipelineTasks.length === 0 ? (
          <div className="text-xs text-muted-foreground">This pipeline declares no tasks.</div>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Task</Th>
                  <Th>Task ref</Th>
                  <Th>Runs after</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {detail.pipelineTasks.map((task) => (
                  <tr key={task.name} className="border-t border-border align-top">
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono">{task.name}</span>
                        {task.finally && (
                          <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            finally
                          </span>
                        )}
                      </div>
                      {task.displayName && <div className="text-muted-foreground">{task.displayName}</div>}
                    </Td>
                    <Td>
                      {task.taskRefName ? (
                        <LinkButton onClick={() => openTekton('Task', namespace, task.taskRefName)}>
                          {task.taskRef}
                        </LinkButton>
                      ) : (
                        <span className="font-mono">{task.taskRef || '—'}</span>
                      )}
                    </Td>
                    <Td className="font-mono">{task.runAfter.length ? task.runAfter.join(', ') : '—'}</Td>
                    <Td className="text-muted-foreground">
                      {task.when ? `${task.when} condition${task.when === 1 ? '' : 's'}` : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <ParamSpecsTable params={detail.params} />
      <WorkspaceSpecsTable workspaces={detail.workspaces} />
      <ResultSpecsTable results={detail.results} />
    </div>
  )
}
