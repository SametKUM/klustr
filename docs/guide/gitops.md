# GitOps: Argo CD & Flux

Klustr drives both Argo CD and Flux **through the Kubernetes API** — no
`argocd-server` ingress, no Argo login, and no `argocd` or `flux` CLI on your PATH.
The only requirement is that your kubeconfig user can update the relevant resources.

Each integration's sidebar group appears only when its CRDs are detected on the
cluster, so nothing clutters the sidebar on a cluster that doesn't run it.

## Argo CD

Shown when the `applications.argoproj.io` CRD is present.

- **List** — Applications with Sync / Health status pills, watch-backed.
- **Sync** — implemented as the same PATCH (`operation.sync`) that `argocd app sync`
  issues.
- **Refresh** — flips the `argocd.argoproj.io/refresh` annotation.
- **Rollback** and cascade-aware **Delete** are available from the Application.
- **Resources tab** — the Application detail reads `.status.resources` and lists
  every managed object. Each row deep-links into Klustr's normal detail panel, so
  you can drill `App → Deployment → Pod → Logs` without leaving the dialog.

## Flux CD

Klustr covers the Flux toolkit kinds: Kustomization, HelmRelease, GitRepository,
HelmRepository, OCIRepository, Bucket, Provider, Alert and Receiver.

- Each shows its conditions, source, and applied revision.
- **Reconcile** and **Suspend / Resume** buttons hit the standard Flux annotations —
  again, no `flux` CLI involved.

> All sync / reconcile / suspend actions respect a context's
> [read-only mode](getting-started.md#read-only-mode).
