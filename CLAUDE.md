# Klustr

Cross-platform Kubernetes desktop client. Multi-context cluster management with live resource updates, log streaming, exec, port-forwarding, full RBAC, **Custom Resource Definitions**, **Helm**, **Argo CD** and **Gateway API** support. **Nothing is installed in the cluster** — Klustr is a pure client that drives the standard Kubernetes API using the user's `~/.kube/config`.

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop framework | Wails v2 (Go backend + native webview) |
| Backend | Go 1.26 + `client-go` (typed + dynamic + discovery) |
| Custom resources | `client-go/dynamic` + the apiextensions CRD list, watched live |
| Gateway API | `sigs.k8s.io/gateway-api` typed informer factory (not the dynamic client) |
| Helm | upstream `helm.sh/helm/v3` library, no shelling out |
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + lucide-react + sonner (toasts) |
| Real-time state | Zustand |
| Mutations | TanStack Query (mutations only — no query cache) |
| Tables | TanStack Table |
| Terminal (logs + exec) | xterm.js |
| Code editor (YAML) | Monaco |
| Toolchain | mise (pins Go, Node, Wails CLI versions) |
| Lint / format | golangci-lint (Go) + ESLint (frontend) |
| Tests | `go test` (backend) + Vitest + jsdom (frontend) |
| CI release builds | GitHub Actions matrix on hosted runners (macOS, Windows, Linux) |
| Release publishing | `softprops/action-gh-release` (macOS asset only today), Homebrew cask auto-bump |

## Project Structure

```
klustr/
├── .mise.toml                    tool versions (Go, Node, Wails CLI)
├── .golangci.yml                 golangci-lint v2 config
├── wails.json                    Wails project config
├── main.go                       application entry point
├── internal/                     pure Go business logic (no Wails imports)
│   └── kube/
│       ├── config.go                kubeconfig parsing, context discovery
│       ├── path.go                  GUI-launch PATH augmentation for exec credential helpers
│       ├── manager.go               ClientManager lifecycle (Clientset / Ping / Watch /
│       │                            StopWatch) + Logs / Exec / PortForward / CRD forwarders
│       │                            + watcher() helper
│       ├── manager_<group>.go       per-sidebar-group Wails-facing forwarders
│       │                            (workloads / networking / config / storage / cluster /
│       │                             autoscaling / admission / rbac / helm / gateway / pods)
│       ├── mutate.go                generic apply / delete / scale via dynamic client +
│       │                            kindToGVR map
│       ├── informers.go             contextWatcher lifecycle + the single start() that wires
│       │                            every kind's event handler + shared helpers
│       │                            (sortByNamespaceName, formatLabelSelector, OwnerRef, …)
│       ├── informers_<group>.go     per-sidebar-group XxxInfo types and lister methods
│       ├── details.go               shared types (ContainerSummary) + helpers
│       │                            (matchLabels, deploymentConditions, quantitiesToStrings,
│       │                             policyRules, rbacSubjects, …)
│       ├── details_<group>.go       per-sidebar-group XxxDetail structs and Get() builders
│       ├── crd.go                   apiextensions CRD discovery + per-CR dynamic informers
│       ├── helm.go                  helm v3 list / install / upgrade / rollback / uninstall +
│       │                            repo / chart search
│       ├── helm_cache.go            chart cache helpers for repo browsing
│       ├── argocd.go                Application list + Sync / Refresh through the K8s API
│       │                            (no argocd CLI, no argocd-server dependency)
│       ├── gateway.go               typed Gateway API informers + status / route helpers
│       ├── rollout.go               Deployment / StatefulSet / DaemonSet rollout history
│       │                            and one-click revert (kubectl rollout undo path)
│       ├── install.go               one-click metrics-server install / uninstall from
│       │                            upstream components.yaml
│       ├── events.go                core/v1 Events list filtered by involvedObject
│       ├── metrics.go               metrics.k8s.io pod CPU/memory usage (polled, not watched)
│       ├── overview.go              cluster-wide CPU / memory / pod aggregation
│       ├── logs.go                  streaming log sessions
│       ├── exec.go                  SPDY exec sessions
│       └── portforward.go           port-forward registry & lifecycle
├── app/                          Wails binding adapter (thin layer over ClientManager)
├── frontend/
│   ├── eslint.config.js          ESLint flat config
│   ├── vitest.config.ts          Vitest setup (jsdom environment)
│   └── src/
│       ├── App.tsx               layout shell, sidebar (RESOURCE_GROUPS) + MainView dispatch
│       ├── features/             one folder per resource kind + _shared/ helpers
│       │   ├── _shared/            ResourceDetailPanel, ResourceTable, StatusBar,
│       │   │                       CommandPalette, RowActionDialogs, themes, resourceGroups
│       │   ├── contexts/           ContextSwitcher, ConnectionsScreen, ContextTagPicker,
│       │   │                       NamespaceSelector, ConnectionStatus
│       │   ├── pods/, deployments/, services/, …  one folder per built-in kind
│       │   ├── crds/, helm/, argocd/, gateways/, httproutes/, grpcroutes/, …
│       │   ├── overview/           cluster + workloads overview cards
│       │   └── portforward/        header indicator + dialog
│       ├── components/           shadcn/ui primitives
│       ├── store/                Zustand stores
│       │   ├── resources.ts        live caches keyed by (context, kind, namespace, name)
│       │   ├── metrics.ts          metrics-server data + availability flag
│       │   ├── portForwards.ts     active port-forwards list
│       │   ├── crds.ts             discovered CRDs per context (by api group)
│       │   ├── helm.ts             helm release index per (context, namespace, name)
│       │   ├── namespaceFavorites.ts  per-context starred namespaces
│       │   ├── tablePrefs.ts       per-kind column order / size / visibility (persisted)
│       │   ├── ui.ts               Zustand store + useActiveContexts / useIsAggregated selectors
│       │   ├── ui.types.ts         pure type declarations (ResourceView, ResourceKind, …)
│       │   └── ui.persistence.ts   localStorage read*/persist* helpers + applyThemeClasses
│       ├── lib/wails/            auto-generated Go bindings — DO NOT EDIT
│       ├── lib/api.ts            ergonomic wrappers over wails bindings
│       └── lib/events.ts         onKubeChange / onPFUpdate Wails event subscriptions
├── build/                        Wails build artifacts (icons, Info.plist)
├── docs/screenshots/             README hero + feature screenshots
├── hack/                         user's local fixtures (NEVER commit anything under hack/)
└── .github/workflows/            release matrix (release.yml → builds 3 OSes, ships macOS)
```

