import type { SelectedResource } from '@/store/ui'

// Groups and resources of the kinds the Kyverno group surfaces. The policy
// reports are the Policy WG's shared wgpolicyk8s.io format, which Kyverno
// writes (and other tools may too). Dispatch uses the bare kinds plus a group
// guard: "Policy" and "PolicyException" exist in other API groups as well.
export const KYVERNO_GROUP = 'kyverno.io'
export const KYVERNO_CEL_GROUP = 'policies.kyverno.io'
export const POLICY_REPORT_GROUP = 'wgpolicyk8s.io'

export const KYVERNO_CLUSTERPOLICY_RESOURCE = 'clusterpolicies'
export const KYVERNO_POLICY_RESOURCE = 'policies'
export const KYVERNO_POLICYEXCEPTION_RESOURCE = 'policyexceptions'
export const KYVERNO_VALIDATINGPOLICY_RESOURCE = 'validatingpolicies'
export const KYVERNO_NAMESPACEDVALIDATINGPOLICY_RESOURCE = 'namespacedvalidatingpolicies'
export const POLICYREPORT_RESOURCE = 'policyreports'
export const CLUSTERPOLICYREPORT_RESOURCE = 'clusterpolicyreports'

export type KyvernoKind =
  | 'ClusterPolicy'
  | 'Policy'
  | 'PolicyException'
  | 'ValidatingPolicy'
  | 'NamespacedValidatingPolicy'
  | 'PolicyReport'
  | 'ClusterPolicyReport'

export const KYVERNO_KIND_REF: Record<KyvernoKind, { group: string; resource: string }> = {
  ClusterPolicy: { group: KYVERNO_GROUP, resource: KYVERNO_CLUSTERPOLICY_RESOURCE },
  Policy: { group: KYVERNO_GROUP, resource: KYVERNO_POLICY_RESOURCE },
  PolicyException: { group: KYVERNO_GROUP, resource: KYVERNO_POLICYEXCEPTION_RESOURCE },
  ValidatingPolicy: { group: KYVERNO_CEL_GROUP, resource: KYVERNO_VALIDATINGPOLICY_RESOURCE },
  NamespacedValidatingPolicy: {
    group: KYVERNO_CEL_GROUP,
    resource: KYVERNO_NAMESPACEDVALIDATINGPOLICY_RESOURCE,
  },
  PolicyReport: { group: POLICY_REPORT_GROUP, resource: POLICYREPORT_RESOURCE },
  ClusterPolicyReport: { group: POLICY_REPORT_GROUP, resource: CLUSTERPOLICYREPORT_RESOURCE },
}

export function kyvernoKindOf(resource: SelectedResource | null): KyvernoKind | null {
  if (!resource) return null
  const ref = KYVERNO_KIND_REF[resource.kind as KyvernoKind] as
    | (typeof KYVERNO_KIND_REF)[KyvernoKind]
    | undefined
  return ref && resource.gvr?.group === ref.group ? (resource.kind as KyvernoKind) : null
}
