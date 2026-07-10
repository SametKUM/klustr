import { useEffect, useMemo, useState } from 'react'
import { api, type ContextInfo } from '@/lib/api'
import { useActiveContexts } from '@/store/ui'
import { useAwsVaultDetected, useCredentialsStore } from '@/store/credentials'
import { CredentialMappingDialog } from './CredentialHelpersSection'

const PROBE_INTERVAL_MS = 20_000

function looksLikeCredentialError(message: string): boolean {
  return /getting credentials|exec plugin|executable .+ failed|credential/i.test(message)
}

// CredentialSuggestionPrompt turns the dead-end "everything is empty and the
// status bar says offline" state into a guided fix: when an active context
// authenticates through aws eks get-token, aws-vault is installed, no profile
// is mapped and the connection is failing with a credential-shaped error, the
// mapping dialog opens by itself with the failing context preselected.
// Cancelling counts as a session-long dismissal for those contexts.
export function CredentialSuggestionPrompt() {
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Probe results are scoped to the current candidates.
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

  const stuck = useMemo(
    () => candidates.filter((c) => failing[c.name]),
    [candidates, failing],
  )
  const stuckKey = stuck.map((c) => c.name).join(',')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A newly stuck credential flow opens its prompt.
    if (stuckKey !== '') setDialogOpen(true)
  }, [stuckKey])

  if (stuck.length === 0) return null
  const names = stuck.map((c) => c.name).join(', ')

  return (
    <CredentialMappingDialog
      contexts={stuck}
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setDismissed((prev) => new Set([...prev, ...stuck.map((c) => c.name)]))
        }
      }}
      onSaved={() => {
        api.listCredentialStatuses().then((list) => setStatuses(list ?? []))
      }}
      reason={`${names} ${stuck.length === 1 ? 'is' : 'are'} failing to authenticate: the kubeconfig runs aws eks get-token, which needs credentials aws-vault can provide. Map a profile and Klustr will run it for you.`}
    />
  )
}
