import type { SelectedResource } from '@/store/ui'

// Group + resources of the Tekton Pipelines kinds Klustr surfaces. Dispatch
// uses the bare CR kinds plus the group guard, like cert-manager, so a
// "Task" or "Pipeline" CRD from another group never lands in these views.
export const TEKTON_GROUP = 'tekton.dev'

export const TEKTON_PIPELINERUN_RESOURCE = 'pipelineruns'
export const TEKTON_TASKRUN_RESOURCE = 'taskruns'
export const TEKTON_PIPELINE_RESOURCE = 'pipelines'
export const TEKTON_TASK_RESOURCE = 'tasks'

export type TektonKind = 'PipelineRun' | 'TaskRun' | 'Pipeline' | 'Task'

export const TEKTON_RESOURCE_BY_KIND: Record<TektonKind, string> = {
  PipelineRun: TEKTON_PIPELINERUN_RESOURCE,
  TaskRun: TEKTON_TASKRUN_RESOURCE,
  Pipeline: TEKTON_PIPELINE_RESOURCE,
  Task: TEKTON_TASK_RESOURCE,
}

export function tektonKindOf(resource: SelectedResource | null): TektonKind | null {
  if (!resource || resource.gvr?.group !== TEKTON_GROUP) return null
  switch (resource.kind) {
    case 'PipelineRun':
    case 'TaskRun':
    case 'Pipeline':
    case 'Task':
      return resource.kind
    default:
      return null
  }
}
