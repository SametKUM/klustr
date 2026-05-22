# Contributing to Klustr

Bug reports and focused pull requests are welcome. Klustr is a desktop Kubernetes client that **never installs anything in the cluster** — every feature has to fit that constraint.

## Before you start

- Read [`CLAUDE.md`](CLAUDE.md). It is the architecture + conventions contract: file layout, the informer pattern, the "add a new resource kind" recipe, and the release process all live there.
- For larger changes, open an issue first so we can sanity-check direction. Small fixes can go straight to a PR.

## Build and run

```bash
mise install      # installs Go, Node and the Wails CLI pinned in .mise.toml
wails dev         # opens the native window, hot-reload
```

A local [kind](https://kind.sigs.k8s.io/) cluster (`kind create cluster --name klustr-dev`) is the easiest dev target. No Docker required for the build itself — only for kind, if you choose it.

## Before you open the PR

Run what CI runs:

```bash
go test klustr/internal/... && go vet ./...
cd frontend && npm test && npm run lint && npm run typecheck
```

For UI work, also exercise the change in `wails dev` — type checks don't catch visual regressions.

## PR conventions

- One topic per PR.
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- Prefer many small commits over one monolith.
- For UI changes, attach a screenshot or short clip in the PR description.
- Don't edit `frontend/src/lib/wails/` (auto-generated).

## What stays out of Klustr

A few categories will be declined:

- In-cluster components (no operators, no controllers, no shipped helm charts). The metrics-server install action is the only exception, and it just applies upstream YAML the user opts into.
- Subprocess calls to `kubectl` / `helm` / `argocd`. We use the typed and dynamic Go clients directly.
- Telemetry, analytics or any third-party binaries.

## License

By submitting a contribution you agree it will be released under the [MIT License](LICENSE), the same as the rest of the project.
