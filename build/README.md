# Build directory

Build inputs for the desktop app, and the output directory `bin/`
(gitignored). `Taskfile.yml` at the repository root drives the builds:

```bash
wails3 dev                                   # development, with rebuilds
wails3 task build                            # release app for this OS into build/bin
wails3 task build KLUSTR_VERSION=v1.2.3      # stamped with a release version
```

- `config.yml`: the Wails v3 project config. `wails3 dev` reads `dev_mode`, and
  `tools/buildassets` renders the platform files below from `info`.
- `appicon.png` / `appicon.svg`: the app icon; the macOS build turns the PNG
  into the bundle's `iconfile.icns`.

## macOS (`darwin/`)

- `Info.plist`: a template that `tools/buildassets` renders with the version
  into `build/bin/klustr.app`. The bundle identifier stays `com.wails.klustr`:
  macOS keeps the webview's storage, and with it the app's settings, per
  identifier.
- `entitlements.plist`: the hardened-runtime entitlements the release workflow
  signs with.

## Windows (`windows/`)

- `icon.ico`: the exe icon.
- `info.json`, `wails.exe.manifest`: templates for the version resource and
  the manifest. `wails3 generate syso` compiles them with the icon into the
  syso that `go build` links into `klustr.exe`.

## Linux (`linux/`, `aur/`)

- `nfpm.yaml`: the `.deb` the release workflow builds with nfpm. It depends on
  WebKit2GTK 4.1 and GTK3, which the app builds against (the `gtk3` tag).
- `klustr.desktop`: the desktop entry the `.deb` installs.
- `aur/PKGBUILD.tmpl`: the `klustr-bin` AUR package that `publish-packages.yml`
  renders for each release.
