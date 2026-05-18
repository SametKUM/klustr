import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'

export function DisconnectButton() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const clear = useUIStore((s) => s.clearAggregatedContexts)

  if (activeContexts.length === 0) return null

  const label = isAggregated
    ? `Disconnect all (${activeContexts.length} contexts)`
    : `Disconnect ${activeContexts[0] ?? ''}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => clear()}
          aria-label="Disconnect"
          className="size-8"
        >
          <LogOut />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