The `internal/` ↔ `app/` split is intentional:
- `internal/kube` is Wails-agnostic and stays testable with plain `go test`.
- `app/` is the thin Wails binding adapter — if we ever ship a CLI or web mode, only `app/` is rewritten.

## Architecture Patterns

### Live data flow — Informer pattern

We never poll the Kubernetes API. Resource lists are kept live by `client-go` Informers running in the Go backend:

```
K8s API ──watch──> Informer ──cache+events──> Wails event ──> Zustand store ──> React UI
```

- One `SharedInformerFactory` per active context, watching **all namespaces** for every built-in kind. The full set is enumerated by the handler-registration block in `(*contextWatcher).start` (`internal/kube/informers.go`) and the initial-touch list at the end of `start()` — workloads (`Pod`, `Deployment`, `ReplicaSet`, `ReplicationController`, `StatefulSet`, `DaemonSet`, `Job`, `CronJob`), networking (`Service`, `Endpoints`, `EndpointSlice`, `Ingress`, `NetworkPolicy`), config (`ConfigMap`, `Secret`), storage (`PersistentVolumeClaim`, `PersistentVolume`, `StorageClass`), cluster (`Namespace`, `Node`, `Lease`, `ResourceQuota`, `LimitRange`, `IngressClass`, `PriorityClass`, `RuntimeClass`), autoscaling (`HorizontalPodAutoscaler`, `PodDisruptionBudget`), admission (`MutatingWebhookConfiguration`, `ValidatingWebhookConfiguration`) and the full RBAC set (`ServiceAccount`, `Role`, `RoleBinding`, `ClusterRole`, `ClusterRoleBinding`).
- Namespace selection in the UI is applied at lister-query time. Switching namespaces does **not** tear down or restart informers.
- Informer lifecycle is owned by `ClientManager`; cancellation propagates via `context.Context`.
- The backend debounces event bursts (~100 ms window) before emitting to the frontend to avoid flooding React.
- Pod metrics are not informers — `metrics.k8s.io` only supports List. The frontend polls every 15 s and hides usage columns if the API is unavailable.

