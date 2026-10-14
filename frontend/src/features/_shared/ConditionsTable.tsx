import type { ConditionDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionPill } from './ConditionPill'
import { Section, Td, Th } from './DetailPrimitives'

type Props = {
  conditions: ConditionDetail[]
  emptyMessage?: string
}

// ConditionsTable renders a status.conditions list in the metav1.Condition
// shape, the one conditions table integration detail bodies share.
export function ConditionsTable({ conditions, emptyMessage = 'No conditions reported yet.' }: Props) {
  if (conditions.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }
  // Not every controller records transition times; skip the column when none did.
  const showAge = conditions.some((c) => c.lastTransitionTime)
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Reason</Th>
            {showAge && <Th>Age</Th>}
            <Th>Message</Th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((c, i) => (
            <tr key={`${c.type}-${i}`} className="border-t border-border align-top">
              <Td className="font-mono">{c.type}</Td>
              <Td>
                <ConditionPill status={c.status} />
              </Td>
              <Td className="font-mono">{c.reason || '—'}</Td>
              {showAge && (
                <Td className="whitespace-nowrap text-muted-foreground">
                  {c.lastTransitionTime ? formatAge(c.lastTransitionTime) : '—'}
                </Td>
              )}
              <Td className="min-w-40 max-w-[28rem] whitespace-pre-wrap break-words">{c.message || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ConditionsSection is ConditionsTable under a "Conditions" heading.
export function ConditionsSection({
  conditions,
  emptyMessage,
  hideWhenEmpty = false,
}: Props & { hideWhenEmpty?: boolean }) {
  if (hideWhenEmpty && conditions.length === 0) return null
  return (
    <Section title={conditions.length > 0 ? `Conditions (${conditions.length})` : 'Conditions'}>
      <ConditionsTable conditions={conditions} emptyMessage={emptyMessage} />
    </Section>
  )
}
