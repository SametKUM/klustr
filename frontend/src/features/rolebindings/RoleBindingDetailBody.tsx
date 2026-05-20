import { useCallback } from 'react'
import { api, type RoleBindingDetail, type SubjectDetail, type RoleRefDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { useUIStore } from '@/store/ui'

export function RoleBindingDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getRoleBinding(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<RoleBindingDetail>(contextName, 'RoleBinding', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <RoleRefBlock contextName={contextName} namespace={namespace} roleRef={detail.roleRef} createdAt={detail.createdAt} />
      <SubjectsTable contextName={contextName} fallbackNamespace={namespace} subjects={detail.subjects} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}

export function RoleRefBlock({
  contextName,
  namespace,
  roleRef,
  createdAt,
}: {
  contextName: string | null
  namespace: string
  roleRef: RoleRefDetail
  createdAt: string
}) {
  const openResource = useUIStore((s) => s.openResource)
  const targetKind = roleRef.kind === 'ClusterRole' ? 'ClusterRole' : 'Role'
  const targetNamespace = targetKind === 'ClusterRole' ? '' : namespace
  return (
    <Section title="Role Reference">
      <Field label="Kind">{roleRef.kind}</Field>
      <Field label="Name">
        <button
          type="button"
          onClick={() =>
            openResource({
              kind: targetKind,
              namespace: targetNamespace,
              name: roleRef.name,
              context: contextName ?? undefined,
            })
          }
          className="font-mono text-xs underline-offset-2 hover:underline"
        >
          {roleRef.name}
        </button>
      </Field>
      <Field label="API Group">{roleRef.apiGroup || '—'}</Field>
      <Field label="Age">{formatAge(createdAt)}</Field>
    </Section>
  )
}

export function SubjectsTable({
  contextName,
  fallbackNamespace,
  subjects,
}: {
  contextName: string | null
  fallbackNamespace: string
  subjects: SubjectDetail[]
}) {
  const openResource = useUIStore((s) => s.openResource)
  return (
    <Section title={`Subjects (${subjects.length})`}>
      {subjects.length === 0 ? (
        <div className="text-xs text-muted-foreground">No subjects.</div>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Kind</Th>
                <Th>Namespace</Th>
                <Th>Name</Th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => {
                const isSA = s.kind === 'ServiceAccount'
                const ns = s.namespace || (isSA ? fallbackNamespace : '')
                return (
                  <tr key={i} className="border-t border-border">
                    <Td>{s.kind}</Td>
                    <Td className="font-mono">{ns || '—'}</Td>
                    <Td className="font-mono">
                      {isSA ? (
                        <button
                          type="button"
                          onClick={() =>
                            openResource({
                              kind: 'ServiceAccount',
                              namespace: ns,
                              name: s.name,
                              context: contextName ?? undefined,
                            })
                          }
                          className="underline-offset-2 hover:underline"
                        >
                          {s.name}
                        </button>
                      ) : (
                        s.name
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