### Custom Resources — auto-discovery via crdWatcher

`internal/kube/crd.go` owns a `crdWatcher` that runs alongside the typed informer factory:

1. On context attach, it lists `apiextensions.k8s.io/v1 CustomResourceDefinition` and emits a `_crds` change so the frontend (`useCRDStore`) can render the sidebar.
2. When the user navigates into a CR list view, `EnsureCRWatch(group, version, resource)` lazily starts a **dynamic** informer for that GVR. Subsequent list/get calls hit the local cache — no on-demand list calls to the apiserver.
3. CR list/detail go through the dynamic client only — there is no typed clientset for CRs. The detail dialog shows YAML by default.

Two CRDs upgrade the sidebar from "browse" to "first-class integration":
- `gateway.networking.k8s.io` (any kind) → adds the **Gateway** group (see Gateway API section below).
- `applications.argoproj.io` → adds the **Argo CD** group (see Argo CD section).

Both detections live in `App.tsx` (`hasGatewayAPI`, `hasArgoApplications`) by group/resource so reacting to a brand-new CRD install requires no rebuild.

### Helm — release Secrets via the informer cache

`internal/kube/helm.go` implements Helm v3 read+mutation against the cluster directly using the upstream `helm.sh/helm/v3` library — **no `helm` binary on PATH, no embedded chart packaging**.

- **List path is informer-backed**: helm releases are stored as `Secret`s with a `helm.sh/release.v1` type. The contextWatcher's Secret event handler calls `maybeTouchHelm()` so a release change re-triggers Helm UI updates without an extra list. See `helm_cache.go` for the per-(context, namespace, name) cache.
- **Mutations** (Install / Upgrade / Rollback / Uninstall) call helm v3 actions directly with a `kubeClient` constructed from our existing `restConfig`. Every Install/Upgrade returns a **dry-run** diff first; the UI shows it before the second call applies for real.
- **Repos** are a JSON file under `~/Library/Application Support/klustr/helm-repos.json` (or platform equivalent). `SearchCharts` and `ChartVersions` use the existing repo index files Helm wrote.

### Argo CD — auto-detected, K8s-API-driven

`internal/kube/argocd.go` lists `argoproj.io/v1alpha1 Application` via the dynamic client and runs a CR informer for them.

- **Sync** and **Refresh** are implemented as direct annotations on the Application:
  - Sync: PATCH `operation.initiatedBy` + `operation.sync` block (the same payload `argocd app sync` PUTs).
  - Refresh: PATCH the `argocd.argoproj.io/refresh` annotation.
- This means Klustr works against any Argo CD install **without** an `argocd-server` ingress, an Argo CD login, or the `argocd` CLI on the user's PATH. The only requirement is that the kubeconfig user has permission to update Applications.
- The Application detail dialog reads `.status.resources` to render a **Resources** tab listing every managed object. Each row deep-links into the regular Klustr detail panel for that object — so you can drill `App → Deployment → Pod → Logs` without leaving the dialog.

### Gateway API — typed informers

`internal/kube/gateway.go` uses `sigs.k8s.io/gateway-api/pkg/client/informers/externalversions` (a typed factory) rather than the dynamic client, so list updates are live without polling and `.status.conditions` arrive with strong types.

- Sidebar group shown only when the `gateway.networking.k8s.io` CRDs are present.
- Detail dialogs render the listener table, per-rule `match → backend → weight` matrix and `RouteParentStatus` block by reading the typed status — a `ResolvedRefs=False` / `RefNotPermitted` backend is one click away.
- Vendor-neutral: works with Envoy Gateway, Cilium, Istio, Contour, NGINX Gateway Fabric or any conformant implementation.

### Multi-context aggregated mode

Klustr can drive 2+ contexts at once as a single virtual cluster:

