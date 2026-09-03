import type { Terminal } from '@xterm/xterm'
import { toast } from 'sonner'
import { ClipboardGetText, ClipboardSetText } from '@/lib/wails/wailsjs/runtime/runtime'

export type ClipboardAction = 'copy' | 'paste'

type KeyChord = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>

export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /(Mac|iPhone|iPad|iPod)/.test(navigator.platform || navigator.userAgent)

function isLetter(ev: KeyChord, letter: 'c' | 'v'): boolean {
  return ev.code === `Key${letter.toUpperCase()}` || ev.key.toLowerCase() === letter
}

// macOS gets copy/paste for free: Wails installs an Edit menu whose ⌘C / ⌘V
// reach the webview as native clipboard commands, and xterm leaves ⌘-chords
// alone. Linux and Windows have no such menu, and xterm turns Ctrl+C / Ctrl+V
// into ^C / ^V control bytes with preventDefault, so the webview never fires a
// clipboard event — the app has to bind the terminal-convention chords itself.
export function clipboardActionFor(
  ev: KeyChord,
  opts: { hasSelection: boolean; isMac: boolean },
): ClipboardAction | null {
  if (opts.isMac || ev.metaKey || ev.altKey) return null
  if (ev.ctrlKey && ev.shiftKey) {
    if (isLetter(ev, 'c')) return 'copy'
    if (isLetter(ev, 'v')) return 'paste'
    return null
  }
  if (ev.key === 'Insert') {
    if (ev.ctrlKey && !ev.shiftKey) return 'copy'
    if (ev.shiftKey && !ev.ctrlKey) return 'paste'
    return null
  }
  // Plain Ctrl+C copies only while text is selected (Windows Terminal / VS Code
  // convention); with nothing selected it stays the shell's SIGINT.
  if (ev.ctrlKey && !ev.shiftKey && opts.hasSelection && isLetter(ev, 'c')) return 'copy'
  return null
}

// The Wails runtime reads and writes the native clipboard on the Go side, so
// it is tried first: WebKitGTK has no navigator.clipboard.readText at all and
// WebView2 permission-gates it. navigator.clipboard stays as the fallback for
// running the frontend in a plain browser.
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (await ClipboardSetText(text)) return true
  } catch {
    // runtime unavailable — fall through
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

async function readClipboard(): Promise<string | null> {
  try {
    return await ClipboardGetText()
  } catch {
    // runtime unavailable — fall through
  }
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

// Clearing the selection after a copy is what makes the next plain Ctrl+C a
// real SIGINT instead of a second copy.
export async function copySelection(term: Terminal): Promise<void> {
  const text = term.getSelection()
  if (!text) return
  if (await writeClipboard(text)) {
    term.clearSelection()
  } else {
    toast.error('Could not copy to the clipboard')
  }
}

// term.paste() — not a raw write to the session — so the text gets the same
// treatment as a native paste: newline normalisation and bracketed-paste
// wrapping when the shell asked for it, then it flows out through onData.
export async function pasteClipboard(term: Terminal): Promise<void> {
  const text = await readClipboard()
  if (text === null) {
    toast.error('Could not read the clipboard')
    return
  }
  if (text) term.paste(text)
  term.focus()
}

export function installClipboardBindings(
  term: Terminal,
  opts: { readOnly?: boolean } = {},
): void {
  term.attachCustomKeyEventHandler((ev) => {
    const action = clipboardActionFor(ev, { hasSelection: term.hasSelection(), isMac: IS_MAC })
    if (!action || (action === 'paste' && opts.readOnly)) return true
    // Returning false only stops xterm; the webview would still run its own
    // binding for the chord (Ctrl+Shift+C opens the inspector in some builds).
    ev.preventDefault()
    if (ev.type === 'keydown') {
      if (action === 'copy') void copySelection(term)
      else void pasteClipboard(term)
    }
    return false
  })
}
