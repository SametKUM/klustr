import { useCallback } from 'react'
import { api } from '@/lib/api'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CancelTektonRunButton } from './CancelTektonRunButton'
import { RerunTektonPipelineRunButton } from './RerunTektonPipelineRunButton'
import { isTektonRunActive } from './tektonFormat'
import { TEKTON_PIPELINERUN_RESOURCE, TEKTON_TASKRUN_RESOURCE } from './tektonKinds'

type Props = {
  contextName: string | null
  kind: 'PipelineRun' | 'TaskRun'
  namespace: string
  name: string
}

// TektonRunHeaderActions renders the detail header's run actions. It follows
// the run's state through a cheap cache read so Cancel appears only while the
// run is active, without a second full detail fetch.
export function TektonRunHeaderActions({ contextName, kind, namespace, name }: Props) {
  const resource = kind === 'PipelineRun' ? TEKTON_PIPELINERUN_RESOURCE : TEKTON_TASKRUN_RESOURCE
  const load = useCallback(
    (ctx: string) => api.tektonRunState(ctx, resource, namespace, name),
    [resource, namespace, name],
  )
  const { detail: state } = useResourceDetail<string>(contextName, kind, namespace, name, load)
  return (
    <>
      {kind === 'PipelineRun' && (
        <RerunTektonPipelineRunButton contextName={contextName} namespace={namespace} name={name} />
      )}
      {state && isTektonRunActive(state) && (
        <CancelTektonRunButton contextName={contextName} kind={kind} namespace={namespace} name={name} />
      )}
    </>
  )
}
