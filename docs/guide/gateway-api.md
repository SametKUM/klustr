# Gateway API

When the `gateway.networking.k8s.io` CRDs are present, Klustr adds a **Gateway API**
sidebar group. It uses typed informers (`sigs.k8s.io/gateway-api`) rather than the
generic CRD browser, so list updates are live and status arrives strongly typed.

It is vendor-neutral: Envoy Gateway, Cilium, Istio, Contour, NGINX Gateway Fabric
or any conformant implementation all work.

## What you get

- **Gateways** with their **listener table** and status.
- **HTTPRoutes / GRPCRoutes** showing parents, hostnames, and accepted status pills.
- **GatewayClasses** and **ReferenceGrants**.

## Reading route status

The route detail renders a per-rule **match → backend → weight** matrix plus the
`RouteParentStatus` block. That's what makes a broken route quick to spot: a parent
that hasn't **Accepted** a route, or a backend that came back `ResolvedRefs=False`
with `RefNotPermitted` (typically a missing ReferenceGrant across namespaces), is
one click away rather than buried in YAML.

## When to use the generic browser instead

If your cluster has Gateway API CRDs that Klustr doesn't render with a typed view,
they still show up under the generic [Custom Resources](custom-resources.md) browser
by API group, with a YAML detail.
