# Terminal

Klustr has a built-in terminal drawer at the bottom of the window. Each tab is a
real shell **on your machine** — not in the cluster — with its `KUBECONFIG`
already pointed at the context you opened it for. Your installed CLIs (`kubectl`,
`helm`, `stern`, `k9s`, …) run against the right cluster with no extra setup.

> The terminal is a local shell wrapper, not an in-cluster session. For a shell
> *inside* a container use **Exec**, and for a root shell *on a node* use
> **Node shell** — both in [Workloads & debugging](workloads-and-debugging.md).

## Opening and toggling

- Press **`⌘\``** (macOS) / **`Ctrl+\``** (Linux) to toggle the drawer.
- Opening it with a single active context auto-creates the first tab for that
  context.
- Drag the drawer's top edge to resize it; the height is remembered across
  restarts.

Windows is not supported yet.

## Tabs and contexts

- Each tab is bound to one context. The **`+`** button adds a tab; in
  multi-context / aggregated mode it lets you pick which context the new tab
  targets.
- The shell inherits your environment (so your normal `PATH` and tools are
  there) but gets a `KUBECONFIG` that is a minified, single-context copy of your
  kubeconfig — so `kubectl` in that tab always talks to that tab's cluster.
- Hiding the drawer keeps tabs alive: their shells and scrollback are preserved.
  Closing the last tab closes the drawer.
- Disconnecting a context closes every terminal bound to it.

## Opening an external terminal app

Prefer your own terminal? A tab can launch an external app (Terminal, iTerm2,
Ghostty, Warp, Alacritty, kitty, WezTerm, Hyper on macOS; the same tools probed
on `PATH` on Linux) with the context already selected.

- Klustr remembers your **preferred app** and launches it directly next time.
- **Alt/Option-click** the external-launch button to force the picker and change
  the default.
