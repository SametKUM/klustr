import { DeleteResourceDialog } from './DeleteResourceButton'
import { RestartWorkloadDialog } from './RestartWorkloadButton'
import { PortForwardDialog } from '@/features/portforward/PortForwardButton'
import { useUIStore } from '@/store/ui'

export function RowActionDialogs() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const pendingAction = useUIStore((s) => s.pendingAction)
  const setPendingAction = useUIStore((s) => s.setPendingAction)

  if (!pendingAction) return null

  const contextName = pendingAction.resource.context ?? selectedContext

  const close = () => setPendingAction(null)
  const onOpenChange = (o: boolean) => {
    if (!o) close()
  }

  if (pendingAction.kind === 'delete') {
    return (
      <DeleteResourceDialog
        contextName={contextName}
        resource={pendingAction.resource}
        open
        onOpenChange={onOpenChange}
      />
    )
  }

  if (pendingAction.kind === 'restart') {
    return (
      <RestartWorkloadDialog
        contextName={contextName}
        resource={pendingAction.resource}
        open
        onOpenChange={onOpenChange}
      />
    )
  }

  return (
    <PortForwardDialog
      contextName={contextName}
      resource={pendingAction.resource}
      open
      onOpenChange={onOpenChange}
    />
  )
}
