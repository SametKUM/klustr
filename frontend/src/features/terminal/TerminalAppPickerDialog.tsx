import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, type SystemTerminal } from '@/lib/api'
import { useTerminalStore } from '@/store/terminals'

type Props = {
  open: boolean
  description?: ReactNode
  onClose: () => void
  onLaunch: (appID: string) => Promise<void>
}

// Modal picker for "Open in system terminal". Listed apps come from the
// backend's /Applications scan (macOS) or PATH lookup (Linux). Selecting
// an app and clicking Open launches it for the requested context; the
// "Set as default" checkbox is what makes a one-time choice sticky so
// the next launch can either use it directly or just pre-select it.
export function TerminalAppPickerDialog({ open, description, onClose, onLaunch }: Props) {
  const preferredAppId = useTerminalStore((s) => s.preferredAppId)
  const setPreferredAppId = useTerminalStore((s) => s.setPreferredAppId)
  const [apps, setApps] = useState<SystemTerminal[]>([])
  const [chosen, setChosen] = useState<string>(preferredAppId)
  const [makeDefault, setMakeDefault] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    api
      .listSystemTerminals()
      .then((list) => setApps(list ?? []))
      .catch(() => setApps([]))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Opening initializes a new picker session.
    setChosen(preferredAppId)
    setMakeDefault(false)
  }, [open, preferredAppId])

  const submit = async () => {
    setBusy(true)
    try {
      await onLaunch(chosen)
      if (makeDefault && chosen !== preferredAppId) {
        setPreferredAppId(chosen)
      }
      onClose()
    } catch (e) {
      toast.error('Could not open system terminal', { description: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open in system terminal</DialogTitle>
          <DialogDescription>
            {description ?? <>Launch a terminal app outside Klustr.</>}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-1.5">
          <legend className="sr-only">Choose terminal app</legend>
          <AppOption
            appId=""
            label="System default"
            description="Whatever app handles .command / shell scripts"
            chosen={chosen}
            onChoose={setChosen}
          />
          {apps.map((app) => (
            <AppOption
              key={app.id}
              appId={app.id}
              label={app.name}
              chosen={chosen}
              onChoose={setChosen}
            />
          ))}
        </fieldset>

        <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={makeDefault}
            onChange={(e) => setMakeDefault((e.target as HTMLInputElement).checked)}
          />
          <span>Remember this choice and skip the picker next time</span>
        </label>

        {preferredAppId && (
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Tip: Alt+click the icon any time to choose another app.{' '}
            <button
              type="button"
              onClick={() => setPreferredAppId('')}
              className="underline-offset-2 hover:underline"
            >
              Forget default
            </button>
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type OptionProps = {
  appId: string
  label: string
  description?: string
  chosen: string
  onChoose: (id: string) => void
}

function AppOption({ appId, label, description, chosen, onChoose }: OptionProps) {
  const selected = chosen === appId
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-2 text-sm transition ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60'
      }`}
    >
      <input
        type="radio"
        name="terminalApp"
        value={appId}
        checked={selected}
        onChange={() => onChoose(appId)}
        className="size-3.5 accent-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground">{label}</span>
        {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
      </span>
    </label>
  )
}
