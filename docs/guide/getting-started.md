# Getting started

Klustr is a pure client: it installs nothing in your cluster and uses the same
`~/.kube/config` your `kubectl` already reads. Launch the app, point it at a
context, and you see a live view of everything that context has permission to see.

## Connecting to a context

1. On launch, Klustr reads `~/.kube/config` and lists every context it finds on
   the **Connections** screen.
2. Click a context to connect. You land on the resource browser with the sidebar
   on the left.
3. The header's **Disconnect** button drops you back to the Connections screen at
   any time.

You can pin a context as the default with **Auto-connect** on its card — Klustr
will connect to it directly on the next launch instead of showing the picker.

Connecting starts only the Namespace and Pod informers up front; every other
resource kind starts watching the first time you open it. Opening a kind you have
no permission to list shows an empty table rather than erroring — Klustr probes
your access on connect and simply hides what you can't see.

## Selecting namespaces

The namespace selector in the header filters every list view:

- Leave it empty for **all namespaces** (the default).
- Pick one or more namespaces to narrow the view. The selection is remembered per
  cluster (and per multi-cluster set) across restarts.
- Press `⌘N` to search namespaces quickly, and star the ones you use most so they
  float to the top.

Switching namespaces only changes what the lists query — it never restarts the
underlying watches, so it's instant.

## Read-only mode

Each context has a per-context **read-only** switch. When it's on, every mutating
action (apply, delete, scale, restart, Helm install/upgrade, sync, …) is blocked
for that context. Use it to browse a production cluster with confidence that no
button can change anything.

## Finding things fast

- `⌘P` — command palette: fuzzy-search resources by name across the current view.
- `⌘N` — namespace search.
- `?` — keyboard shortcut cheatsheet.

## Next steps

- Connecting to more than one cluster at once: [Multi-context & aggregated mode](multi-context.md).
- Your kubeconfig uses `aws-vault` or another exec credential helper and Klustr
  can't authenticate when launched from the Dock: [Credential helpers](credential-helpers.md).
