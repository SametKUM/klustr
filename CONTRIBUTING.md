# Contributing to Klustr

Bug reports and focused pull requests are welcome. Klustr is a desktop Kubernetes client that **never installs anything in the cluster** — every feature has to fit that constraint.

## Before you start

- Read [`AGENTS.md`](AGENTS.md). It is the architecture + conventions contract: file layout, the informer pattern, the "add a new resource kind" and "add an ecosystem integration" recipes, and the release process all live there.
- For larger changes, open an issue first so we can sanity-check direction. Small fixes can go straight to a PR.

## Build and run

```bash
mise install      # installs Go, Node and the wails3 CLI pinned in .mise.toml
cd frontend && npm ci && cd ..
wails3 dev        # opens the native window; Vite hot reload, rebuilds on Go changes
```

`wails3 dev` rebuilds when a Go file is written in place, which is how VS Code saves. An editor that saves through a temporary file and a rename, such as JetBrains IDEs with "safe write" on, doesn't trigger it.

A local [kind](https://kind.sigs.k8s.io/) cluster (`kind create cluster --name klustr-dev`) is the easiest dev target. No Docker required for the build itself — only for kind, if you choose it.

## Before you open the PR

Run what CI runs:

```bash
go test klustr/internal/... && go vet -tags gtk3 ./...
cd frontend && npm test && npm run lint && npm run typecheck
```

For UI work, also exercise the change in `wails3 dev` — type checks don't catch visual regressions.

These checks must pass before a PR can merge.

## PR conventions

- One topic per PR.
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`) for commit messages and the PR title. PRs are usually squash-merged, so the title becomes the commit on `main`; a check enforces its format.
- Prefer many small commits over one monolith.
- For UI changes, attach a screenshot or short clip in the PR description.
- Don't edit `frontend/src/lib/wails/` (auto-generated); after changing a bound Go method or model, run `wails3 task bindings`.

## What stays out of Klustr

A few categories will be declined:

- In-cluster components (no operators, no controllers, no shipped helm charts). The metrics-server install action is the only exception, and it just applies upstream YAML the user opts into.
- Subprocess calls to `kubectl` / `helm` / `argocd`. We use the typed and dynamic Go clients directly.
- Telemetry, analytics or any third-party binaries.

## Code of conduct

Everyone taking part in the project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Klustr is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution you agree it is licensed under the same terms, as section 5 of the license describes.
