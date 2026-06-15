# Credential helpers (aws-vault & friends)

Many kubeconfigs authenticate through an `exec` credential plugin — for example
`aws eks get-token` wrapped in `aws-vault exec <profile>`. These plugins rely on
two things that a terminal gives them but a GUI launch does not:

- a populated `PATH` (so the helper binary is found), and
- ambient cloud credentials / environment (so the helper can mint a token).

When you launch Klustr from Finder, the Dock, or a `.desktop` entry, the OS starts
it **without** your shell's startup files — so an exec plugin that works in your
terminal can fail in the app. Klustr fixes this in two layers.

## Layer 1: shell-environment import (automatic)

On a GUI launch (macOS/Linux only — never on Windows, never when started from a
terminal), Klustr runs your login shell once, captures its environment, and merges
into its own process:

- your full `PATH`, plus
- an allowlist of relevant variables (`AWS_VAULT_BACKEND`, `AWS_CONFIG_FILE`,
  `KUBECONFIG`, proxy variables, …).

This happens before the first connection attempt, so the first exec plugin run
already sees the merged environment. In most setups this alone makes terminal-only
kubeconfigs work from the Dock with no configuration.

## Layer 2: credential providers (aws-vault)

If your cluster needs an `aws-vault` profile's credentials specifically, map the
context to a profile:

1. Open the **Connections** screen → **Credential helpers** section.
2. Find your context. Klustr preselects a likely profile from the kubeconfig
   exec block's `--profile` / `AWS_PROFILE` hint.
3. Pick the aws-vault profile to use and save the mapping.

On connect, Klustr runs `aws-vault export --format=json <profile>` (you may see the
macOS Keychain prompt the first time) and injects the captured keys into the exec
plugin's environment — so `aws eks get-token` behaves exactly as it would under
`aws-vault exec <profile> -- ...`.

### What's stored where

- **Secrets** live in memory only. They are never written to disk and never logged.
- The on-disk store (under your user config directory) holds the **provider and
  profile names only** — never credential values.

### Refresh and expiry

Klustr re-captures credentials about five minutes before they expire and rebuilds
the context's clients automatically (the exec authenticator snapshots its
environment, so a refresh needs fresh clients). If a refresh fails, you'll get an
error toast with a **Retry** action.

## Troubleshooting

- **Still can't authenticate from the Dock, but it works from a terminal.** Confirm
  the helper binary is on the `PATH` your login shell exports (Layer 1 uses
  `$SHELL -ilc`). If you keep tools in a non-standard directory, make sure your
  shell rc adds it to `PATH`.
- **Keychain prompt keeps appearing.** That's aws-vault unlocking its backend; it's
  expected on first capture and after the backend locks.
- **Wrong profile picked.** Re-open Connections → Credential helpers and change the
  mapping; the kubeconfig hint is only a default.

Other providers (granted, saml2aws, …) can slot in beside aws-vault in the future —
the provider interface is generic.
