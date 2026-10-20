import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useResourceNavigation } from './resourceNavigation'

// Not matched against the inspected resource: right after a move the list has
// not yet published the new position, and unmounting for that one commit would
// drop focus from the button that made the move. The list clears navigation
// itself when the inspected resource is outside its results.
export function ResourceListNavigator() {
  const navigation = useResourceNavigation()
  if (!navigation) return null

  return (
    <div role="group" aria-label="Browse filtered resources" className="flex items-center gap-0.5">
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        aria-label="Previous resource"
        aria-keyshortcuts="Alt+ArrowUp"
        title="Previous resource (Alt+↑)"
        disabled={!navigation.previous}
        onClick={() => navigation.previous?.()}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-12 text-center text-xs tabular-nums text-muted-foreground"
      >
        {navigation.index + 1} of {navigation.total}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        aria-label="Next resource"
        aria-keyshortcuts="Alt+ArrowDown"
        title="Next resource (Alt+↓)"
        disabled={!navigation.next}
        onClick={() => navigation.next?.()}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  )
}
