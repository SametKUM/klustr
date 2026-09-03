import { useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import { ClipboardPaste, Copy, TextSelect } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { copySelection, IS_MAC, pasteClipboard } from './xtermClipboard'

const COPY_HINT = IS_MAC ? '⌘C' : 'Ctrl+Shift+C'
const PASTE_HINT = IS_MAC ? '⌘V' : 'Ctrl+Shift+V'

type Props = {
  terminal: () => Terminal | null
  readOnly?: boolean
  children: React.ReactNode
}

// Right-click menu for an xterm host. Wails suppresses the webview's native
// context menu in release builds, so without this mouse-only users have no
// paste at all on Linux/Windows.
export function TerminalContextMenu({ terminal, readOnly, children }: Props) {
  const [hasSelection, setHasSelection] = useState(false)

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setHasSelection(terminal()?.hasSelection() ?? false)
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          // Radix would hand focus back to the host div; the shell needs it in
          // xterm's textarea so typing resumes right away.
          e.preventDefault()
          terminal()?.focus()
        }}
      >
        <ContextMenuItem
          disabled={!hasSelection}
          onSelect={() => {
            const term = terminal()
            if (term) void copySelection(term)
          }}
        >
          <Copy />
          <span>Copy</span>
          <ContextMenuShortcut>{COPY_HINT}</ContextMenuShortcut>
        </ContextMenuItem>
        {!readOnly && (
          <ContextMenuItem
            onSelect={() => {
              const term = terminal()
              if (term) void pasteClipboard(term)
            }}
          >
            <ClipboardPaste />
            <span>Paste</span>
            <ContextMenuShortcut>{PASTE_HINT}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => terminal()?.selectAll()}>
          <TextSelect />
          <span>Select all</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
