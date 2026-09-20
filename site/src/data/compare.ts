export type ToolId = 'klustr' | 'lens' | 'k9s' | 'headlamp' | 'dashboard'

export type Tool = {
  id: ToolId
  name: string
  url: string
  summary: string
}

export type Tone = 'yes' | 'no' | 'mid'

export type Cell = {
  text: string
  tone?: Tone
  sub?: string
}

export type Row = {
  label: string
  cells: Record<ToolId, Cell>
}

export const REVIEWED_ON = '2026-09-20'

export const TOOLS: Record<ToolId, Tool> = {
  klustr: {
    id: 'klustr',
    name: 'Klustr',
    url: 'https://klustr.dev/',
    summary:
      'Free, MIT-licensed desktop client for macOS and Linux. Reads your kubeconfig, installs nothing in the cluster, and treats Helm, Argo CD, Flux, Gateway API and cert-manager as first-class.',
  },
  lens: {
    id: 'lens',
    name: 'Lens',
    url: 'https://k8slens.dev/',
    summary:
      'The best-known Kubernetes IDE. Electron, cross-platform, with an extension marketplace, team features and paid plans. Activation needs a Lens ID.',
  },
  k9s: {
    id: 'k9s',
    name: 'k9s',
    url: 'https://k9scli.io/',
    summary:
      'Keyboard-driven terminal UI in Go. One context at a time, fast to navigate, extensible through plugins and hotkeys. Apache-2.0.',
  },
  headlamp: {
    id: 'headlamp',
    name: 'Headlamp',
    url: 'https://headlamp.dev/',
    summary:
      'Kubernetes SIG UI project with a plugin system. Runs as an Electron desktop app or is deployed into the cluster as a web UI. Apache-2.0.',
  },
  dashboard: {
    id: 'dashboard',
    name: 'Kubernetes Dashboard',
    url: 'https://github.com/kubernetes/dashboard',
    summary:
      'The project’s general-purpose web UI. Deployed into the cluster with a Helm chart and reached through a proxy or ingress with a bearer token. Apache-2.0.',
  },
}

