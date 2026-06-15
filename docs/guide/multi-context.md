# Multi-context & aggregated mode

Klustr can drive two or more contexts at once and present them as a single virtual
cluster. This is useful for comparing environments, or for operating a fleet of
clusters that share workloads.

## Aggregated mode

On the **Connections** screen, check **two or more** contexts instead of one. When
you connect:

- Every list view fans out across all selected contexts and adds a **Context**
  column so you can tell rows apart.
- Cluster overviews aggregate CPU / memory / pod counts across the whole set.
- Detail dialogs, logs, exec and the rest operate on the specific context of the
  row you opened.

A single selected context behaves exactly as before — aggregation kicks in only at
two or more.

## Saved groups

A recurring multi-context selection can be saved as a named **group** with its own
color:

- Save the current selection as a group from the Connections screen.
- Activate a saved group with one click — it sets the active context set in a
  single step.
- Groups also appear at the top of the in-session **context switcher** dropdown, so
  you can jump between groups mid-session without returning to the Connections
  screen.

## Per-context health

The status bar pings every active context roughly every 25 seconds (a `/version`
call with a short timeout). Each context gets a dot:

- **green** — healthy,
- **amber** — slow ping,
- **red** — failed; hover for the actual error.

## Context tags and the color stripe

You can attach up to three colored **tags** to a context (and define your own tag
colors). The top bar paints a thin stripe matching the context's primary tag — or
the active group's color — so you always have a constant visual reminder of which
environment you're touching.

Today the stripe (plus per-context [read-only mode](getting-started.md#read-only-mode))
is the main guardrail against running a destructive action on the wrong cluster, so
it's worth tagging production distinctly.

## Namespace selection across a set

The namespace filter is remembered **per active-context set**: a single cluster
keeps its own filter, and each distinct multi-cluster set keeps its own. Namespaces
that don't exist in a given context are simply ignored for that context.
