export type Faq = {
  id: string
  question: string
  answer: string
}

// Answers are markdown. The FAQ page renders them and also emits FAQPage
// structured data from the plain-text form, so keep each answer self-contained.
export const FAQ: Faq[] = [
  {
    id: 'installs-nothing',
    question: 'Does Klustr install anything in my cluster?',
    answer:
      'No. Klustr is a pure client: it reads `~/.kube/config` and talks to the API server the same way `kubectl` does. There is no agent, operator, CRD or sidecar. The one exception is the opt-in **Install metrics-server** action, which applies the upstream manifest and which Klustr can remove again by the label it stamps on those objects.',
  },
  {
    id: 'platforms',
    question: 'Which platforms does Klustr run on?',
    answer:
      'macOS on Apple Silicon, signed with a Developer ID certificate and notarized by Apple, so Gatekeeper opens it directly. Linux amd64 as a tarball, a `.deb` and the `klustr-bin` AUR package; the binary links against `webkit2gtk-4.1` and `gtk-3`, which Ubuntu 24.04+, Fedora 39+ and Arch ship by default (Ubuntu 22.04 needs `libwebkit2gtk-4.1-0 libgtk-3-0` first). Windows builds will be attached to releases once they have been validated; until then, build from source with `mise install` and `wails build`.',
  },
  {
    id: 'free',
    question: 'Is Klustr free? Is there a paid tier?',
    answer:
      'Klustr is free software under the MIT license. There is no account, no activation and no paid tier, and the full source is on [GitHub](https://github.com/SametKUM/klustr). Every release is built by CI from a tagged commit.',
  },
  {
    id: 'telemetry',
    question: 'Does Klustr send telemetry or phone home?',
    answer:
      'The app contains no analytics. The only network request that does not go to one of your clusters is an update check against GitHub Releases, which reports whether a newer version exists and never downloads or replaces the binary. Development builds skip that call entirely.',
  },
  {
    id: 'clis',
    question: 'Do I need the helm, argocd or flux CLIs installed?',
    answer:
      'No. Helm runs inside Klustr through the upstream Helm v3 library. Argo CD **Sync** is the same PATCH that `argocd app sync` sends and **Refresh** flips the refresh annotation; Flux **Reconcile** and **Suspend** set the standard Flux annotations. Nothing is shelled out. The only requirement is that your kubeconfig user is allowed to update those resources. See the [GitOps guide](/docs/gitops/) and the [Helm guide](/docs/helm/).',
  },
  {
    id: 'auth',
    question: 'How does authentication work? My kubeconfig uses aws-vault.',
    answer:
      'Klustr uses whatever your kubeconfig defines, including `exec` credential plugins. Because a Dock or Finder launch skips your shell startup files, Klustr first runs your login shell once and imports its `PATH` and an allowlist of variables, so `aws eks get-token` and friends are found. If a context needs a specific aws-vault profile, map it in **Connections → Credential helpers**; Klustr then runs `aws-vault export` on connect, keeps the keys in memory only and refreshes them about five minutes before they expire. Details are in the [credential helpers guide](/docs/credential-helpers/).',
  },
  {
    id: 'multi-cluster',
    question: 'Can I look at several clusters at once?',
    answer:
      'Yes. Check two or more contexts on the Connections screen and every list view fans out across them with a **Context** column. Save the selection as a named group for one-click reconnect, and tag contexts with colors so the top bar stripe tells you which environment you are touching. See [multi-context and aggregated mode](/docs/multi-context/).',
  },
  {
    id: 'read-only',
    question: 'What does read-only mode do?',
    answer:
      'Each context has a read-only switch. When it is on, every mutating action for that context is blocked: apply, delete, scale, restart, Helm install and upgrade, Argo CD sync, Flux reconcile, drain and the rest. Turn it on to browse a production cluster knowing no button can change anything.',
  },
  {
    id: 'empty-lists',
    question: 'Why is a resource list empty when I know objects exist?',
    answer:
      'On connect Klustr probes your access for every kind with SelfSubjectAccessReview. A kind you may list cluster-wide is watched cluster-wide; a kind you may only list in the namespace your kubeconfig context names is watched there; a kind you may not list at all shows an empty table instead of failing with 403s in the background. Check the namespace selector in the header and the RBAC granted to your user.',
  },
  {
    id: 'polling',
    question: 'Does Klustr poll the API server?',
    answer:
      'No. Resource lists are kept live by client-go informers, which use the watch API and push each change as it lands. Only `Namespace` and `Pod` informers start on connect; every other kind starts watching the first time you open it. The single exception is `metrics.k8s.io`, which has no watch, so CPU and memory usage is polled every 15 seconds and the columns are hidden when the API is not available.',
  },
  {
    id: 'crds',
    question: 'How are custom resources handled?',
    answer:
      'CRDs are discovered on connect and grouped in the sidebar by API group. Opening a kind lazily starts a watch for it, and a CRD installed while you are connected appears without a restart. The detail view shows YAML, and edit, delete and scale work through the dynamic client. Argo CD, Flux, Gateway API, cert-manager, Istio and Karpenter get typed views instead of the generic browser, and KEDA triggers are mapped onto the HPAs they drive. See [custom resources](/docs/custom-resources/) and [platform integrations](/docs/integrations/).',
  },
  {
    id: 'storage',
    question: 'Where does Klustr store its settings?',
    answer:
      'In your user configuration directory, for example `~/Library/Application Support/klustr` on macOS and the XDG equivalent on Linux. Helm repositories live in `helm-repos.json`, and the credential-helper store holds provider and profile names only, never credential values. Window, theme and table preferences are kept in the app’s local storage.',
  },
  {
    id: 'vs-lens',
    question: 'How is Klustr different from Lens?',
    answer:
      'Klustr is MIT-licensed, needs no account and installs nothing in the cluster, renders through the operating system’s webview instead of Electron, can show several clusters in one table, and ships typed views for Helm, Argo CD, Flux, Gateway API and cert-manager without extensions. Lens has Windows builds, an extension marketplace and team features. The [full comparison](/compare/lens/) goes row by row.',
  },
  {
    id: 'bugs',
    question: 'How do I report a bug or a security issue?',
    answer:
      'Bugs go through the [bug report template](https://github.com/SametKUM/klustr/issues/new?template=bug_report.yml), which asks for the version, OS and cluster details needed to reproduce. Security issues should be reported privately as described in the [security policy](https://github.com/SametKUM/klustr/blob/main/SECURITY.md), never in a public issue.',
  },
  {
    id: 'contribute',
    question: 'Can I contribute?',
    answer:
      'Yes. Read [CONTRIBUTING.md](https://github.com/SametKUM/klustr/blob/main/CONTRIBUTING.md) and the architecture notes in [CLAUDE.md](https://github.com/SametKUM/klustr/blob/main/CLAUDE.md) first, use Conventional Commits, and include a screenshot or short clip for user-facing changes. Bug reports and focused pull requests are both welcome.',
  },
]
