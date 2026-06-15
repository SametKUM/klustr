# Custom Resources (CRDs)

Klustr discovers Custom Resource Definitions automatically — you don't configure
anything. Any CRD on the cluster becomes browsable.

## How discovery works

On connect, Klustr lists `CustomResourceDefinition` objects and groups them in the
sidebar **by API group**, below the built-in resource groups. When you open a CR
list view, Klustr lazily starts a watch for that specific resource, so subsequent
list and detail reads come from the local cache rather than hitting the apiserver
again. A brand-new CRD installed while you're connected shows up without a restart.

## Browsing and editing

- The generic CR list shows the objects for that kind.
- The detail dialog shows **YAML by default**.
- YAML edit, delete and (where applicable) scale work through the dynamic client,
  the same as built-in kinds — subject to a context's
  [read-only mode](getting-started.md#read-only-mode).

## Promoted integrations

Some CRDs get a first-class, typed UI instead of the generic YAML view when their
API is detected:

- **Argo CD** and **Flux** — see [GitOps](gitops.md).
- **Gateway API** — see [Gateway API](gateway-api.md).
- **cert-manager** — Certificates, Issuers / ClusterIssuers and the full issuance
  chain (CertificateRequest → Order → Challenge), with ready/expiry status and a
  one-click **Renew**.

Everything else stays under the generic CRD browser — which is enough for most
operators most of the time.
