import {
  INTEGRATION_RESOURCES,
  type IntegrationResource,
  type IntegrationView,
} from './integrationCatalog.generated'

const BY_VIEW = new Map<string, IntegrationResource>(INTEGRATION_RESOURCES.map((r) => [r.view, r]))
const BY_GROUP_RESOURCE = new Map<string, IntegrationResource>(
  INTEGRATION_RESOURCES.map((r) => [`${r.group}/${r.resource}`, r]),
)

export function isIntegrationView(view: string): view is IntegrationView {
  return BY_VIEW.has(view)
}

// integrationFor identifies a selected CR by its group and resource, which are
// unique, rather than by kind: Klustr prefixes some kinds (FluxKustomization)
// and several tools share kind names (Policy, Application, Certificate).
export function integrationFor(
  gvr: { group: string; resource: string } | undefined,
): IntegrationResource | undefined {
  return gvr ? BY_GROUP_RESOURCE.get(`${gvr.group}/${gvr.resource}`) : undefined
}