export const ROWS: Row[] = [
  {
    label: 'License and price',
    cells: {
      klustr: { text: 'MIT, free', tone: 'yes' },
      lens: { text: 'Proprietary', tone: 'mid', sub: 'Free Personal plan with eligibility limits, paid plans beyond' },
      k9s: { text: 'Apache-2.0, free', tone: 'yes' },
      headlamp: { text: 'Apache-2.0, free', tone: 'yes' },
      dashboard: { text: 'Apache-2.0, free', tone: 'yes' },
    },
  },
  {
    label: 'Runtime',
    cells: {
      klustr: { text: 'Go + OS webview', sub: 'Wails, no bundled browser' },
      lens: { text: 'Electron', sub: 'Bundled Chromium and Node.js' },
      k9s: { text: 'Go terminal UI' },
      headlamp: { text: 'Electron or in-cluster web', sub: 'Go backend, React frontend' },
      dashboard: { text: 'Web app in the cluster' },
    },
  },
  {
    label: 'Installed in the cluster',
    cells: {
      klustr: { text: 'Nothing', tone: 'yes', sub: 'Optional one-click metrics-server, removable from Klustr' },
      lens: { text: 'Nothing required', tone: 'yes', sub: 'Optional metrics stack' },
      k9s: { text: 'Nothing', tone: 'yes' },
      headlamp: { text: 'Optional', tone: 'mid', sub: 'Desktop app runs locally; web mode is deployed in-cluster' },
      dashboard: { text: 'Required', tone: 'no', sub: 'Deployed with its Helm chart' },
    },
  },
  {
    label: 'Account or sign-in',
    cells: {
      klustr: { text: 'None', tone: 'yes', sub: 'Your kubeconfig is the only credential' },
      lens: { text: 'Lens ID required', tone: 'no', sub: 'Needed to activate the desktop app' },
      k9s: { text: 'None', tone: 'yes' },
      headlamp: { text: 'None on desktop', tone: 'yes', sub: 'Token or OIDC when deployed in-cluster' },
      dashboard: { text: 'Bearer token or kubeconfig', tone: 'mid' },
    },
  },
  {
    label: 'Several clusters at once',
    cells: {
      klustr: { text: 'Aggregated table', tone: 'yes', sub: 'Two or more contexts in one list, named groups, color tags' },
      lens: { text: 'One cluster per view', tone: 'mid', sub: 'Catalog and hotbar to switch' },
      k9s: { text: 'One context at a time', tone: 'no', sub: 'Switch with :ctx' },
      headlamp: { text: 'Multi-cluster view', tone: 'yes', sub: 'Select clusters and compare side by side' },
      dashboard: { text: 'The cluster it runs in', tone: 'no' },
    },
  },
  {
    label: 'RBAC',
    cells: {
      klustr: { text: 'Access Review matrix', tone: 'yes', sub: 'Subject to effective permissions with the binding chain' },
      lens: { text: 'Roles and bindings', tone: 'mid' },
      k9s: { text: 'RBAC and policy views', tone: 'yes', sub: 'Reverse lookup for a user, group or ServiceAccount' },
      headlamp: { text: 'Roles and bindings', tone: 'mid' },
      dashboard: { text: 'Roles and bindings', tone: 'mid' },
    },
  },
  {
    label: 'Helm',
    cells: {
      klustr: { text: 'Built in', tone: 'yes', sub: 'Install, upgrade, rollback, uninstall with a dry-run diff; repo search' },
      lens: { text: 'Built in', tone: 'yes', sub: 'Charts and releases' },
      k9s: { text: 'Release view', tone: 'mid', sub: 'List, describe, uninstall' },
      headlamp: { text: 'Via plugin', tone: 'mid', sub: 'App catalog plugin' },
      dashboard: { text: 'None', tone: 'no' },
    },
  },
  {
    label: 'Argo CD and Flux',
    cells: {
      klustr: { text: 'Built in, through the API', tone: 'yes', sub: 'Sync, refresh, reconcile, suspend; no CLIs' },
      lens: { text: 'Via extensions', tone: 'mid' },
      k9s: { text: 'Generic CRDs', tone: 'mid', sub: 'Community plugins add actions' },
      headlamp: { text: 'Flux via plugin', tone: 'mid' },
      dashboard: { text: 'Generic CRDs', tone: 'mid' },
    },
  },
  {
    label: 'Gateway API',
    cells: {
      klustr: { text: 'Typed views', tone: 'yes', sub: 'Listeners, rule matrix, RouteParentStatus' },
      lens: { text: 'Generic CRDs', tone: 'mid' },
      k9s: { text: 'Generic CRDs', tone: 'mid' },
      headlamp: { text: 'Built in', tone: 'yes', sub: 'Including TCPRoute and UDPRoute' },
      dashboard: { text: 'Generic CRDs', tone: 'mid' },
    },
  },
  {
    label: 'cert-manager',
    cells: {
      klustr: { text: 'Typed views', tone: 'yes', sub: 'Issuance chain and one-click renew' },
      lens: { text: 'Generic CRDs', tone: 'mid' },
      k9s: { text: 'Generic CRDs', tone: 'mid' },
      headlamp: { text: 'Generic CRDs', tone: 'mid' },
      dashboard: { text: 'Generic CRDs', tone: 'mid' },
    },
  },
  {
    label: 'Logs',
    cells: {
      klustr: { text: 'Multi-pod stream', tone: 'yes', sub: 'Per-pod colors, follow, regex, save' },
      lens: { text: 'Per container', tone: 'mid' },
      k9s: { text: 'Per pod or workload', tone: 'yes', sub: 'Aggregated for a deployment, filters' },
      headlamp: { text: 'Per container', tone: 'mid' },
      dashboard: { text: 'Per container', tone: 'mid' },
    },
  },
  {
    label: 'Shell access',
    cells: {
      klustr: { text: 'Exec, debug container, node shell', tone: 'yes' },
      lens: { text: 'Pod and node shell', tone: 'yes' },
      k9s: { text: 'Pod and node shell', tone: 'yes', sub: 'Node shell behind a feature gate' },
      headlamp: { text: 'Pod terminal', tone: 'yes' },
      dashboard: { text: 'Exec', tone: 'yes' },
    },
  },
  {
    label: 'Local terminal',
    cells: {
      klustr: { text: 'Drawer per context', tone: 'yes', sub: 'KUBECONFIG preset to the active context' },
      lens: { text: 'Built in', tone: 'yes' },
      k9s: { text: 'Is the terminal', tone: 'yes' },
      headlamp: { text: 'None', tone: 'no' },
      dashboard: { text: 'None', tone: 'no' },
    },
  },
  {
    label: 'Platforms',
    cells: {
      klustr: { text: 'macOS, Linux', sub: 'Windows from source' },
      lens: { text: 'macOS, Windows, Linux' },
      k9s: { text: 'macOS, Linux, Windows' },
      headlamp: { text: 'macOS, Windows, Linux, browser' },
      dashboard: { text: 'Browser' },
    },
  },
]

