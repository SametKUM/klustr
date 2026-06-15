# Helm

Klustr speaks Helm v3 directly against the cluster using the upstream Helm library —
there is **no `helm` binary on your PATH** and nothing is shelled out. The **Helm**
sidebar group is always available.

## Browsing releases

Helm stores each release as a Secret of type `helm.sh/release.v1`. Klustr reads
those from the same informer cache it already maintains for Secrets, so the release
list stays live as releases change — no extra polling.

## Installing and upgrading

Install or Upgrade from the Helm views. The flow is two-step on purpose:

1. Klustr runs the action as a **dry-run** first and shows you the resulting diff.
2. Only after you confirm does it apply for real.

You get the usual options (values editor, Wait, Atomic). Mutations run against a
Helm client built from Klustr's existing connection — so they use exactly the
permissions your kubeconfig grants.

## Rollback and uninstall

- **Rollback** to a previous revision.
- **Uninstall** a release.

Both go through the Helm library directly, the same as Install/Upgrade.

## Repositories and chart search

Repositories are kept in a JSON file under your user config directory
(`helm-repos.json`). Once a repo is added, chart search and version listing use the
repo index files Helm has written — so you can find a chart and pick a version
without leaving Klustr.

> All Helm mutations respect a context's [read-only mode](getting-started.md#read-only-mode).
