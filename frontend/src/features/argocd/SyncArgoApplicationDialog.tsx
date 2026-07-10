import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  api,
  type ArgoApplicationResource,
  type ArgoOperationState,
  type ArgoSyncOptions,
  type ArgoSyncResourceSelector,
  type ArgoSyncStrategy,
} from '@/lib/api'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  revision: string
  dryRun: boolean
  prune: boolean
  force: boolean
  replace: boolean
  serverSideApply: boolean
  strategy: ArgoSyncStrategy
  selected: Set<string>
}

function defaultForm(): FormState {
  return {
    revision: '',
    dryRun: false,
    prune: true,
    force: false,
    replace: false,
    serverSideApply: false,
    strategy: 'hook',
    selected: new Set<string>(),
  }
}

function resourceKey(r: ArgoApplicationResource): string {
  return `${r.group}|${r.kind}|${r.namespace}|${r.name}`
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 60_000
const TERMINAL_PHASES = new Set(['Succeeded', 'Failed', 'Error'])

type Phase =
  | { kind: 'form' }
  | { kind: 'polling'; kickoffMs: number; wasDryRun: boolean }
  | { kind: 'results'; state: ArgoOperationState; wasDryRun: boolean }
  | { kind: 'timeout'; wasDryRun: boolean }

export function SyncArgoApplicationDialog({
  contextName,
  namespace,
  name,
  open,
  onOpenChange,
}: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [managed, setManaged] = useState<ArgoApplicationResource[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })

  // Reset everything when the dialog closes; refetch managed resources
  // when it reopens (state can change between sessions).
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Closing resets the dialog session.
      setForm(defaultForm())
      setPhase({ kind: 'form' })
      setLoadError(null)
      return
    }
    if (!contextName) return
    let cancelled = false
    api
      .listArgoApplicationResources(contextName, namespace, name)
      .then((list) => {
        if (!cancelled) setManaged(list ?? [])
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [open, contextName, namespace, name])

  const sync = useMutation({
    mutationFn: async () => {
      if (!contextName) throw new Error('no context')
      const selectedResources: ArgoSyncResourceSelector[] =
        form.selected.size === 0
          ? []
          : managed
              .filter((r) => form.selected.has(resourceKey(r)))
              .map((r) => ({
                group: r.group,
                kind: r.kind,
                name: r.name,
                namespace: r.namespace,
              }))
      const opts = {
        revision: form.revision,
        dryRun: form.dryRun,
        prune: form.prune,
        force: form.force,
        replace: form.replace,
        serverSideApply: form.serverSideApply,
        strategy: form.strategy,
        resources: selectedResources,
      } as ArgoSyncOptions
      await api.syncArgoApplication(contextName, namespace, name, opts)
      return { wasDryRun: form.dryRun }
    },
    onSuccess: ({ wasDryRun }) => {
      setPhase({ kind: 'polling', kickoffMs: Date.now(), wasDryRun })
    },
    onError: (e) => {
      toast.error(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
    },
  })

  // Poll operationState while phase === 'polling'. Stops on terminal phase
  // OR timeout. Argo's application-controller usually picks up an
  // `operation` within ~500ms, so 1.5s polling catches the transition fast
  // without hammering the API server.
  const timeoutFlagged = useRef(false)
  useEffect(() => {
    if (phase.kind !== 'polling' || !contextName) return
    timeoutFlagged.current = false
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      api
        .getArgoApplicationOperationState(contextName, namespace, name)
        .then((state) => {
          if (cancelled) return
          const startedAtMs = state.startedAt ? Date.parse(state.startedAt) : 0
          // Allow 2s of clock skew between the controller's clock and ours.
          if (
            state.phase &&
            TERMINAL_PHASES.has(state.phase) &&
            startedAtMs >= phase.kickoffMs - 2_000
          ) {
            setPhase({ kind: 'results', state, wasDryRun: phase.wasDryRun })
          }
        })
        .catch(() => {
          // ignore transient errors — keep polling
        })
    }

    tick()
    const interval = window.setInterval(tick, POLL_INTERVAL_MS)
    const timeout = window.setTimeout(() => {
      timeoutFlagged.current = true
      setPhase({ kind: 'timeout', wasDryRun: phase.wasDryRun })
    }, POLL_TIMEOUT_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [phase, contextName, namespace, name])

  const toggleSelected = useCallback((key: string) => {
    setForm((s) => {
      const next = new Set(s.selected)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...s, selected: next }
    })
  }, [])

  const runForReal = useCallback(() => {
    // Drop dry-run, keep every other option, re-submit. Convenient escape
    // hatch after a successful dry-run.
    setForm((s) => ({ ...s, dryRun: false }))
    setPhase({ kind: 'form' })
    // The mutation will fire on the next Synchronize click — we don't
    // auto-submit, so the user has one last chance to back out.
  }, [])

  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange])

  const dialogTitle = useMemo(() => {
    switch (phase.kind) {
      case 'polling':
        return phase.wasDryRun ? 'Running dry-run…' : 'Running sync…'
      case 'results':
        return phase.wasDryRun ? 'Dry-run results' : 'Sync results'
      case 'timeout':
        return 'Timed out waiting for Argo'
      default:
        return `Sync Application "${name}"`
    }
  }, [phase, name])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) sync.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {phase.kind === 'form' && (
            <DialogDescription>
              Mirrors the options{' '}
              <span className="font-mono text-xs">argocd app sync</span> exposes. Defaults match
              Argo's CLI: hook strategy, prune on, no force.
            </DialogDescription>
          )}
        </DialogHeader>

        {phase.kind === 'form' && (
          <SyncForm
            form={form}
            setForm={setForm}
            managed={managed}
            loadError={loadError}
            onToggleSelected={toggleSelected}
            disabled={sync.isPending}
            mutationError={sync.error ? String(sync.error) : null}
          />
        )}

        {phase.kind === 'polling' && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Spinner className="size-6" />
            <p className="text-sm">
              Waiting for Argo's application-controller to pick up the operation…
            </p>
            <p className="text-xs text-muted-foreground">
              Polling <span className="font-mono">.status.operationState</span> every 1.5 s.
            </p>
          </div>
        )}

        {phase.kind === 'results' && <ResultsPanel state={phase.state} />}

        {phase.kind === 'timeout' && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Stopped polling after {POLL_TIMEOUT_MS / 1000}s. The operation may still be running —
            open the YAML tab or use the Refresh button to check on it.
          </div>
        )}

        <DialogFooter>
          {phase.kind === 'form' && (
            <>
              <Button variant="outline" disabled={sync.isPending} onClick={closeDialog}>
                Cancel
              </Button>
              <Button disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? 'Syncing…' : form.dryRun ? 'Run dry-run' : 'Synchronize'}
              </Button>
            </>
          )}
          {phase.kind === 'polling' && (
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
          )}
          {phase.kind === 'results' && (
            <>
              {phase.wasDryRun && phase.state.phase === 'Succeeded' && (
                <Button variant="outline" onClick={runForReal}>
                  Adjust + run for real
                </Button>
              )}
              <Button onClick={closeDialog}>Close</Button>
            </>
          )}
          {phase.kind === 'timeout' && (
            <Button onClick={closeDialog}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncForm({
  form,
  setForm,
  managed,
  loadError,
  onToggleSelected,
  disabled,
  mutationError,
}: {
  form: FormState
  setForm: (updater: (s: FormState) => FormState) => void
  managed: ArgoApplicationResource[]
  loadError: string | null
  onToggleSelected: (key: string) => void
  disabled: boolean
  mutationError: string | null
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <label
          htmlFor="sync-revision"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Revision (git ref)
        </label>
        <Input
          id="sync-revision"
          value={form.revision}
          placeholder="(default: spec.source.targetRevision)"
          onChange={(e) => setForm((s) => ({ ...s, revision: e.target.value }))}
          disabled={disabled}
          className="font-mono text-sm"
        />
      </section>

      <section>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Strategy
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StrategyCard
            active={form.strategy === 'hook'}
            label="Hook (recommended)"
            description="Respect sync waves and pre/post-sync hooks. Default for argocd CLI."
            onClick={() => setForm((s) => ({ ...s, strategy: 'hook' }))}
            disabled={disabled}
          />
          <StrategyCard
            active={form.strategy === 'apply'}
            label="Apply"
            description="Force-apply every resource at once; skips hooks."
            onClick={() => setForm((s) => ({ ...s, strategy: 'apply' }))}
            disabled={disabled}
          />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <OptionCheckbox
          checked={form.dryRun}
          onChange={(v) => setForm((s) => ({ ...s, dryRun: v }))}
          label="Dry-run"
          description="Server-side dry-run — apiserver reports what would happen, no actual changes."
          disabled={disabled}
        />
        <OptionCheckbox
          checked={form.prune}
          onChange={(v) => setForm((s) => ({ ...s, prune: v }))}
          label="Prune"
          description="Delete resources that are in cluster but not in Git."
          disabled={disabled}
        />
        <OptionCheckbox
          checked={form.force}
          onChange={(v) => setForm((s) => ({ ...s, force: v }))}
          label="Force"
          description="Pass --force; override conflicts."
          disabled={disabled}
        />
        <OptionCheckbox
          checked={form.replace}
          onChange={(v) => setForm((s) => ({ ...s, replace: v }))}
          label="Replace"
          description="Use kubectl replace instead of apply. Adds Replace=true to syncOptions."
          disabled={disabled}
        />
        <OptionCheckbox
          checked={form.serverSideApply}
          onChange={(v) => setForm((s) => ({ ...s, serverSideApply: v }))}
          label="Server-side apply"
          description="Use SSA — preserves field ownership; preferred for large CRDs."
          disabled={disabled}
        />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selective sync ({form.selected.size === 0 ? 'all' : `${form.selected.size} selected`})
          </div>
          {form.selected.size > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => setForm((s) => ({ ...s, selected: new Set<string>() }))}
              disabled={disabled}
            >
              Clear selection
            </button>
          )}
        </div>
        {loadError ? (
          <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive break-words">
            {loadError}
          </p>
        ) : managed.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Argo has not yet recorded any managed resources for this Application.
          </p>
        ) : (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border">
            {managed.map((r) => {
              const key = resourceKey(r)
              const checked = form.selected.has(key)
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-2 py-1 text-xs last:border-b-0 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => onToggleSelected(key)}
                    disabled={disabled}
                  />
                  <span className="font-mono">{r.kind}</span>
                  <span className="font-mono text-muted-foreground">{r.namespace || '—'}</span>
                  <span className="font-mono">{r.name}</span>
                </label>
              )
            })}
          </div>
        )}
      </section>

      {mutationError && (
        <p className="rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive break-words">
          {mutationError}
        </p>
      )}
    </div>
  )
}

