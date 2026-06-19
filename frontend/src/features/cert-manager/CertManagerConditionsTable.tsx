import type { CertManagerCondition } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { Section, Td, Th } from '@/features/_shared/DetailPrimitives'

// CertManagerConditionsTable renders the full .status.conditions[] block in
// the metav1.Condition shape every cert-manager resource uses. Ready is the
// headline; Issuing surfaces an in-flight re-issuance.
export function CertManagerConditionsTable({
  conditions,
}: {
  conditions: CertManagerCondition[]
}) {
  if (!conditions || conditions.length === 0) {
    return (
      <Section title="Conditions">
        <div className="text-xs text-muted-foreground">
          No conditions reported yet — cert-manager has not reconciled.
        </div>
      </Section>
    )
  }
  return (
    <Section title={`Conditions (${conditions.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
              <Th>Age</Th>
              <Th>Message</Th>
            </tr>
          </thead>
          <tbody>
            {conditions.map((c) => (
              <tr key={c.type} className="border-t border-border align-top">
                <Td className="font-mono">{c.type}</Td>
                <Td>
                  <ConditionPill status={c.status} />
                </Td>
                <Td className="font-mono">{c.reason || '—'}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {c.lastTransitionTime ? formatAge(c.lastTransitionTime) : '—'}
                </Td>
                <Td className="max-w-[28rem] whitespace-pre-wrap break-words">
                  {c.message || '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
