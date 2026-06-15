# Workloads & debugging

Klustr gives every workload the live operations you'd otherwise reach for `kubectl`
to do — logs, exec, port-forward, events — plus a few that are normally awkward,
like a root node shell and in-place pod resize. All of them respect a context's
[read-only mode](getting-started.md#read-only-mode).

## Logs

Open a pod (or a workload) and switch to the **Logs** tab for a streaming,
stern-style view:

- Multi-pod streaming with a distinct ANSI color per pod.
- Follow mode, log-level highlighting, regex filtering.
- Save the current buffer to a file.

In aggregated mode the stream spans the pods across every active context.

## Exec

The **Exec** tab opens an interactive shell into any container over SPDY — the same
transport `kubectl exec` uses. Pick the container if the pod has more than one.

## Port-forwarding

Start a forward from a pod or service. Klustr suggests a free local port, keeps a
persistent indicator in the header while forwards are active, and lets you
click-to-open an HTTP forward in your browser. Active forwards are listed in the
header indicator and can be stopped individually.

## Node shell

From a node, **Node shell** gives you a root shell on that node. It works by
launching a temporary privileged `nsenter` pod, attaching to it over exec, and
removing the pod when the session ends — no SSH, nothing pre-installed on the node.

Treat this like `kubectl debug node/...`: it is a powerful, explicitly
user-initiated action that runs with node-level privileges.

## Cordon, uncordon & drain

A node offers one-click **cordon** / **uncordon**, and a **drain** that evicts pods
through the Eviction API with live progress. The drain is PDB-aware and skips
DaemonSet and mirror pods, matching `kubectl drain` semantics.

## Events

The **Events** tab on a resource shows the core `Events` filtered to that object, so
you see exactly what the control plane has said about it.

## Pod diagnosis

When a pod is unhealthy, Klustr surfaces a diagnosis card explaining *why* — for
common states like `CrashLoopBackOff` or `OOMKilled` — so you don't have to
reverse-engineer it from raw status fields.

## Editing and rolling out

- **YAML edit** — a Monaco editor with a server-side dry-run diff shown before
  apply.
- **Scale / restart / pause-resume** — replica controls, one-click rolling restart,
  inline pause/resume, and inline HPA min/max editing.
- **In-place pod resize** — change a running container's CPU / memory requests and
  limits via the `pods/resize` subresource, with no pod recreation; the live resize
  status (Deferred / Infeasible) is shown.
- **Rollout history & rollback** — a side-by-side template diff across revisions and
  one-click revert for Deployments, StatefulSets and DaemonSets.
