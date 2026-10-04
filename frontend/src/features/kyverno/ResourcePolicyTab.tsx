import type { PolicyReportDetail } from '@/lib/api'
import { Field, Section } from '@/features/_shared/DetailPrimitives'
import { PolicyResultsTable, ReportTally } from './PolicyResults'
import { useOpenKyvernoResource } from './useOpenKyvernoResource'

type Props = {
  contextName: string | null
  report: PolicyReportDetail
}

// PolicyTabLabel is the tab trigger's text, with the count of failing and
// erroring results so a problem shows before the tab is opened.
export function PolicyTabLabel({ report }: { report: PolicyReportDetail }) {
  const failing = report.fail + report.error
  return (
    <>
      Policy
      {failing > 0 && (
        <span className="ml-1.5 rounded bg-destructive/15 px-1 text-[10px] font-medium text-destructive">{failing}</span>
      )}
    </>
  )
}

// ResourcePolicyTab shows the policy results for the resource whose detail is
// open, from the report Kyverno keeps for it.
export function ResourcePolicyTab({ contextName, report }: Props) {
  const { canOpenKyverno, openKyverno } = useOpenKyvernoResource(contextName)
  const reportKind = report.namespace ? 'PolicyReport' : 'ClusterPolicyReport'
  return (
    <div className="space-y-6">
      <Section title="Policy report">
        <Field label="Results">
          <ReportTally report={report} />
        </Field>
        <Field label="Report">
          <button
            type="button"
            onClick={() => openKyverno(reportKind, report.namespace, report.name)}
            className="rounded text-left font-mono text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {reportKind} {report.name}
          </button>
        </Field>
      </Section>
      <Section title={`Results (${report.results.length})`}>
        <PolicyResultsTable results={report.results} canOpenPolicy={canOpenKyverno} onOpenPolicy={openKyverno} />
      </Section>
    </div>
  )
}
