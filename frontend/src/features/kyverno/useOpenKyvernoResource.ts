import { useCallback } from 'react'
import { findCRD, useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { KYVERNO_KIND_REF, type KyvernoKind } from './kyvernoKinds'

// useOpenKyvernoResource returns openers for the objects the Kyverno views
// link to: another Kyverno kind (a report's policy, an exception's policy) and
// the resource a report is about, which may be a built-in kind or a CR.
export function useOpenKyvernoResource(contextName: string | null) {
  const openResource = useUIStore((s) => s.openResource)
  const catalog = useCRDStore((s) => s.byContext)

  const canOpenKyverno = useCallback(
    (kind: KyvernoKind) =>
      !!contextName &&
      !!findCRD(catalog, contextName, KYVERNO_KIND_REF[kind].group, KYVERNO_KIND_REF[kind].resource),
    [catalog, contextName],
  )

  const openKyverno = useCallback(
    (kind: KyvernoKind, namespace: string, name: string) => {
      if (!contextName) return
      const ref = KYVERNO_KIND_REF[kind]
      const crd = findCRD(catalog, contextName, ref.group, ref.resource)
      if (!crd) return
      openResource({
        kind,
        namespace,
        name,
        context: contextName,
        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
      })
    },
    [catalog, contextName, openResource],
  )

  // openTarget opens a report's subject. A CRD of the same group and kind
  // makes it a CR (opened with its served gvr); anything else is a built-in.
  const openTarget = useCallback(
    (target: { apiVersion: string; kind: string; namespace: string; name: string }) => {
      if (!contextName || !target.kind) return
      const group = target.apiVersion.includes('/') ? target.apiVersion.split('/')[0] : ''
      const crd = group
        ? catalog[contextName]?.find((c) => c.group === group && c.kind === target.kind)
        : undefined
      openResource({
        kind: target.kind,
        namespace: target.namespace,
        name: target.name,
        context: contextName,
        gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      })
    },
    [catalog, contextName, openResource],
  )

  return { canOpenKyverno, openKyverno, openTarget }
}
