import { useEffect, useMemo, useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, type ContextInfo } from '@/lib/api'
import { useActiveContexts } from '@/store/ui'
import { useAwsVaultDetected, useCredentialsStore } from '@/store/credentials'
import { CredentialMappingDialog } from './CredentialHelpersSection'

const PROBE_INTERVAL_MS = 20_000

function looksLikeCredentialError(message: string): boolean {
  return /getting credentials|exec plugin|executable .+ failed|credential/i.test(message)
}

// CredentialSuggestionBanner turns the dead-end "everything is empty and the
// status bar says offline" state into a guided fix: when an active context
// authenticates through aws eks get-token, aws-vault is installed, no profile
// is mapped and the connection is failing with a credential-shaped error, it
// offers the mapping dialog right where the user is stuck.
export function CredentialSuggestionBanner() {
  const activeContexts = useActiveContexts()
  const detected = useAwsVaultDetected()
  const statuses = useCredentialsStore((s) => s.statuses)
  const setStatuses = useCredentialsStore((s) => s.setStatuses)
  const [infos, setInfos] = useState<ContextInfo[]>([])
  const [failing, setFailing] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .listContexts()
      .then((cfg) => {
        if (!cancelled) setInfos(cfg.contexts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeContexts])

  const candidates = useMemo(
    () =>
      infos.filter(
        (c) =>
          activeContexts.includes(c.name) &&
          c.awsExec &&
          !c.awsVaultExec &&
          detected &&
          !(c.name in statuses) &&
          !dismissed.has(c.name),
      ),
    [infos, activeContexts, detected, statuses, dismissed],
  )

  useEffect(() => {
    if (candidates.length === 0) {
      setFailing({})
      return
    }
    let cancelled = false
    const probe = () => {
      for (const c of candidates) {
        api
          .pingContext(c.name)
          .then(() => {
            if (cancelled) return
            setFailing((prev) => (prev[c.name] ? { ...prev, [c.name]: false } : prev))
          })
          .catch((e: unknown) => {
            if (cancelled) return
            const isCreds = looksLikeCredentialError(String(e))
            setFailing((prev) =>
              prev[c.name] === isCreds ? prev : { ...prev, [c.name]: isCreds },
            )
          })
      }
    }
    probe()
    const id = window.setInterval(probe, PROBE_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [candidates])

  const stuck = candidates.filter((c) => failing[c.name])
  if (stuck.length === 0) return null
  const names = stuck.map((c) => c.name).join(', ')

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs">
        <KeyRound className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="min-w-0 flex-1 text-foreground">
          <span className="font-semibold">{names}</span>{' '}
          {stuck.length === 1 ? 'is' : 'are'} failing to authenticate — the kubeconfig runs{' '}
          <span className="font-mono">aws eks get-token</span>, which needs credentials aws-vault
          can provide. Map an aws-vault profile and Klustr will run it for you.
        </span>
        <Button
          size="sm"
          className="h-6 shrink-0 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          Map profile
        </Button>
        <button
          type="button"
          aria-label="Dismiss credential suggestion"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-amber-500/20 hover:text-foreground"
          onClick={() =>
            setDismissed((prev) => new Set([...prev, ...stuck.map((c) => c.name)]))
          }
        >
          <X className="size-3.5" />
        </button>
      </div>
      <CredentialMappingDialog
        contexts={stuck}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          api.listCredentialStatuses().then((list) => setStatuses(list ?? []))
        }}
      />
    </>
  )
}
