import type { PolicyReportInfo, PolicyReportResult } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Td, Th } from '@/features/_shared/DetailPrimitives'
import { policyRefFromResult, policyResultClass } from './kyvernoFormat'
import type { KyvernoKind } from './kyvernoKinds'

export function PolicyResultPill({ result }: { result: string }) {
  if (!result) return <span className="text-muted-foreground/70">—</span>
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${policyResultClass(result)}`}
    >
      {result}
    </span>
  )
}

// ReportTally shows a report's non-zero counts, worst first.
export function ReportTally({ report }: { report: Pick<PolicyReportInfo, 'fail' | 'error' | 'warn' | 'skip' | 'pass'> }) {
  const entries: [string, number][] = [
    ['fail', report.fail],
    ['error', report.error],
    ['warn', report.warn],
    ['skip', report.skip],
    ['pass', report.pass],
  ]
  const shown = entries.filter(([, n]) => n > 0)
  if (shown.length === 0) return <span className="text-muted-foreground">no results</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map(([result, n]) => (
        <span
          key={result}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${policyResultClass(result)}`}
        >
          {n} {result}
        </span>
      ))}
    </span>
  )
}

type Props = {
  results: PolicyReportResult[]
  canOpenPolicy: (kind: KyvernoKind) => boolean
  onOpenPolicy: (kind: KyvernoKind, namespace: string, name: string) => void
}

// PolicyResultsTable lists a report's results; the backend orders them worst
// first. A Kyverno policy name opens that policy.
export function PolicyResultsTable({ results, canOpenPolicy, onOpenPolicy }: Props) {
  if (results.length === 0) {
    return <div className="text-xs text-muted-foreground">This report has no results.</div>
  }
  const showResources = results.some((r) => r.resources.length > 0)
  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th>Result</Th>
            <Th>Policy</Th>
            <Th>Rule</Th>
            {showResources && <Th>Resources</Th>}
            <Th>Severity</Th>
            <Th>Message</Th>
            <Th>Age</Th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const ref = policyRefFromResult(r.policy, r.source)
            const openable = ref && canOpenPolicy(ref.kind)
            return (
              <tr key={`${r.policy}/${r.rule}/${i}`} className="border-t border-border align-top">
                <Td>
                  <PolicyResultPill result={r.result} />
                </Td>
                <Td className="font-mono">
                  {openable ? (
                    <button
                      type="button"
                      onClick={() => onOpenPolicy(ref.kind, ref.namespace, ref.name)}
                      className="rounded text-left text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {r.policy}
                    </button>
                  ) : (
                    r.policy || '—'
                  )}
                </Td>
                <Td className="font-mono">{r.rule || '—'}</Td>
                {showResources && (
                  <Td className="font-mono">
                    {r.resources.map((res) => `${res.kind} ${res.namespace ? `${res.namespace}/` : ''}${res.name}`).join(', ') || '—'}
                  </Td>
                )}
                <Td className="text-muted-foreground">{r.severity || '—'}</Td>
                <Td className="max-w-[32rem] whitespace-pre-wrap break-words">{r.message || '—'}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {r.timestamp ? formatAge(r.timestamp) : '—'}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
