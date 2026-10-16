// Group + resource identifiers for the Istio CRs Klustr renders as typed
// read-only views. The version is intentionally absent: Istio serves these at
// versions that vary by install, so the frontend reads the served version from
// the discovered CRD (useCRDStore) and the backend resolves it the same way.
export const ISTIO_NETWORKING_GROUP = 'networking.istio.io'
export const ISTIO_SECURITY_GROUP = 'security.istio.io'

export const ISTIO_VIRTUALSERVICE_RESOURCE = 'virtualservices'
export const ISTIO_DESTINATIONRULE_RESOURCE = 'destinationrules'
export const ISTIO_PEERAUTHENTICATION_RESOURCE = 'peerauthentications'
export const ISTIO_GATEWAY_RESOURCE = 'gateways'
export const ISTIO_SERVICEENTRY_RESOURCE = 'serviceentries'
export const ISTIO_SIDECAR_RESOURCE = 'sidecars'
export const ISTIO_AUTHORIZATIONPOLICY_RESOURCE = 'authorizationpolicies'
export const ISTIO_REQUESTAUTHENTICATION_RESOURCE = 'requestauthentications'
