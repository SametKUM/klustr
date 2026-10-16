import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, CircleHelp, RefreshCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, type KarpenterBlocker, type KarpenterBudget, type KarpenterDisruption, type OwnerRef } from '@/lib/api'
import { formatAge, formatExpiry } from '@/lib/time'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { OwnerLink } from '@/features/_shared/OwnerLink'

// Disruption state moves with pods, PDB status and budget windows, none of
// which this tab watches individually, so it refreshes on the same cadence
// as the Events tabs.
const POLL_INTERVAL_MS = 15_000

type Props = {
  contextName: string | null
  nodeName: string
  nodeClaimName: string
}

// KarpenterDisruptionTab answers "why doesn't Karpenter consolidate this
// node?": what blocks a voluntary disruption now, the NodePool budgets and
// policy behind it, and Karpenter's own disruption events.
export function KarpenterDisruptionTab({ contextName, nodeName, nodeClaimName }: Props) {
  const [report, setReport] = useState<KarpenterDisruption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!contextName) return
    setLoading(true)
    try {
      setReport(await api.getKarpenterDisruption(contextName, nodeName, nodeClaimName))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [contextName, nodeName, nodeClaimName])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The first read starts this polling lifecycle.
    void refresh()
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!report) return <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
  if (!report.managed) {
    return <div className="py-8 text-center text-xs text-muted-foreground">This node is not managed by Karpenter.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Verdict report={report} />
        <Button type="button" size="xs" variant="outline" className="ml-auto shrink-0" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw className={loading ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>
      {report.incomplete.length > 0 && (
        <Section title="Not visible">
          <ul className="space-y-1.5 text-sm">
            {report.incomplete.map((gap) => (
              <li key={gap} className="flex items-start gap-2">
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words">{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {report.blockers.length > 0 && (
        <Section title={`Blocking now (${report.blockers.length})`}>
          <ul className="space-y-1.5 text-sm">
            {report.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="min-w-0 break-words">
                  {b.message} <BlockerLink contextName={contextName} blocker={b} />
                  <BlockerScope blocker={b} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="NodePool">
        <Field label="NodePool">
          <CustomResourceReference
            contextName={contextName}
            group="karpenter.sh"
            resource="nodepools"
            kind="NodePool"
            namespace=""
            name={report.nodePool}
          />
        </Field>
        <Field label="NodeClaim">
          <CustomResourceReference
            contextName={contextName}
            group="karpenter.sh"
            resource="nodeclaims"
            kind="NodeClaim"
            namespace=""
            name={report.nodeClaim}
          />
        </Field>
        <Field label="Consolidation">{report.consolidationPolicy || '—'}</Field>
        <Field label="Consolidate after">{report.consolidateAfter || '0s'}</Field>
        <Field label="Last pod change">{report.lastPodEventTime ? formatAge(report.lastPodEventTime) : '—'}</Field>
        <Field label="Expire after">{report.expireAfter || '—'}</Field>
        <Field label="Capacity type">{report.capacityType || '—'}</Field>
      </Section>
      <Section title="Disruption budgets">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Nodes</Th>
                <Th>Reasons</Th>
                <Th>Schedule (UTC)</Th>
                <Th>Duration</Th>
                <Th>Now</Th>
              </tr>
            </thead>
            <tbody>
              {report.budgets.map((b, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <Td className="font-mono">{b.nodes}</Td>
                  <Td>{b.reasons.length ? b.reasons.join(', ') : 'All'}</Td>
                  <Td className="font-mono">{b.schedule || 'Always'}</Td>
                  <Td className="font-mono">{b.duration || '—'}</Td>
                  <Td className={b.active && b.remaining === 0 ? 'text-destructive' : undefined}>
                    {budgetState(b)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          When several budgets are active, Karpenter applies the most restrictive one.
          {report.poolDisrupting > 0 &&
            ` ${report.poolDisrupting} of the pool's nodes are NotReady or already being disrupted, and count against every budget.`}
        </p>
      </Section>
      {report.pods.length > 0 && (
        <Section title="Pods holding the node">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Pod</Th>
                  <Th>do-not-disrupt</Th>
                  <Th>PDB</Th>
                </tr>
              </thead>
              <tbody>
                {report.pods.map((p) => (
                  <tr key={`${p.namespace}/${p.name}`} className="border-t border-border">
                    <Td className="font-mono">
                      {p.namespace}/
                      <OwnerLink owner={{ kind: 'Pod', name: p.name } as OwnerRef} namespace={p.namespace} context={contextName} />
                    </Td>
                    <Td>{p.doNotDisrupt ? 'Yes' : '—'}</Td>
                    <Td className="font-mono">
                      {p.blockingPDBs.length === 0
                        ? '—'
                        : p.blockingPDBs.map((name, i) => (
                            <span key={name}>
                              {i > 0 && ', '}
                              <OwnerLink
                                owner={{ kind: 'PodDisruptionBudget', name } as OwnerRef}
                                namespace={p.namespace}
                                context={contextName}
                              />
                            </span>
                          ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <ConditionsSection conditions={report.conditions} emptyMessage="The NodeClaim reports no conditions." />
      <Section title="Karpenter events">
        {report.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No disruption events on the node, its NodeClaim or its NodePool.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Last seen</Th>
                  <Th>Object</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {report.events.map((e, i) => (
                  <tr key={`${e.namespace}/${e.name}/${i}`} className="border-t border-border align-top">
                    <Td className="whitespace-nowrap text-muted-foreground">{formatAge(e.lastSeen)}</Td>
                    <Td className="whitespace-nowrap">{e.objectKind}</Td>
                    <Td className="font-mono">{e.reason}</Td>
                    <Td className="min-w-48 whitespace-pre-wrap break-words">
                      {e.message}
                      {e.count > 1 && <span className="text-muted-foreground"> ×{e.count}</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function Verdict({ report }: { report: KarpenterDisruption }) {
  if (report.disrupting) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <RefreshCcw className="size-4 text-sky-600 dark:text-sky-400" />
        Karpenter is disrupting this node{report.disruptionReason && ` (${report.disruptionReason})`}.
      </p>
    )
  }
  if (report.blocked.length === 0) {
    if (report.incomplete.length > 0) {
      return (
        <p className="flex items-center gap-2 text-sm">
          <CircleHelp className="size-4 text-muted-foreground" />
          No blocker found, but Klustr cannot see everything that could block this node.
        </p>
      )
    }
    return (
      <p className="flex items-center gap-2 text-sm">
        <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        Nothing blocks Karpenter from disrupting this node. Consolidation still needs a cheaper or emptier
        placement; the events below say why it chose not to.
      </p>
    )
  }
  return (
    <p className="flex items-center gap-2 text-sm">
      <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
      {verdictText(report.blocked, report.incomplete.length > 0)}
    </p>
  )
}

const DISRUPTIONS = ['Empty', 'Underutilized', 'Drifted'] as const

// verdictText names what the blockers hold back, since a blocker can stop
// consolidation while drift replacement still goes ahead, or the reverse.
function verdictText(blocked: string[], incomplete: boolean): string {
  const isBlocked = (r: string) => blocked.includes(r)
  if (DISRUPTIONS.every(isBlocked)) return 'Karpenter will not voluntarily disrupt this node.'
  const stopped = disruptionPhrases(DISRUPTIONS.filter(isBlocked), 'this node')
  const still = disruptionPhrases(
    DISRUPTIONS.filter((r) => !isBlocked(r)),
    'it',
  )
  const text = `Karpenter will not ${stopped.join(' or ')}.`
  return incomplete ? text : `${text} It can still ${still.join(' and ')}.`
}

function disruptionPhrases(reasons: readonly string[], object: string): string[] {
  const out: string[] = []
  if (reasons.includes('Empty') && reasons.includes('Underutilized')) out.push(`consolidate ${object}`)
  else if (reasons.includes('Empty')) out.push(`remove ${object} once it is empty`)
  else if (reasons.includes('Underutilized')) out.push(`consolidate ${object} while it runs pods`)
  if (reasons.includes('Drifted')) out.push(`replace ${object} when it drifts`)
  return out
}

function blockerScope(reasons: string[]): string {
  if (DISRUPTIONS.every((r) => reasons.includes(r))) return ''
  if (reasons.length === 2 && reasons.includes('Empty') && reasons.includes('Underutilized')) return 'consolidation'
  if (reasons.length === 1 && reasons[0] === 'Drifted') return 'drift'
  return reasons.join(', ')
}

function BlockerScope({ blocker }: { blocker: KarpenterBlocker }) {
  const scope = blockerScope(blocker.reasons)
  const expiry = blocker.until ? formatExpiry(blocker.until) : null
  const lifts = expiry && expiry.tone !== 'expired' ? `lifts ${expiry.label}` : ''
  const note = [scope && `Blocks ${scope}`, lifts].filter(Boolean).join(', ')
  if (!note) return null
  return <span className="text-xs text-muted-foreground"> {note.charAt(0).toUpperCase() + note.slice(1)}.</span>
}

function budgetState(b: KarpenterBudget): string {
  if (b.error) return `Invalid: ${b.error}`
  if (!b.active) return 'Inactive'
  if (b.remaining < b.allowed) return `Active, allows ${b.allowed}, ${b.remaining} left`
  return `Active, allows ${b.allowed}`
}

function BlockerLink({ contextName, blocker }: { contextName: string | null; blocker: KarpenterBlocker }) {
  if (blocker.objectKind === 'Pod' || blocker.objectKind === 'PodDisruptionBudget') {
    return (
      <span className="font-mono text-xs">
        (<OwnerLink owner={{ kind: blocker.objectKind, name: blocker.name } as OwnerRef} namespace={blocker.namespace} context={contextName} />)
      </span>
    )
  }
  return null
}
