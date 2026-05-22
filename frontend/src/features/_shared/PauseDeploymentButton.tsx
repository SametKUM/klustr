import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type DeploymentDetail } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import type { SelectedResource } from '@/store/ui'

export function isPausable(kind: string): boolean {
  return kind === 'Deployment'
}

type Props = {
  contextName: string | null
  resource: SelectedResource
}

export function PauseDeploymentButton({ contextName, resource }: Props) {
  const [paused, setPaused] = useState<boolean | null>(null)

  useEffect(() => {
    if (!contextName) {
      setPaused(null)
      return
    }
    let cancelled = false
    const reload = () => {
      api
        .getDeployment(contextName, resource.namespace, resource.name)
        .then((d: DeploymentDetail) => {
          if (cancelled) return
          setPaused(Boolean(d.paused))
        })
        .catch(() => {
          if (cancelled) return
          setPaused(null)
        })
    }
    reload()
    const unsub = onKubeChange('Deployment', (ctx) => {
      if (ctx === contextName) reload()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [contextName, resource.namespace, resource.name])

  const toggle = useMutation({
    mutationFn: async () => {
      if (!contextName || paused === null) throw new Error('not ready')
      await api.patchDeploymentPaused(contextName, resource.namespace, resource.name, !paused)
    },
    onSuccess: () => {
      const verb = paused ? 'Resumed' : 'Paused'
      toast.success(`${verb} deployment/${resource.name}`)
    },
    onError: (e: unknown) => {
      toast.error(`Failed: ${String(e)}`)
    },
  })

  const label = paused ? 'Resume' : 'Pause'
  const Icon = paused ? Play : Pause
  const tooltip = paused
    ? 'Resume rollout — apply queued template changes'
    : 'Pause rollout — block new template changes from rolling out'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          onClick={() => toggle.mutate()}
          disabled={paused === null || toggle.isPending}
        >
          {toggle.isPending ? <Spinner size="lg" muted={false} /> : <Icon />}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