- `useActiveContexts()` returns `aggregatedContexts` when length ≥ 2, else `[selectedContext]`. Every list/detail call fans out per context client-side and tags rows with a `Context` column.
- The connection picker (`ConnectionsScreen`) lets the user **save a named group** of contexts. `contextGroups` lives in the UI store; selecting a saved group is one click.
- The status bar pings every active context every ~25 s (`/version` against a copy of the rest.Config with a 5 s timeout — see `manager.go` `Ping`). The dot turns amber on slow pings, red on failure with the real error in the tooltip.
- Switching contexts (or the namespace selection across them) does not restart informers for already-attached contexts — `Watch` is idempotent per context and `StopWatch` is what tears one down.

### Context tags & groups

`ui.persistence.ts` persists two related concepts:

- **Tags** (`contextTags`): up to `MAX_TAGS_PER_CONTEXT` (3) string ids per context. Colored, picked from a fixed palette. Custom tag definitions live in `customTags`.
- **Groups** (`contextGroups`): named multi-context selections with their own color. Activating a group sets `aggregatedContexts` and `activeGroupId` in one transaction.

The top bar paints a thin colored stripe matching the primary tag (or active group) so the user has a constant visual reminder which environment they're touching. This is the only "guardrail" today against running a destructive action on the wrong cluster — a richer destructive-context guard is on the roadmap.

### Frontend state — three layers, never mixed

| Layer | Tool | Use |
|---|---|---|
| Real-time resource state | Zustand (`resources`, `metrics`, `portForwards`, `crds`, `helm`) | Live caches fed by Wails events |
| Server actions | TanStack Query (mutations only) | Delete, apply, scale, restart, start/stop port-forward, helm install/upgrade |
| UI state | Zustand (`ui` + `ui.types` + `ui.persistence`, plus `tablePrefs` and `namespaceFavorites`) | Selected context(s)/namespace(s), theme, detail navigation stack, table column prefs, namespace stars |

Do not put Informer data into TanStack Query's cache, and do not put mutation state into Zustand. Crossing these layers causes subtle bugs around invalidation and re-renders.

### UI layout

Four-region layout:

- **Top color stripe** (optional): reflects active context tag / group color.
- **Header**: app name, context switcher, namespace selector, context-tag picker, port-forward indicator, disconnect button, theme picker.
- **Sidebar**: collapsible resource-type navigation grouped Overview / Workloads / Config / Network / Storage / Cluster / **Access Control**. Two groups appear conditionally: **Gateway** (when the gateway CRDs are present) and **Argo CD** (when the Application CRD is present). **Helm** is always shown. CRD groups (anything outside the above) are listed by API group below the static groups.
- **Main**: resource list (`ResourceTable` generic over `<T>`) → detail Dialog with `Overview / Logs / Exec / Events / History / YAML` tabs as relevant.
- **Status bar** (bottom): per-active-context ping dots, port-forward count, GitHub repo link, version label.

The detail panel keeps a small navigation stack (`resourceNavStack` in `ui.ts`): drilling from a workload into a related pod, or from a pod into its owner/node, pushes the previous resource so the back arrow in the header can pop back to it.

## Adding a new built-in resource

Each kind is a thin, repeatable slice. Pick the `<group>` your kind belongs to from the sidebar (`workloads` / `networking` / `config` / `storage` / `cluster` / `autoscaling` / `admission` / `rbac`) and add to the matching per-group files. To add one:

