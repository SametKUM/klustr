import { useUIStore } from '@/store/ui'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DetailNavigationDialog() {
  const pending = useUIStore((s) => s.pendingDetailNavigation)
  const cancel = useUIStore((s) => s.cancelDetailNavigation)
  const confirm = useUIStore((s) => s.confirmDetailNavigation)
  const resource = useUIStore((s) => s.selectedResource)
  const contextName = useUIStore((s) => s.selectedResource?.context ?? s.selectedContext)
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) cancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          if (!useUIStore.getState().detailDirty) return
          event.preventDefault()
          requestAnimationFrame(() => {
            const editor =
              document.querySelector<HTMLElement>(
                '[data-resource-detail] [data-resource-yaml] .monaco-editor textarea',
              ) ?? document.querySelector<HTMLElement>('[data-resource-detail]')
            editor?.focus({ preventScroll: true })
          })
        }}
      >
        <DialogHeader>
          <DialogTitle>Discard YAML changes?</DialogTitle>
          <DialogDescription className="break-words">
            {resource
              ? `Changes to ${resource.kind} ${resource.namespace ? `${resource.namespace}/` : ''}${resource.name}${contextName ? ` in ${contextName}` : ''} have not been applied.`
              : 'Your changes have not been applied.'}{' '}
            Keep editing or discard them to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={cancel}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={confirm}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
