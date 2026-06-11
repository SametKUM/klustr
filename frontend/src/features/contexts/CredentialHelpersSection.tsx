import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Play, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type ContextInfo, type CredentialStatus } from '@/lib/api'
import { useCredentialsStore, useCredentialStatus } from '@/store/credentials'

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

// CredentialBadge is the per-card indicator on the connections screen: shown
// only for contexts with a saved helper mapping, colored by capture state.
export function CredentialBadge({ contextName }: { contextName: string }) {
  const status = useCredentialStatus(contextName)
  if (!status) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center ${STATE_ICON[status.state] ?? 'text-muted-foreground'}`}>
          <KeyRound className="size-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[20rem] text-xs">
        <div className="font-medium">
          {status.provider} · {status.profile}
        </div>
        <div className="text-muted-foreground">{describeState(status)}</div>
        {status.error && (
          <div className="mt-1 break-words font-mono text-[10px] text-red-400">{status.error}</div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function CredentialHelpersSection({ contexts }: { contexts: ContextInfo[] }) {
  const providers = useCredentialsStore((s) => s.providers)
  const statuses = useCredentialsStore((s) => s.statuses)
  const setStatuses = useCredentialsStore((s) => s.setStatuses)
  const removeStatus = useCredentialsStore((s) => s.removeStatus)
  const [dialogOpen, setDialogOpen] = useState(false)

  const detected = providers.some((p) => p.name === 'aws-vault' && p.detected)
  const eligible = useMemo(
    () => contexts.filter((c) => c.awsExec && !c.awsVaultExec),
    [contexts],
  )
  const mapped = useMemo(
    () =>
      Object.values(statuses)
        .filter((s) => contexts.some((c) => c.name === s.context))
        .sort((a, b) => a.context.localeCompare(b.context)),
    [statuses, contexts],
  )
  const unmapped = useMemo(
    () => eligible.filter((c) => !(c.name in statuses)),
    [eligible, statuses],
  )

  if (!detected && eligible.length === 0) return null

  if (!detected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <KeyRound className="size-3.5 shrink-0" />
        <span>
          {eligible.length} context{eligible.length === 1 ? ' uses' : 's use'} AWS exec auth, but{' '}
          <span className="font-mono">aws-vault</span> was not found on PATH. Install it (or launch
          Klustr from a terminal) to let Klustr run it for you.
        </span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <KeyRound className="size-3 text-muted-foreground" />
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Credential helpers
        </h2>
        {mapped.length > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {mapped.length}
          </span>
        )}
        <div className="ml-auto h-px flex-1 bg-border/60" />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDialogOpen(true)}
          disabled={unmapped.length === 0}
          title={
            unmapped.length === 0
              ? 'Every AWS exec context already has a profile mapping'
              : 'Map a context to an aws-vault profile'
          }
        >
          <Plus />
          Map context
        </Button>
      </div>

      {mapped.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          aws-vault detected. Map a context to a profile and Klustr will run{' '}
          <span className="font-mono">aws-vault export</span> for it on connect — no terminal
          wrapper needed.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {mapped.map((s) => (
            <MappingRow key={s.context} status={s} onRemoved={() => removeStatus(s.context)} />
          ))}
        </ul>
      )}

      <CredentialMappingDialog
        contexts={unmapped}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          api.listCredentialStatuses().then((list) => setStatuses(list ?? []))
        }}
      />
    </section>
  )
}

function MappingRow({ status, onRemoved }: { status: CredentialStatus; onRemoved: () => void }) {
  const remove = useMutation({
    mutationFn: () => api.clearCredentialMapping(status.context),
    onSuccess: onRemoved,
    onError: (e) => toast.error(String(e)),
  })
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${STATE_DOT[status.state] ?? 'bg-muted-foreground/50'}`} />
      <span className="truncate text-sm font-medium">{status.context}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {status.provider} · {status.profile}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80" title={status.error || undefined}>
        {status.state === 'error' && status.error ? status.error : describeState(status)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => void api.captureCredentials(status.context)}
          >
            <Play />
            Run
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          Run {status.provider} now — a Keychain or MFA prompt may appear
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-muted-foreground"
        aria-label={`Remove credential mapping for ${status.context}`}
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
      >
        <X className="size-3.5" />
      </Button>
    </li>
  )
}

function CredentialMappingDialog({
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
