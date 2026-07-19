# Klustr user guide

These guides cover how to *use* Klustr day to day. For the README's feature
overview and install instructions, start at the [project README](../../README.md);
for architecture and contributor conventions, see [`CLAUDE.md`](../../CLAUDE.md).

This is a growing set — the guides below are written; more feature areas will be
added over time.

## Getting around

- [Getting started](getting-started.md) — connecting to contexts, selecting
  namespaces, read-only mode.
- [Multi-context & aggregated mode](multi-context.md) — viewing several clusters
  as one, saved groups, and context tags.

## Connecting

- [Credential helpers (aws-vault & friends)](credential-helpers.md) — making
  kubeconfig exec plugins work when Klustr is launched from the Dock/Finder.

## Working with resources

- [Cluster & workloads overviews](overview.md) — capacity donuts, workload health
  bars, and the recent-events feed.
- [Workloads & debugging](workloads-and-debugging.md) — logs, exec, port-forward,
  node shell, events, and pod diagnosis.
- [Terminal](terminal.md) — the built-in shell drawer and launching an external
  terminal app.
- [Helm](helm.md) — browsing releases and install / upgrade / rollback / uninstall.
- [GitOps: Argo CD & Flux](gitops.md) — sync, refresh, reconcile and suspend
  without the vendor CLIs.
- [Gateway API](gateway-api.md) — Gateways, routes, and reading route status.
- [Platform integrations](integrations.md) — cert-manager, Istio, Karpenter and
  KEDA.
- [Custom Resources (CRDs)](custom-resources.md) — auto-discovery and the generic
  CR browser.

## Reporting problems

- Bugs: open an issue via the [bug report template](../../.github/ISSUE_TEMPLATE/bug_report.yml).
- Security issues: see the [security policy](../../SECURITY.md) — report privately,
  never in a public issue.