function ResultsPanel({ state }: { state: ArgoOperationState }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <PhasePill phase={state.phase} />
        {state.revision && (
          <span className="font-mono text-xs text-muted-foreground">
            revision {state.revision.slice(0, 8)}
          </span>
        )}
      </div>
      {state.message && (
        <p className="rounded border border-border bg-muted/40 p-2 text-xs">{state.message}</p>
      )}
      {state.resources.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Argo reported no resources for this operation (selective sync with no matches, or
          a no-op).
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Resource</th>
                <th className="px-2 py-1 text-left font-medium">Status</th>
                <th className="px-2 py-1 text-left font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {state.resources.map((r, i) => (
                <tr
                  key={`${r.group}/${r.kind}/${r.namespace}/${r.name}/${i}`}
                  className="border-t border-border"
                >
                  <td className="px-2 py-1 font-mono">
                    {r.kind}
                    {r.namespace ? ` ${r.namespace}/` : ' '}
                    {r.name}
                  </td>
                  <td className="px-2 py-1">
                    <ResourceStatusPill status={r.status} />
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{r.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PhasePill({ phase }: { phase: string }) {
  if (!phase) return <span className="text-muted-foreground">unknown</span>
  const cls =
    phase === 'Succeeded'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : phase === 'Failed' || phase === 'Error'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {phase}
    </span>
  )
}

function ResourceStatusPill({ status }: { status: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const cls =
    status === 'Synced' || status === 'Pruned'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'SyncFailed' || status === 'Failed'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : status === 'OutOfSync'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  )
}

function StrategyCard({
  active,
  label,
  description,
  onClick,
  disabled,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded border px-3 py-2 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border bg-transparent hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-3 shrink-0 rounded-full border ${
            active ? 'border-primary bg-primary' : 'border-muted-foreground/40'
          }`}
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-1 pl-5 text-xs text-muted-foreground">{description}</div>
    </button>
  )
}

function OptionCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-border px-3 py-2 hover:bg-muted/40">
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  )
}
