# Security Policy

## Supported versions

Klustr is pre-1.0 and ships from `main`. Fixes land in the **latest release** —
there are no long-term support branches for older tags.

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Any older release | ❌ — please upgrade before reporting |

If you hit a security issue, first confirm it still reproduces on the latest
release (or a `wails dev` build of `main`).

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's [Private Vulnerability Reporting](https://github.com/SametKUM/klustr/security/advisories/new):
go to the repository's **Security** tab → **Report a vulnerability**. This keeps
the report confidential until a fix is available and lets us coordinate a
disclosure with you.

When reporting, please include:

- The Klustr version (Help → About, or the title bar) and your OS.
- A description of the issue and its impact.
- Steps to reproduce, ideally against a throwaway cluster — **never** attach a
  real kubeconfig, credentials, tokens, or cluster data.

We will acknowledge the report, investigate, and keep you updated on remediation
and any release that addresses it. Credit is offered to reporters who want it.

## Security posture

Klustr's design intentionally limits its blast radius. The following are deliberate
properties of the application, not incidental:

- **Pure client.** Nothing is installed in your cluster. Klustr drives the standard
  Kubernetes API using your existing `~/.kube/config` and acts only with the
  permissions that kubeconfig already grants. The one exception is the explicit,
  opt-in "install metrics-server" action, which Klustr can also uninstall.
- **Credentials stay in memory.** When a credential helper (e.g. aws-vault) is
  used, captured secrets live in process memory only. They are never written to
  disk, never logged (not even at debug level), and never sent across a Wails
  binding to the frontend. The on-disk credential store holds provider/profile
  names only — never secret values.
- **No telemetry in the app.** The desktop application does not phone home. The only
  network calls it makes are to your clusters and a single, version-only check
  against the GitHub Releases API for update notifications.
- **Local-only attack surface.** Klustr is a desktop app driven by your own
  kubeconfig; it exposes no listening service and runs with your user's privileges.

The node shell feature launches a temporary privileged `nsenter` pod to provide a
root shell on a node, and it is removed when the session ends. This is a powerful,
explicitly user-initiated action — treat it as you would `kubectl debug node/...`.
