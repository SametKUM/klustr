# Gateway API

When the `gateway.networking.k8s.io` CRDs are present, Klustr adds a **Gateway API**
sidebar group. Each entry requires its CRD and permission to list and watch that
resource in the same context. Lists update live through typed informers, including
when access is limited to the namespace configured in your kubeconfig context.

It is vendor-neutral: Envoy Gateway, Cilium, Istio, Contour, NGINX Gateway Fabric
or any conformant implementation all work.

## What you get

- **Gateways** with their **listener table** and status.
- **HTTPRoutes / GRPCRoutes** showing parents, hostnames, and accepted status pills.
- **TLSRoutes / TCPRoutes / UDPRoutes** with parent references, backend ports and
  weights, and per-controller route conditions. TLSRoutes also show hostnames.
- **ListenerSets** with parent Gateway, listener protocols, TLS certificates,
  allowed route kinds, attached routes, and listener conditions.
- **BackendTLSPolicies** with target resources, SNI hostname, certificate names,
  CA references or system trust, and per-ancestor controller conditions.
- **GatewayClasses** and **ReferenceGrants**.

Klustr discovers the served API version for each resource. It prefers `v1` and
also supports TLSRoute `v1alpha3`/`v1alpha2`, TCPRoute and UDPRoute `v1alpha2`,
BackendTLSPolicy `v1alpha3`, and ReferenceGrant `v1beta1`. ListenerSet requires
`gateway.networking.k8s.io/v1`; experimental `XListenerSet` remains in the generic
browser. Multi-context views query only contexts that support each resource.

## Reading route status

The route detail renders a per-rule **match → backend → weight** matrix plus the
`RouteParentStatus` block. That's what makes a broken route quick to spot: a parent
that hasn't **Accepted** a route, or a backend that came back `ResolvedRefs=False`
with `RefNotPermitted` (typically a missing ReferenceGrant across namespaces), is
one click away rather than buried in YAML.

TLS, TCP, and UDP routes show backend sets for each rule without HTTP match
fields. Links to supported parents and backends preserve the resource's context
and namespace. Missing or stale status on these routes, ListenerSets, and
BackendTLSPolicies is shown as unknown; condition reasons and messages remain
available for diagnosis.

## When to use the generic browser instead

If your cluster has Gateway API CRDs that Klustr doesn't render with a typed view,
they still show up under the generic [Custom Resources](custom-resources.md) browser
by API group, with a YAML detail.