export type ComparePage = {
  slug: string
  tool: ToolId
  title: string
  heading: string
  description: string
  intro: string[]
  different: string[]
  stronger: string[]
  verdict: string
}

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: 'lens',
    tool: 'lens',
    title: 'Klustr vs Lens: an open-source Lens alternative that installs nothing',
    heading: 'Klustr vs Lens',
    description:
      'How Klustr compares with Lens Desktop: license and sign-in, Electron versus a native webview, several clusters at once, Helm, Argo CD and Flux, Gateway API and RBAC review.',
    intro: [
      'Lens is the best-known Kubernetes desktop IDE: a mature, cross-platform Electron app with an extension marketplace, team features and paid plans. Klustr is a smaller, MIT-licensed desktop client for macOS and Linux that trades the marketplace and the team layer for a direct workflow with no account: your kubeconfig, the Kubernetes API, and typed views for the platform tooling most clusters already run.',
      `Facts about Lens come from its public documentation and were reviewed on ${REVIEWED_ON}. If something is out of date, [open an issue](https://github.com/SametKUM/klustr/issues) and it will be corrected.`,
    ],
    different: [
      '**No sign-in.** Lens Desktop needs a Lens ID to activate, and the free Personal plan is limited to education and to companies under a revenue threshold. Klustr has no account, no activation and no plan tiers. It is MIT-licensed and free for any use.',
      '**Nothing installed in the cluster.** Both tools read your kubeconfig. Klustr never asks to deploy anything either; the single opt-in exception is a one-click metrics-server install that Klustr can also remove.',
      '**Several clusters in one table.** Lens shows one cluster per view. Klustr drives two or more contexts as one virtual cluster with a Context column, named groups and color tags, so a fleet or a prod-versus-staging comparison is one screen.',
      '**GitOps and platform tooling without CLIs or extensions.** Argo CD, Flux, Gateway API, cert-manager, Istio, Karpenter and KEDA get typed views out of the box, driven through the Kubernetes API. In Lens these areas are covered by extensions.',
      '**Access Review.** Klustr answers “what can this ServiceAccount do in this namespace?” with a live permission matrix and the binding and role chain behind every entry. Lens lists roles and bindings.',
      '**Native webview instead of Electron.** Klustr is a Go binary that renders through the operating system’s webview via Wails, so there is no bundled Chromium. The macOS archive is about 22 MB.',
    ],
    stronger: [
      '**Windows builds.** Lens ships Windows installers. Klustr builds from source on Windows until its release path is validated.',
      '**Extension marketplace.** Lens has a large extension ecosystem. Klustr has no plugin system; its integrations are built in.',
      '**Team and cloud features.** Lens offers shared catalogs, cloud-connected clusters and enterprise SSO. Klustr is a single-user desktop client.',
      '**Metrics dashboards.** Lens can install and read a Prometheus stack. Klustr reads metrics-server for CPU and memory and does not chart Prometheus.',
    ],
    verdict:
      'Pick Lens if you need Windows builds, an extension marketplace or team features. Pick Klustr if you want a free, open-source client with no account that treats Helm, GitOps and Gateway API as first-class and can show several clusters at once.',
  },
  {
    slug: 'k9s',
    tool: 'k9s',
    title: 'Klustr vs k9s: a desktop companion to the terminal UI',
    heading: 'Klustr vs k9s',
    description:
      'Where a desktop client adds to k9s and where the terminal UI stays ahead: several clusters at once, typed GitOps and Gateway API views, diffs, RBAC review and keyboard speed.',
    intro: [
      'k9s is the terminal UI many operators live in: fast, keyboard-driven, free under Apache-2.0 and extensible through plugins and hotkeys. Klustr is not trying to replace it. It is a desktop client for the parts of cluster work that benefit from a second dimension: many clusters at once, status tables you can scan, diffs, and drill-downs across resource kinds.',
      `Facts about k9s come from its README and documentation and were reviewed on ${REVIEWED_ON}. Corrections are welcome as [an issue](https://github.com/SametKUM/klustr/issues).`,
    ],
    different: [
      '**Several contexts in one table.** k9s works in one context and switches with `:ctx`. Klustr aggregates two or more contexts into one list with a Context column, saved groups and a color stripe that tells you which environment you are touching.',
      '**Typed views for platform tooling.** Argo CD Applications, Flux reconcilers, Gateway API routes and cert-manager chains render as tables with status pills and actions. In k9s they are generic custom resources, with community plugins adding some actions.',
      '**Diffs before changes.** Helm upgrades show a dry-run diff, YAML edits show a server-side dry-run diff, and rollout history shows a side-by-side template diff before you roll back.',
      '**Access Review.** k9s can reverse-look-up what a subject may do. Klustr renders the answer as a resource-by-verb matrix with the binding and role behind every cell, live across every active context.',
      '**k9s stays one keystroke away.** The built-in terminal drawer opens a local shell with KUBECONFIG already set to the active context, so `k9s`, `kubectl` and `stern` run against the right cluster without any setup.',
    ],
    stronger: [
      '**Keyboard speed.** For an operator who knows the shortcuts, nothing beats k9s for moving through a single cluster.',
      '**Works over SSH.** k9s runs anywhere a terminal does, including a bastion host. Klustr is a desktop app.',
      '**Plugins and hotkeys.** k9s is scriptable: custom commands, plugins and skins with a small config file.',
      '**Windows and footprint.** k9s ships Windows builds and is a single small binary.',
    ],
    verdict:
      'Keep k9s for fast single-cluster navigation and remote sessions. Add Klustr when you need several clusters in one view, typed GitOps and Gateway API status, or a diff before you change something.',
  },
  {
    slug: 'headlamp',
    tool: 'headlamp',
    title: 'Klustr vs Headlamp: desktop client or in-cluster dashboard',
    heading: 'Klustr vs Headlamp',
    description:
      'Two open-source Kubernetes UIs compared: Headlamp’s plugin system and in-cluster mode against Klustr’s pure-client design, built-in Helm and GitOps, cert-manager views and RBAC review.',
    intro: [
      'Headlamp is a Kubernetes SIG UI project with a plugin system, an in-cluster deployment mode and desktop builds. It is a natural comparison: both tools are open source, both read your kubeconfig, both support several clusters and both render Gateway API resources.',
      `Facts about Headlamp come from its documentation and release notes and were reviewed on ${REVIEWED_ON}. Corrections are welcome as [an issue](https://github.com/SametKUM/klustr/issues).`,
    ],
    different: [
      '**Never runs in the cluster.** Headlamp can be deployed as an in-cluster web UI or run as a desktop app. Klustr only runs on your machine and installs nothing in the cluster; there is no deployment to expose, upgrade or secure.',
      '**Helm, Argo CD and Flux are built in.** Headlamp covers Helm and Flux through plugins. Klustr ships Helm v3 with a dry-run diff, Argo CD sync and refresh, and Flux reconcile and suspend without plugins or CLIs.',
      '**cert-manager, Istio, Karpenter and KEDA.** Klustr promotes these CRD families to typed views with status and actions, including the full certificate issuance chain and one-click renew.',
      '**Access Review.** Headlamp lists roles and bindings. Klustr computes a subject’s effective permissions as a matrix with the binding chain behind every entry.',
      '**Aggregated rows, not side-by-side panes.** Both tools support several clusters. Headlamp compares clusters side by side; Klustr merges them into one table with a Context column so a fleet reads as one cluster.',
      '**Operations from the desktop.** A local terminal drawer bound to the active context, a root node shell, cordon and PDB-aware drain, and ephemeral debug containers for shell-less images.',
    ],
    stronger: [
      '**In-cluster mode for a team.** Deploy Headlamp once with OIDC and every teammate gets a browser UI without installing anything locally.',
      '**Plugin ecosystem and resource map.** Headlamp has a documented plugin API and a resource relationship map.',
      '**Windows and browser.** Headlamp ships Windows builds and runs in a browser. Klustr builds from source on Windows.',
      '**CNCF governance.** Headlamp is a Kubernetes SIG UI project with community governance. Klustr is a single-maintainer open-source project.',
    ],
    verdict:
      'Pick Headlamp for a shared, in-cluster web UI or if you want to write plugins. Pick Klustr for a desktop client that installs nothing, treats Helm, GitOps and cert-manager as first-class and can show several clusters as one.',
  },
  {
    slug: 'kubernetes-dashboard',
    tool: 'dashboard',
    title: 'Klustr vs Kubernetes Dashboard: a desktop alternative to the in-cluster UI',
    heading: 'Klustr vs Kubernetes Dashboard',
    description:
      'Why a desktop client can replace the in-cluster Kubernetes Dashboard for day-to-day work: nothing to deploy or expose, every cluster in one app, Helm, GitOps, Gateway API and RBAC review.',
    intro: [
      'Kubernetes Dashboard is the project’s general-purpose web UI. It is deployed into the cluster with a Helm chart, reached through a proxy or an ingress, and signed into with a bearer token or kubeconfig. Klustr is the opposite shape: a desktop app on your machine that installs nothing in the cluster and sees every cluster your kubeconfig knows about.',
      `Facts about Kubernetes Dashboard come from its repository and documentation and were reviewed on ${REVIEWED_ON}. Corrections are welcome as [an issue](https://github.com/SametKUM/klustr/issues).`,
    ],
    different: [
      '**Nothing to deploy, expose or upgrade.** The Dashboard is a workload you run, secure and keep current in every cluster. Klustr is a binary on your laptop that talks to the API the way kubectl does.',
      '**Every cluster, and several at once.** The Dashboard shows the cluster it is installed in. Klustr lists every kubeconfig context and can aggregate two or more into one table.',
      '**Helm, Argo CD, Flux, Gateway API and cert-manager.** The Dashboard has no Helm support and renders custom resources generically. Klustr ships typed views and actions for all of them.',
      '**Access Review.** The Dashboard lists roles and bindings. Klustr shows a subject’s effective permissions as a matrix with the binding chain.',
      '**Operations.** Multi-pod log streaming, exec and ephemeral debug containers, a root node shell, cordon and drain, a local terminal drawer, YAML edits with a dry-run diff and one-click rollout rollback.',
    ],
    stronger: [
      '**Browser only.** Teammates reach the Dashboard with a URL and a token; nobody installs anything locally.',
      '**Part of the Kubernetes project.** The Dashboard is maintained under the Kubernetes organisation.',
      '**Any operating system.** A browser is the only requirement. Klustr ships for macOS and Linux and builds from source on Windows.',
    ],
    verdict:
      'Keep the Dashboard if you need a browser UI for people who cannot install a desktop app. Use Klustr if you operate clusters from your own machine and want Helm, GitOps, Gateway API and several clusters in one window with nothing deployed.',
  },
]

export function comparePage(slug: string): ComparePage {
  const page = COMPARE_PAGES.find((p) => p.slug === slug)
  if (!page) throw new Error(`unknown compare page "${slug}"`)
  return page
}
