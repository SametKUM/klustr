// Color class for a resource phase/status string, shared by the PVC / PV /
// Namespace list views and their detail panels so the at-a-glance severity
// color is the same in both places. Tokens are disjoint across these kinds
// (Bound/Available/Released/Failed for PV, Bound/Pending/Lost for PVC,
// Active/Terminating for Namespace), so one map serves all three.
export function phaseClass(phase: string): string {
  switch (phase) {
    case 'Bound':
    case 'Active':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'Pending':
    case 'Released':
    case 'Terminating':
      return 'text-amber-600 dark:text-amber-400'
    case 'Lost':
    case 'Failed':
      return 'text-destructive'
    case 'Available':
      return 'text-foreground'
    default:
      return 'text-muted-foreground'
  }
}
