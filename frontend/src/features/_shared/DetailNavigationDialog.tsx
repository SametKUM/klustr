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
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) cancel()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard YAML changes?</DialogTitle>
          <DialogDescription>
            Your changes have not been applied. Keep editing or discard them to continue.
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
