# Cluster & workloads overviews

Klustr has two dashboard views that summarize a whole context set at a glance —
one for cluster capacity, one for workload health. Both aggregate across every
active context and honor the current namespace selection, so they work the same
in single-cluster and [aggregated](multi-context.md) mode.

## Cluster overview

Under **Cluster → Overview**. Three donuts plus a couple of counts:

- **CPU** and **Memory** — usage vs requests vs limits, against the cluster's
  allocatable / capacity. Usage comes from `metrics.k8s.io`; requests and limits
  are summed from running pods.
- **Pods** — running pods vs the allocatable / capacity the nodes advertise.
- **Node count** and **namespace count**.

Usage numbers need a metrics server. If `metrics.k8s.io` isn't available, the
capacity/requests/limits parts still render and the usage slice is replaced with
a short "metrics unavailable" note — see [Workloads & debugging](workloads-and-debugging.md)
for the one-click metrics-server install.

## Workloads overview

Under **Workloads → Overview**. One health bar per workload kind — Pods,
Deployments, StatefulSets, DaemonSets, ReplicaSets, ReplicationControllers, Jobs
and CronJobs:

- The bar splits into **healthy** (green) and **unhealthy** (red).
- Intentionally-idle resources aren't counted as broken: a scaled-to-zero
  Deployment/ReplicaSet, or a suspended CronJob, shows as a neutral segment
  rather than red.
- Click a card to jump straight to that resource's list.

Below the cards is a **recent events** feed with a search box. In aggregated mode
it spans every active context and tags each row with its context.

## Refresh behavior

Both overviews refresh live: workload counts update on the debounced resource
change stream, and everything re-polls periodically. The events feed is a real
apiserver list (there is no Events informer), so it refreshes on the slower poll
only rather than on every pod churn.
