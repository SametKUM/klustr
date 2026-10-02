# Klustr

Cross-platform Kubernetes desktop client: multi-context cluster management with live resource lists, logs, exec, port-forwarding and RBAC-aware views of every built-in kind. Beyond the core API, Klustr gives widely used ecosystem tools first-class support — dedicated views and actions instead of raw YAML — and growing that set is the product's main direction. Any CRD without a dedicated integration is still browsable generically. Klustr is a pure client — it drives the Kubernetes API with the user's kubeconfig and installs nothing in the cluster. The one exception is the opt-in metrics-server install, which Klustr can remove again by the label it stamps.

## Layout

- `internal/kube/` holds everything that talks to a cluster and imports nothing from Wails, so it stays testable with plain `go test`; `doc.go` has the package overview. Files are split per sidebar group: `informers_<group>.go` (list types and listers), `details_<group>.go` (detail builders), `manager_<group>.go` (`ClientManager` forwarders).
- `app/` is the thin Wails binding layer over `ClientManager` — the only part a CLI or web mode would replace.
- `frontend/src/lib/wails/` and `frontend/src/lib/api.generated.ts` are generated: change the Go side and run `npm run generate:api` instead of editing them. `frontend/src/lib/api.ts` is only for bindings that need real normalization on top.
- The landing site and user guides live in [SametKUM/klustr.dev](https://github.com/SametKUM/klustr.dev). When a change alters behavior a guide describes, point it out so the guide can be updated there in its own pull request.

## How it works

- **Live data comes from informers.** K8s watch → informer → Wails event (debounced ~100 ms) → Zustand → React. Resource lists are not polled; the deliberate exceptions are `metrics.k8s.io`, which has no watch, and the bounded cluster Events feed, both refreshed every 15 s by the frontend.
- **Access routing.** On `Watch`, `permissions.go` probes SelfSubjectAccessReview per kind and routes it to the all-namespaces factory, a factory scoped to the kubeconfig namespace, or nothing (denied: empty list, `errKindNoAccess` on Get). Every lister and Get goes through `w.factoryFor(kind)`, which also starts that kind's informer on first use (`ensureKind`); only Namespace and Pod start on attach. Covered kinds are listed twice: `kindBindings` in `informers.go` and the probe's `watchedKinds` in `permissions.go`.
- **Namespaces and contexts filter at query time**, so switching them never restarts informers. A multi-namespace selection reaches the backend as a comma-separated string; namespaced list forwarders route through `listAcrossNamespaces`, and one that passes the string straight to a lister renders an empty table. In aggregated (multi-context) mode the frontend fans list calls out per context, while detail and mutation calls target the row's own context.
- **CRDs.** `crd.go` watches the CRD list and starts a dynamic informer per GVR when a CR view opens (`EnsureCRWatch`); a CR without a dedicated integration gets a generic list with its printer columns and a YAML detail.
- **Helm** uses the upstream `helm.sh/helm/v3` library. Releases are read from the Secret informer (`helm.sh/release.v1`); Install and Upgrade return a dry-run diff that the UI shows before applying.
- **Credentials.** GUI launches skip the shell rc, so `shellenv.go` imports the login-shell environment and `creds*.go` capture aws-vault credentials into the exec plugin env. Captured credentials stay in memory: they are not logged, written to disk or sent over a binding.

## Conventions

- Talk to the Kubernetes API from Go: typed `client-go` for built-ins, the typed `sigs.k8s.io/gateway-api` client for Gateway API, dynamic + discovery for other CRDs. Everything so far works through the API alone, so a kubeconfig is all a user needs — nothing extra to install, and nothing that depends on the shell PATH a GUI launch doesn't get.
- Return empty slices rather than nil from anything that reaches the frontend (`append([]string{}, src...)`): nil encodes as JSON `null`, and the React detail bodies treat these fields as arrays.
- Long-running goroutines (informers, log and exec streams, port-forwards) take a `context.Context` and stop cleanly on cancel.
- Credentials, tokens and kubeconfig contents stay out of logs at every level.
- Frontend state has three layers: Zustand for live informer data, TanStack Query for mutations only (no query cache), Zustand `ui` / `tablePrefs` for UI state. Keeping them apart avoids invalidation and re-render bugs. Render paths read live data from store selectors, not from Go calls. A new global store needs a reason in the PR.
- TanStack Table controlled state (`state.columnSizing` and similar) needs a stable reference; a fresh object literal each render ping-pongs with the store into an infinite loop.
- Lazy-load Monaco and xterm.js behind Suspense. Build UI from shadcn/ui primitives.
- UI copy is plain and terse, without marketing language or emoji.
- Comments explain a non-obvious why: a hidden constraint, a workaround, an invariant. Issue and PR context belongs in the commit message.

## Adding a built-in kind

A new kind is the same thin slice its neighbors are, across `internal/kube`, `app/` and `frontend/src`: pick an existing kind from the same group, grep its name (for example `ResourceQuota`) and mirror every hit. Several of those spots fail silently when missed, leaving the kind empty or half-working instead of breaking the build:

- `watchedKinds` in `permissions.go`: without it the access probe skips the kind and every list comes back empty.
- `kindBindings` in `informers.go`: without it the informer never starts.
- `kindToGVR` in `mutate.go`: the probe needs the GVR, and YAML edit, delete and scale go through it.
- `listAcrossNamespaces` in the namespaced list forwarder.
- `RESOURCE_GROUPS`, the `MainView` switch in `App.tsx` and the `ResourceDetailPanel.tsx` dispatch: the switches have `default` branches, so a missing case falls through to a fallback screen or an empty detail body rather than failing typecheck.

## Adding an ecosystem integration

An integration is worth building when a widely used tool's resources need more than YAML: status worth reading at a glance, relations worth following, actions worth a button. The current set is Helm plus the CRD-backed groups in `CRD_REQUIREMENTS` (`visibleResourceGroups.ts`); some tools enrich an existing view instead of adding a group, as `keda.go` does for HPAs.

- Backend: a `<name>.go` in `internal/kube`, using the project's typed client when it ships one (`gateway.go`), otherwise unstructured objects decoded into typed Go structs (`argocd.go`, `flux.go`).
- Actions so far are Kubernetes API calls: Argo CD Sync and Refresh, for example, are PATCHes on the Application.
- Frontend: a feature folder, `RESOURCE_GROUPS` items and `CRD_REQUIREMENTS` entries. The group then shows only when an active context serves the CRDs, and aggregated mode fans out only to those contexts.

## Testing and checks

Tests are headless unit tests next to the code: `go test` for the backend, Vitest + jsdom for the frontend. They cover pure helpers, parsers, store reducers and selectors, and decision logic. Anything that needs the Wails runtime, a real kubeconfig or a cluster stays out; backend tests that need a client build a fake clientset rather than calling `manager.Watch`.

```bash
mise install                  # one-time toolchain install
wails dev                     # hot-reload native window
go test klustr/internal/...   # also with -race
go vet ./...
golangci-lint run
cd frontend && npm test && npm run lint && npm run typecheck && npm run build
```

Run the checks for the side you changed. For UI work, also try the change in `wails dev`: passing type checks says nothing about whether the screen works.

## Commits and releases

- Every change reaches `main` through a pull request. The branch ruleset rejects direct pushes, admins included, and requires the `Backend (Go)`, `Backend (Go, Windows)`, `Frontend (TypeScript)` and `PR title` checks.
- Conventional Commits, small and logically scoped. A squash merge takes the PR title as the commit subject, so the title follows the same format; `pr-title.yml` checks it.
- Keep `[skip ci]` out of commit messages, body included: on a PR's head commit it keeps the required checks from ever reporting, and the PR can't merge.
- Releases ship from `main` by tag. A signed `vX.Y.Z` tag makes `release.yml` build and sign every platform into a draft release; publishing the draft runs `publish-packages.yml`, which bumps the Homebrew tap and the AUR package. Only admins can push, move or delete `v*` tags.
- Third-party actions are pinned to a full commit SHA and listed in the repository's allowed actions; a new one fails to start until it is added there. GitHub's own `actions/*` and `github/*` are always allowed.
