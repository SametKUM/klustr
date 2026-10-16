import { useCallback } from 'react'
import { api, type TektonPipelineRunDetail, type TektonPipelineRunTask } from '@/lib/api'
import { formatAge, formatTimestamp } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { LinkButton, ValuesTable, WorkspaceBindingsTable } from './TektonDetailPrimitives'
import { TektonStatePill } from './TektonStatePill'
import { TektonTaskGraph } from './TektonTaskGraph'
import { tektonElapsed, tektonTaskSummary } from './tektonFormat'
import { mergeTaskState, type GraphTask } from './tektonGraph'
import { useOpenTektonResource } from './useOpenTektonResource'

// runGraphTasks folds a run's task rows into one graph node per pipeline
// task: a matrixed task has a row per TaskRun.
function runGraphTasks(rows: TektonPipelineRunTask[]): GraphTask[] {
  const byName = new Map<string, TektonPipelineRunTask[]>()
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r])
  return [...byName.values()].map((group) => ({
    name: group[0].name,
    label: group[0].displayName || group[0].name,
    dependsOn: group[0].dependsOn,
    finally: group[0].finally,
    state: mergeTaskState(group.map((r) => r.state)),
    count: group.length,
  }))
}

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function TektonPipelineRunDetailBody({ contextName, namespace, name }: Props) {
  useNowTick()
  const load = useCallback(
    (ctx: string) => api.getTektonPipelineRun(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<TektonPipelineRunDetail>(
    contextName,
    'PipelineRun',
    namespace,
    name,
    load,
  )
  const openTekton = useOpenTektonResource(contextName)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const tasks = detail.pipelineTasks.filter((t) => !t.finally)
  const finallyTasks = detail.pipelineTasks.filter((t) => t.finally)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="PipelineRun">
          <Field label="Status">
            <TektonStatePill state={detail.state} reason={detail.reason} />
          </Field>
          <Field label="Message">{detail.message || '—'}</Field>
          <Field label="Pipeline">
            {detail.pipelineRefName ? (
              <LinkButton onClick={() => openTekton('Pipeline', namespace, detail.pipelineRefName)}>
                {detail.pipeline}
              </LinkButton>
            ) : (
              detail.pipeline || '—'
            )}
          </Field>
          {detail.specStatus && <Field label="Requested status">{detail.specStatus}</Field>}
          <Field label="Service account">
            {detail.serviceAccount ? (
              <Copyable className="font-mono text-xs" value={detail.serviceAccount} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Timeout">{detail.timeout || '—'}</Field>
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
          <Field label="Tasks">{tektonTaskSummary(detail.tasks)}</Field>
        </Section>
      </div>

      {detail.pipelineTasks.length > 1 && (
        <Section title="Graph">
          <TektonTaskGraph
            tasks={runGraphTasks(detail.pipelineTasks)}
            onSelect={(task) => {
              const run = detail.pipelineTasks.find((r) => r.name === task && r.taskRunName)?.taskRunName
              if (run) openTekton('TaskRun', namespace, run)
            }}
          />
        </Section>
      )}

      <TaskTable
        title="Tasks"
        rows={tasks}
        emptyLabel="No tasks resolved yet."
        onOpenTaskRun={(taskRun) => openTekton('TaskRun', namespace, taskRun)}
      />
      {finallyTasks.length > 0 && (
        <TaskTable
          title="Finally"
          rows={finallyTasks}
          emptyLabel=""
          onOpenTaskRun={(taskRun) => openTekton('TaskRun', namespace, taskRun)}
        />
      )}

      <ValuesTable title="Params" values={detail.params} />
      <WorkspaceBindingsTable workspaces={detail.workspaces} />
      <ValuesTable title="Results" values={detail.results} />
    </div>
  )
}

function TaskTable({
  title,
  rows,
  emptyLabel,
  onOpenTaskRun,
}: {
  title: string
  rows: TektonPipelineRunTask[]
  emptyLabel: string
  onOpenTaskRun: (taskRun: string) => void
}) {
  return (
    <Section title={`${title} (${rows.length})`}>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Task</Th>
                <Th>Status</Th>
                <Th>Task ref</Th>
                <Th>Runs after</Th>
                <Th>Duration</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.name}/${row.taskRunName}`}
                  className={[
                    'border-t border-border align-top',
                    row.taskRunName ? 'cursor-pointer hover:bg-muted/30' : '',
                  ].join(' ')}
                  onClick={row.taskRunName ? () => onOpenTaskRun(row.taskRunName) : undefined}
                  title={row.taskRunName ? `Open TaskRun ${row.taskRunName}` : undefined}
                >
                  <Td>
                    <div className="font-mono">{row.name}</div>
                    {row.displayName && <div className="text-muted-foreground">{row.displayName}</div>}
                  </Td>
                  <Td>
                    <TektonStatePill state={row.state} reason={row.reason} message={row.message} />
                    {row.state === 'skipped' && row.reason && (
                      <div className="mt-0.5 text-muted-foreground">{row.reason}</div>
                    )}
                  </Td>
                  <Td className="font-mono">{row.taskRef || '—'}</Td>
                  <Td className="font-mono">{row.runAfter.length ? row.runAfter.join(', ') : '—'}</Td>
                  <Td className="whitespace-nowrap">
                    {tektonElapsed(row.duration, row.startTime, row.state)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
