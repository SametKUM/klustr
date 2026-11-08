# Screenshot gallery

Every shot is captured from two kind clusters seeded with realistic workloads and deliberate failures. The shots cycle through Klustr's themes, so the gallery doubles as a tour of them.

[Back to the project README](../../README.md#screenshots).

|   |   |
|---|---|
| ![Aggregated pods — Dracula](01-pods-aggregated-dracula.png) | ![Connections — Default Dark](02-connections-default-dark.png) |
| **Aggregated pods** — two clusters and three namespaces in one table; failing pods sit next to the healthy rows | **Connections** — contexts grouped by tag, two checked for an aggregated session, a saved group for one-click reconnect |
| ![Pod diagnosis — Default Light](03-pod-diagnosis-default-light.png) | ![Multi-pod logs — Dracula Light](04-logs-stream-dracula-light.png) |
| **Pod diagnosis** — a card that says *why* the pod is unhealthy and what to check next | **Multi-pod logs** — one stream across a Deployment, a color per pod, live regex filter |
| ![Debug container — One Dark](05-debug-container-one-dark.png) | ![Helm upgrade — Monokai Light](06-helm-upgrade-diff-monokai-light.png) |
| **Debug container** — netshoot injected into a shell-less pod, `ps` / `curl` / `dig` against the target | **Helm upgrade** — values on the left, the dry-run rendered manifest on the right, apply only after reading it |
| ![Argo CD — One Light](07-argo-applications-one-light.png) | ![Flux Kustomization — Monokai](08-flux-kustomization-monokai.png) |
| **Argo CD** — Sync / Health pills, per-row Refresh, Suspend and Sync through the Kubernetes API | **Flux CD** — a failed Kustomization with its status message, source and path readable without YAML |
| ![Gateway API — Tokyo Night](09-gateway-httproute-tokyo-night.png) | ![cert-manager chain — Nord Light](10-certmanager-chain-nord-light.png) |
| **Gateway API** — rule matrix plus `RouteParentStatus`: Accepted, but `ResolvedRefs=False` with `RefNotPermitted` | **cert-manager** — Certificate → CertificateRequest → Order → Challenge, with the ACME self-check error |
| ![Access Review — Nord](11-access-review-nord.png) | ![YAML diff — Default Dark](12-yaml-diff-default-dark.png) |
| **Access Review** — a ServiceAccount's effective permissions as a resource × verb matrix per scope, wildcard rules flagged | **YAML edit** — Monaco editor with the server-side dry-run diff before apply |
| ![Rollout history — Monokai Light](13-rollout-history-monokai-light.png) | ![Node drain — Dracula](14-node-drain-dracula.png) |
| **Rollout history** — revision diff with change causes and one-click rollback | **Node drain** — Eviction API progress, the PDB-blocked pod called out and retried |
| ![Terminal drawer — One Dark](15-terminal-drawer-one-dark.png) | ![Cluster overview — Nord](17-cluster-overview-nord.png) |
| **Terminal** — a local shell pinned to a context under the table, `KUBECONFIG` already set | **Cluster overview** — CPU / memory / pod capacity per cluster and a live warnings feed |
| ![Istio VirtualService — One Light](18-istio-virtualservice-one-light.png) | ![Karpenter NodeClaims — Tokyo Night](19-karpenter-nodeclaims-tokyo-night.png) |
| **Istio** — a VirtualService's weighted canary and header match as a rule table | **Karpenter** — NodeClaims with node, pool, instance, zone and the Launched / Registered / Initialized steps |
| ![KEDA HPA — Nord Light](20-keda-hpa-nord-light.png) | ![Tekton PipelineRun — Dracula Light](21-tekton-pipelinerun-dracula-light.png) |
| **KEDA** — a KEDA-managed HPA with its external metrics mapped back to the cron and CPU triggers | **Tekton** — a failed PipelineRun's task table: the failing test, the tasks it skipped, and the finally task that still ran |
| ![Kyverno Policy tab — Monokai](22-kyverno-policy-tab-monokai.png) | |
| **Kyverno** — a Deployment's own policy report on its Policy tab, the failing count on the tab label | |
