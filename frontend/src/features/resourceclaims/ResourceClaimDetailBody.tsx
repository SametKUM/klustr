import { useCallback } from 'react'
import { api, type DeviceRequestDetail, type ResourceClaimDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
  Td,
  Th,
} from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function ResourceClaimDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getResourceClaim(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ResourceClaimDetail>(contextName, 'ResourceClaim', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="ResourceClaim">
        <Field label="Status">{detail.status}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <DeviceRequestsSection requests={detail.requests} />
      {detail.allocatedDevices.length > 0 && (
        <Section title="Allocated devices">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Request</Th>
                  <Th>Driver</Th>
                  <Th>Pool</Th>
                  <Th>Device</Th>
                </tr>
              </thead>
              <tbody>
                {detail.allocatedDevices.map((d, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono"><Copyable value={d.request} /></Td>
                    <Td className="font-mono"><Copyable value={d.driver} /></Td>
                    <Td className="font-mono"><Copyable value={d.pool} /></Td>
                    <Td className="font-mono"><Copyable value={d.device} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {detail.reservedFor.length > 0 && (
        <Section title="Reserved for">
          <ul className="space-y-0.5 font-mono text-xs">
            {detail.reservedFor.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}

export function DeviceRequestsSection({ requests }: { requests: DeviceRequestDetail[] }) {
  if (requests.length === 0) return null
  return (
    <Section title="Device requests">
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Name</Th>
              <Th>DeviceClass</Th>
              <Th>Mode</Th>
              <Th>Count</Th>
              <Th>Admin</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => (
              <tr key={i} className="border-t border-border align-top">
                <Td className="font-mono"><Copyable value={r.name} /></Td>
                <Td className="font-mono">{r.deviceClassName ? <Copyable value={r.deviceClassName} /> : '—'}</Td>
                <Td>{r.allocationMode || '—'}</Td>
                <Td>{r.count || '—'}</Td>
                <Td>{r.adminAccess ? 'yes' : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