1. **Backend types**: `XxxInfo` (list shape) in `internal/kube/informers_<group>.go`, `XxxDetail` (detail shape) in `internal/kube/details_<group>.go`.
2. **Informer registration**: append an event-handler block in `(*contextWatcher).start` (still in `informers.go`) that calls `w.touch("Xxx")`, then add `"Xxx"` to the initial-touch kind list at the end of `start()`.
3. **Listers**: `(*contextWatcher).Xxxs(namespace)` and `(*contextWatcher).Xxx(namespace, name)` in `informers_<group>.go`. Detail builder is in `details_<group>.go`.
4. **Manager**: list and detail forwarder methods on `*ClientManager` in `manager_<group>.go`. Bodies are 5 lines; mirror neighbors.
5. **App bindings**: `ListXxxs` and `GetXxx` on `*App` (in `app/`). Wails autogenerates the TS binding on the next `wails dev`.
6. **GVR**: entry in `kindToGVR` (`internal/kube/mutate.go`) so YAML edit / delete / scale work via the dynamic client.
7. **Frontend**: types in `frontend/src/lib/api.ts`, slot in `frontend/src/store/resources.ts`, add the kind/view to the `ResourceKind` / `ResourceView` unions in `frontend/src/store/ui.types.ts`, create `XxxView.tsx` + `XxxDetailBody.tsx` under `frontend/src/features/<plural>/`, dispatch case in `ResourceDetailPanel.tsx`, sidebar entry in `_shared/resourceGroups.ts` (`RESOURCE_GROUPS`) + `MainView` case in `App.tsx`.

Always init Go slices through `append([]string{}, src...)` so nil never serializes as JSON `null` — the React detail bodies treat these as arrays unconditionally.

## Adding a Custom Resource (CRD) view

For CRs Klustr **already lists generically** via the CRD watcher with a YAML-only detail. Only carve a dedicated typed view if the CR has meaningful status / spec UI beyond `kubectl edit` — see how `argocd.go` and `gateway.go` are done:

- Either reuse a typed client (Gateway API has one) or unmarshal `*unstructured.Unstructured` into a typed Go struct before populating the Detail.
- Hide the CR behind the generic CRD sidebar entry by default; promote it to its own sidebar group only when a CRD detection in `App.tsx` confirms the API is present.
- Mutations should go through the K8s API (PATCH / annotation flip), not by shelling out to a vendor CLI.

## Coding Conventions

### Comments

- Default to **no comments**. Well-named identifiers are the documentation.
- Add a comment only when the **why** is non-obvious: a hidden constraint, a workaround for a specific bug, a non-trivial invariant, a deliberate deviation from convention.
- Never write "WHAT" comments — the code already says what it does.
- Never reference issues, PRs, callers, or "added for feature X" — that belongs in the commit message and rots in the code.

### General code style

- Don't add error handling for impossible cases. Validate at system boundaries (user input, Kubernetes API responses, file I/O); trust internal callers and framework guarantees.
- Don't introduce abstractions for hypothetical future needs. Three similar lines is better than a premature helper.
- Don't add backwards-compatibility shims, feature flags, or `_unused` placeholder renames unless the project actually needs them.
- Delete dead code immediately. Don't leave `// removed` comments.

### Go

- Idiomatic Go: small interfaces, value semantics where appropriate, errors as values.
- `context.Context` is the first parameter for any function that may block, spawn goroutines, or talk to the network.
- Return errors; don't panic in library code.
- Long-running goroutines (informers, log streams, exec sessions, port-forwards) **must** accept a `context.Context` and stop cleanly on cancel.
- Never log or expose user credentials, tokens, or kubeconfig contents, even at debug level.

### TypeScript / React

- `strict: true`. No `any` unless at a true boundary, and only with a comment explaining why.
- Prefer narrow types over broad ones. Discriminated unions over optional flags.
- Wails bindings under `frontend/src/lib/wails/` are auto-generated. Never edit by hand. Wrap them in `frontend/src/lib/api.ts` for ergonomic helpers.
- Real-time data is read from Zustand selectors only — never call Go directly in a render path.
- Wrap heavy components (Monaco, xterm.js) in Suspense so they don't block initial render.
- Use shadcn/ui primitives as the base; do not pull in a second component library.

### Kubernetes interactions

- Use the typed `client-go` clientset for built-in resources.
- Use the typed `sigs.k8s.io/gateway-api` clientset for Gateway API kinds.
- Use the dynamic client + discovery client for unknown CRDs.
- Never use `kubectl`, `helm` or `argocd` as a subprocess from inside the app. Talk to the API directly.

### Conventional Commits

- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`).
- Prefer many small, logically scoped commits over a single monolithic one — target ~10–20 small commits per feature batch when work splits cleanly.

## Testing

The test surface is **headless unit tests only** — Vitest+jsdom for frontend, `go test` for backend. No Playwright, no in-app integration tests.

- **What to test**: store reducers and selectors (`store/*.test.ts`), pure helpers (`internal/kube/*_test.go`), parsers (`releaseInfoFromRelease`, `crdInfoFromUnstructured`), and decision logic that does not require a running Kubernetes API.
- **What to skip**: anything that needs the Wails runtime, a real kubeconfig, or a real cluster. Tests in `internal/kube` that need a client construct a fake clientset directly — they never call `manager.Watch`.
- Tests live next to the code (`foo.go` ↔ `foo_test.go`, `foo.ts` ↔ `foo.test.ts`).
- Manual verification is `wails dev` and a real kubeconfig — see **Verification Before Reporting Done** below.

## Things to Avoid

- Polling the Kubernetes API instead of using Informers (metrics.k8s.io is the only exception — it has no watch).
- Installing anything inside the cluster — Klustr is a pure client. The only exception is the explicit "install metrics-server" action, which the user opts into and which Klustr can later uninstall by the label it stamps.
- Importing Wails-specific packages into `internal/kube/...`.
- Returning nil slices from Go: the JSON encoder emits `null` and React `.length` access blows up. Use `append([]string{}, src...)`.
- Passing a fresh object literal into TanStack `state.columnSizing` (or similar controlled props) every render — TanStack fires the change handler and the controlled store ping-pongs into an infinite loop.
- Adding global stores beyond the documented layers — current legal set is `resources`, `metrics`, `portForwards`, `crds`, `helm`, `namespaceFavorites`, `ui`, `tablePrefs`. Anything new needs a reason in the PR.
- Generating boilerplate docs (CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT) before they're needed.
- Marketing-style copy or emoji in UI strings unless explicitly requested.
- Editing auto-generated Wails bindings.
- Staging anything under `hack/`. That directory is the user's local fixtures and is curated by hand.

## Development Workflow

```bash
mise install                  # one-time: installs Go, Node, Wails CLI per .mise.toml
wails dev                     # hot-reload dev session; opens native window

# Backend
go test klustr/internal/...   # unit tests
go vet ./...                  # vet
golangci-lint run             # full lint (optional, slower)

# Frontend (inside frontend/)
npm test                      # Vitest
npm run lint                  # ESLint
npm run typecheck             # tsc --noEmit
npm run build                 # production bundle
```

Docker is **not** required — local dev uses native toolchains; CI builds use GitHub-hosted runners directly.

## Release Process

Klustr is pre-1.0 and ships from `main`. The flow per release:

1. **Land all changes on `main`** via small Conventional Commits.
2. **Decide the bump**:
   - `feat:` commits in the range → minor bump (`v0.X.0`).
   - Only `fix:` / `refactor:` / `test:` / `docs:` / `chore:` → patch bump (`v0.X.Y`).
3. **Smoke-test in `wails dev`**: run it, exercise the changed feature, wait for explicit OK before pushing.
4. **Tag and push**: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`. This triggers `.github/workflows/release.yml`.
5. **Wait for the workflow** (~7 min). It builds darwin-arm64, windows-amd64, linux-amd64, attaches only the macOS asset (today) and creates a **draft** GitHub release with auto-generated notes appended to the install block.
6. **Rewrite the draft notes** by hand (`gh release edit vX.Y.Z --notes "$(cat <<'EOF' … EOF)"`). Keep the install block at the bottom verbatim.
7. **Publish**: `gh release edit vX.Y.Z --draft=false`. The same workflow run automatically bumps the Homebrew cask in the tap repo (`HOMEBREW_TAP_TOKEN`).

Notes on the workflow:
- `prerelease: true` is set automatically when the tag contains a `-` (e.g. `v0.15.0-rc1`).
- Linux and Windows binaries are built but **not** published yet — that ships as part of the v1 path.
- Auto-update is **not** wired in — also a v1 prerequisite.

## Verification Before Reporting Done

- Go: `go test klustr/internal/...` and `go vet ./...` pass.
- Frontend (inside `frontend/`): `npm test`, `npm run lint`, `npm run typecheck` pass.
- Manual: `wails dev` runs and the changed feature actually works in the native window. Type checks alone are not sufficient for UI work.
