# Platform integrations: cert-manager, Istio, Karpenter & KEDA

Beyond [GitOps](gitops.md) and [Gateway API](gateway-api.md), Klustr promotes a
few more CRD families from the generic [Custom Resources](custom-resources.md)
browser to first-class, typed views. Each sidebar group appears only when its
CRDs are detected in an active context, so nothing clutters a cluster that
doesn't run it.

All mutating actions below respect a context's
[read-only mode](getting-started.md#read-only-mode).

## cert-manager

Shown when the `cert-manager.io` CRDs are present.

- **Certificates** — ready state and expiry at a glance.
- **Issuers / ClusterIssuers** — the one-of spec (`acme` / `ca` / `selfSigned` /
  `vault` / `venafi`) is collapsed into a single **Type** column; ACME issuers
  also show their server and email.
- **Issuance chain** — a Certificate's detail drills down the full chain,
  `Certificate → CertificateRequest → Order → Challenge`, each as a tab whose
  rows deep-link into the matching detail. When issuance is stuck, this is where
  you see which step failed and why.
- **Renew** — one click, no `cmctl` on your PATH.

## Istio

Shown when the `networking.istio.io` CRDs are present.

- **VirtualServices**, **DestinationRules** and **PeerAuthentications**,
  watch-backed.
- The served API version is read from the discovered CRD rather than hardcoded,
  so it tracks whatever Istio version the cluster runs.

## Karpenter

Shown when the `karpenter.sh` CRDs are present.

- **NodePools** — weight, node class, consolidation policy, CPU / memory limits
  and current usage, node count and ready state.
- **NodeClaims** — provisioning status for the nodes Karpenter is bringing up.

## KEDA

KEDA has **no dedicated sidebar group** — its ScaledObjects stay in the generic
CRD browser. What Klustr adds is enrichment of the HPAs KEDA manages.

A KEDA-managed HPA is a vanilla HorizontalPodAutoscaler whose metrics are all
`External` and named `s0-…`, `s1-…` — without help they render as a wall of
identical "external" rows. Klustr maps each back to its ScaledObject trigger and
relabels it with the real trigger type plus the metadata that predicts scaling
(Prometheus metric + threshold, cron schedule, Kafka topic + lag, and so on).

Find it under **Config → HorizontalPodAutoscalers**: open a KEDA-owned HPA and
the Targets read as real triggers instead of opaque external metrics.
