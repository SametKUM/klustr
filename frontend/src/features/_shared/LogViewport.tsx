import { ArrowDownToLine } from 'lucide-react'
import { TerminalContextMenu } from './TerminalContextMenu'
import type { LogTerminal } from './useLogTerminal'

export function LogViewport({ view }: { view: LogTerminal }) {
  const { hostRef, barRef } = view
  return (
    <>
      <div className="relative min-h-0 flex-1">
        <TerminalContextMenu terminal={view.terminal} readOnly>
          <div ref={hostRef} className="absolute inset-0 bg-background px-2 py-1" />
        </TerminalContextMenu>
        {!view.atBottom && (
          <button
            type="button"
            onClick={view.scrollToBottom}
            className="absolute bottom-3 right-4 inline-flex items-center gap-1 rounded-full border border-border bg-popover px-3 py-1 text-xs text-popover-foreground shadow-sm hover:bg-muted"
          >
            <ArrowDownToLine className="size-3" />
            Jump to bottom
          </button>
        )}
      </div>
      {!view.wrap && (
        // A native scroller sized so that its viewport is the terminal's
        // columns and its content the widest line; its scrollLeft is the
        // source of truth for the column offset.
        <div
          ref={barRef}
          className="mx-2 shrink-0 overflow-x-scroll overflow-y-hidden"
          onScroll={(e) => view.scrollColumns(e.currentTarget)}
        >
          <div className="h-px" style={{ width: `${Math.max(100, (view.extent / Math.max(1, view.cols)) * 100)}%` }} />
        </div>
      )}
    </>
  )
}
