import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, type PodDetail, type TektonTaskRunDetail } from '@/lib/api'
import { ErrorBox } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { PodLogsTab } from '@/features/pods/PodLogsTab'
import { stepContainer } from './tektonFormat'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

type PodState =
  | { podName: string; status: 'loaded'; detail: PodDetail }
  | { podName: string; status: 'gone' }
  | { podName: string; status: 'error'; message: string }

// TektonTaskRunLogsTab streams the TaskRun pod's logs with the most relevant
// step preselected. Tekton prunes the pods of finished runs, so a missing pod
// is the common case for older runs and gets a plain message, not an error.
export function TektonTaskRunLogsTab({ contextName, namespace, name }: Props) {
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
  const podName = detail?.podName ?? ''
  const [pod, setPod] = useState<PodState | null>(null)
  const podLoaded = pod?.podName === podName && pod.status === 'loaded'

  useEffect(() => {
    // The pod is created after the TaskRun, so retry on each TaskRun update
    // until it shows up; once loaded, its containers never change.
    if (!contextName || !podName || podLoaded) return
    let cancelled = false
    api
      .getPod(contextName, namespace, podName)
      .then((d) => {
        if (!cancelled) setPod({ podName, status: 'loaded', detail: d })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message = String(e)
        setPod(
          message.includes('not found')
            ? { podName, status: 'gone' }
            : { podName, status: 'error', message },
        )
      })
    return () => {
      cancelled = true
    }
  }, [contextName, namespace, podName, podLoaded, detail])

  if (error) return <Centered><ErrorBox>{error}</ErrorBox></Centered>
  if (!detail) return null
  if (!podName) return <Centered>This TaskRun has no pod yet.</Centered>
  if (!pod || pod.podName !== podName) return <Centered>Loading pod…</Centered>
  if (pod.status === 'gone') {
    return (
      <Centered>
        Pod <span className="font-mono">{podName}</span> no longer exists, so its logs are gone.
        Tekton deletes the pods of finished runs when they are pruned.
      </Centered>
    )
  }
  if (pod.status === 'error') return <Centered><ErrorBox>{pod.message}</ErrorBox></Centered>
  return (
    <PodLogsTab
      detail={pod.detail}
      contextName={contextName}
      initialContainer={stepContainer(detail.steps)}
      active
    />
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
      <div className="max-w-md">{children}</div>
    </div>
  )
}
