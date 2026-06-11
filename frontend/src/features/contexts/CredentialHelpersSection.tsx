import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Play, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type ContextInfo, type CredentialStatus } from '@/lib/api'
import { useAwsVaultDetected, useCredentialsStore, useCredentialStatus } from '@/store/credentials'

const STATE_DOT: Record<string, string> = {
  captured: 'bg-emerald-500',
  mapped: 'bg-muted-foreground/50',
  expired: 'bg-amber-500',
  error: 'bg-red-500',
}

const STATE_ICON: Record<string, string> = {
  captured: 'text-emerald-500',
  mapped: 'text-muted-foreground',
  expired: 'text-amber-500',
  error: 'text-red-500',
}

function describeState(status: CredentialStatus): string {
  switch (status.state) {
    case 'captured':
      return expiresIn(status.expiresAt) ?? 'credentials active'
    case 'expired':
      return 'credentials expired — reconnect or run again'
    case 'error':
      return 'last run failed'
    default:
      return 'runs automatically on connect'
  }
}

function expiresIn(expiresAt: string): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'expired'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `expires in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `expires in ${hours}h ${minutes % 60}m`
}

// CredentialKeyButton is the single management surface for a context's
// credential helper, living in the card's corner. Mapped contexts get a
// state-colored key opening a popover with Run/Change/Remove; eligible
// unmapped contexts get a muted key (revealed on card hover) that opens the
// mapping dialog directly.
export function CredentialKeyButton({
  context,
  onMap,
}: {
  context: ContextInfo
  onMap: (context: ContextInfo) => void
}) {
  const status = useCredentialStatus(context.name)
  const detected = useAwsVaultDetected()
  const removeStatus = useCredentialsStore((s) => s.removeStatus)
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () => api.clearCredentialMapping(context.name),
    onSuccess: () => {
      removeStatus(context.name)
      setOpen(false)
    },
    onError: (e) => toast.error(String(e)),
  })

  const eligible = context.awsExec && !context.awsVaultExec && detected
  if (!status && !eligible) return null

  if (!status) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Map an aws-vault profile for ${context.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onMap(context)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className={[
              'inline-flex size-5 items-center justify-center rounded-md border border-dashed border-border bg-background/80',
              'text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
              'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            ].join(' ')}
          >
            <KeyRound className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[16rem] text-xs">
          Map an aws-vault profile — Klustr will run it for this context on connect.
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Credential helper for ${context.name}`}
          title={`${status.provider} · ${status.profile} — ${describeState(status)}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={[
            'inline-flex size-5 items-center justify-center rounded-md border border-border bg-background/80 transition-colors hover:bg-muted',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            STATE_ICON[status.state] ?? 'text-muted-foreground',
          ].join(' ')}
        >
          <KeyRound className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-3 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full ${STATE_DOT[status.state] ?? 'bg-muted-foreground/50'}`}
          />
          <span className="font-mono text-muted-foreground">
            {status.provider} · {status.profile}
          </span>
        </div>
        <div className="mt-1 text-muted-foreground">{describeState(status)}</div>
        {status.error && (
          <div className="mt-1 break-words font-mono text-[10px] text-red-400">{status.error}</div>
        )}
        <div className="mt-2.5 flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            title="Run the helper now — a Keychain or MFA prompt may appear"
            onClick={() => {
              void api.captureCredentials(context.name)
              setOpen(false)
            }}
          >
            <Play />
            Run now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setOpen(false)
              onMap(context)
            }}
          >
            Change…
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <X />
            Remove
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// CredentialHelpersHint renders at most one thin line on the welcome screen;
// all management lives on the context cards' key buttons.
export function CredentialHelpersHint({ contexts }: { contexts: ContextInfo[] }) {
  const detected = useAwsVaultDetected()
  const statuses = useCredentialsStore((s) => s.statuses)

  const eligible = useMemo(
    () => contexts.filter((c) => c.awsExec && !c.awsVaultExec),
    [contexts],
  )
  const anyMapped = useMemo(
    () => Object.keys(statuses).some((name) => contexts.some((c) => c.name === name)),
    [statuses, contexts],
  )

  if (eligible.length === 0) return null

  if (!detected) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3 shrink-0" />
        <span>
          {eligible.length} context{eligible.length === 1 ? ' uses' : 's use'} AWS exec auth, but{' '}
          <span className="font-mono">aws-vault</span> was not found on PATH — install it and
          Klustr can run it for you.
        </span>
      </p>
    )
  }

  if (anyMapped) return null

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <KeyRound className="size-3 shrink-0" />
      <span>
        aws-vault detected — click the key on a context card to map a profile; Klustr runs it on
        connect.
      </span>
    </p>
  )
}

export function CredentialMappingDialog({
  contexts,
  open,
  onOpenChange,
  onSaved,
}: {
  contexts: ContextInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [contextName, setContextName] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<string[]>([])
  const [profile, setProfile] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const selectedContext = contexts.find((c) => c.name === contextName) ?? null

  useEffect(() => {
    if (!open) return
    setContextName(contexts.length === 1 ? contexts[0].name : null)
    setProfile(null)
    setFilter('')
    api
      .listCredentialProfiles('aws-vault')
      .then((p) => setProfiles(p ?? []))
      .catch(() => setProfiles([]))
    // contexts is intentionally read once per open: re-running on list churn
    // would discard the user's in-progress picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!selectedContext) return
    if (profile) return
    if (selectedContext.awsProfileHint && profiles.includes(selectedContext.awsProfileHint)) {
      setProfile(selectedContext.awsProfileHint)
    }
  }, [selectedContext, profiles, profile])

  const visibleProfiles = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => p.toLowerCase().includes(q))
  }, [profiles, filter])

  const save = useMutation({
    mutationFn: async () => {
      if (!contextName || !profile) throw new Error('pick a context and a profile')
      await api.setCredentialMapping(contextName, 'aws-vault', profile)
      return contextName
    },
    onSuccess: (ctx) => {
      onSaved()
      onOpenChange(false)
      toast.success(`${ctx} mapped to aws-vault profile ${profile}`, {
        description: 'Klustr runs aws-vault automatically when this context connects.',
      })
      void api.captureCredentials(ctx)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Map context to aws-vault profile</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Klustr will run <span className="font-mono text-xs">aws-vault export</span> for the
                selected profile and feed the credentials to this context&apos;s{' '}
                <span className="font-mono text-xs">aws eks get-token</span> — the same effect as
                launching Klustr through <span className="font-mono text-xs">aws-vault exec</span>.
                Credentials stay in memory and renew before they expire.
              </p>
              {save.error && (
                <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
                  {String(save.error)}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {contexts.length > 1 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Context</div>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {contexts.map((c) => {
                const active = contextName === c.name
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setContextName(c.name)
                      setProfile(null)
                    }}
                    className={[
                      'rounded border px-2 py-0.5 font-mono text-xs',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">AWS profile</div>
            {profiles.length > 8 && (
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="h-6 w-32 text-xs"
              />
            )}
          </div>
          {profiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No profiles found in <span className="font-mono">~/.aws/config</span>.
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {visibleProfiles.map((p) => {
                const active = profile === p
                const hinted = selectedContext?.awsProfileHint === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfile(p)}
                    className={[
                      'rounded border px-2 py-0.5 font-mono text-xs',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    {p}
                    {hinted && <span className="ml-1 text-[10px] opacity-70">kubeconfig</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !contextName || !profile}
          >
            {save.isPending ? 'Saving…' : 'Save & run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
