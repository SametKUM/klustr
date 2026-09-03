import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isEditableTarget } from '@/lib/dom'

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /(Mac|iPhone|iPad|iPod)/.test(navigator.platform || navigator.userAgent)

const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl'

type Shortcut = { keys: string[]; label: string }
type Group = { heading: string; shortcuts: Shortcut[] }

const GROUPS: Group[] = [
  {
    heading: 'Search',
    shortcuts: [
      { keys: [MOD_KEY, 'K'], label: 'Open command palette' },
      { keys: [MOD_KEY, 'N'], label: 'Search namespaces' },
      { keys: [MOD_KEY, 'P'], label: 'Search pods' },
    ],
  },
  {
    heading: 'Navigation',
    shortcuts: [
      { keys: ['↑'], label: 'Previous resource view' },
      { keys: ['↓'], label: 'Next resource view' },
    ],
  },
  {
    heading: 'Lists & tables',
    shortcuts: [
      { keys: ['/'], label: 'Focus filter on the current list' },
      { keys: ['Esc'], label: 'Clear filter or blur input' },
      { keys: ['Click'], label: 'Open resource details' },
      { keys: ['Right-click'], label: 'Open row action menu' },
    ],
  },
  {
    heading: 'Terminal',
    shortcuts: [
      { keys: [MOD_KEY, '`'], label: 'Toggle terminal panel' },
      { keys: ['Alt', 'Click'], label: 'Show external terminal picker' },
      { keys: IS_MAC ? [MOD_KEY, 'C'] : ['Ctrl', 'Shift', 'C'], label: 'Copy terminal selection' },
      { keys: IS_MAC ? [MOD_KEY, 'V'] : ['Ctrl', 'Shift', 'V'], label: 'Paste into terminal' },
      { keys: ['Right-click'], label: 'Terminal copy / paste menu' },
    ],
  },
  {
    heading: 'Help',
    shortcuts: [{ keys: ['?'], label: 'Show this cheatsheet' }],
  },
]

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== '?') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.heading} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.heading}
              </h3>
              <ul className="space-y-1.5">
                {g.shortcuts.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  )
}
