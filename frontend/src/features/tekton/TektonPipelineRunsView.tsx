import { useMemo } from 'react'
import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import { api, type TektonPipelineRunInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore } from '@/store/ui'
import { CancelTektonRunButton } from './CancelTektonRunButton'
import { RerunTektonPipelineRunButton } from './RerunTektonPipelineRunButton'
import { TektonStatePill } from './TektonStatePill'
import { isTektonRunActive, tektonElapsed, tektonTaskSummary } from './tektonFormat'
import { TEKTON_GROUP, TEKTON_PIPELINERUN_RESOURCE } from './tektonKinds'

const columnHelper = createColumnHelper<TektonPipelineRunInfo>()
const NEWEST_FIRST: SortingState = [{ id: 'createdAt', desc: true }]

export function TektonPipelineRunsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('pipeline', {
        header: 'Pipeline',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('state', {
        header: 'Status',
        size: COL_MD,
        cell: (i) => (
          <TektonStatePill
            state={i.getValue()}
            reason={i.row.original.reason}
            message={i.row.original.message}
          />
        ),
      }),
      columnHelper.accessor((row) => tektonTaskSummary(row.tasks), {
        id: 'tasks',
        header: 'Tasks',
        size: COL_MD,
        cell: (i) => <TaskSummaryCell row={i.row.original} />,
      }),
      columnHelper.accessor('startTime', {
        header: 'Started',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
      columnHelper.accessor('duration', {
        header: 'Duration',
        size: COL_SM,
        // Rows re-render on the shared clock tick, so a running run keeps counting.
        cell: (i) => tektonElapsed(i.getValue(), i.row.original.startTime, i.row.original.state),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 180,
        cell: (i) => <RowActions row={i.row.original} />,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <CustomResourceTable
      group={TEKTON_GROUP}
      resource={TEKTON_PIPELINERUN_RESOURCE}
      kind="PipelineRun"
      noun={{ singular: 'pipeline run', plural: 'pipeline runs' }}
      scope="namespaced"
      fetch={api.listTektonPipelineRuns}
      columns={columns}
      defaultSort={NEWEST_FIRST}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Tekton Pipelines is not installed in the active contexts."
    />
  )
}

function TaskSummaryCell({ row }: { row: TektonPipelineRunInfo }) {
  const summary = tektonTaskSummary(row.tasks)
  if (summary === '—') return <span className="text-muted-foreground">—</span>
  return (
    <span className={row.tasks.failed > 0 ? 'text-destructive' : undefined} title={row.message}>
      {summary}
    </span>
  )
}

function RowActions({ row }: { row: TektonPipelineRunInfo }) {
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const contextName = resourceContext(row)
  if (readOnly || !contextName) return null
  return (
    <div className="flex items-center gap-1">
      <RerunTektonPipelineRunButton
        contextName={contextName}
        namespace={row.namespace}
        name={row.name}
        variant="row"
      />
      {isTektonRunActive(row.state) && (
        <CancelTektonRunButton
          contextName={contextName}
          kind="PipelineRun"
          namespace={row.namespace}
          name={row.name}
          variant="row"
        />
      )}
    </div>
  )
}
