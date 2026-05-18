package kube

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/registry"
	"helm.sh/helm/v3/pkg/release"
	"helm.sh/helm/v3/pkg/repo"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"sigs.k8s.io/yaml"
)

// HelmReleaseInfo is the list-row shape: one row per release, latest revision.
type HelmReleaseInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Revision    int    `json:"revision"`
	Status      string `json:"status"`
	Chart       string `json:"chart"`
	ChartName   string `json:"chartName"`
	ChartVer    string `json:"chartVersion"`
	AppVersion  string `json:"appVersion"`
	Updated     string `json:"updated"`
	Description string `json:"description"`
}

// HelmRevisionInfo describes one entry in a release's history.
type HelmRevisionInfo struct {
	Revision    int    `json:"revision"`
	Status      string `json:"status"`
	Updated     string `json:"updated"`
	Chart       string `json:"chart"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
}

// HelmReleaseDetail carries everything the detail UI needs for one release.
type HelmReleaseDetail struct {
	Info         HelmReleaseInfo    `json:"info"`
	Notes        string             `json:"notes"`
	Manifest     string             `json:"manifest"`
	UserValues   string             `json:"userValues"`
	MergedValues string             `json:"mergedValues"`
	ChartName    string             `json:"chartName"`
	ChartVersion string             `json:"chartVersion"`
	AppVersion   string             `json:"appVersion"`
	Revisions    []HelmRevisionInfo `json:"revisions"`
}

// HelmRepoInfo describes a registered chart repository.
type HelmRepoInfo struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// HelmChartSearchResult is one entry in a chart-search response.
type HelmChartSearchResult struct {
	Repo        string `json:"repo"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
}

// HelmInstallOptions captures the user-controllable knobs for install/upgrade.
type HelmInstallOptions struct {
	ContextName    string `json:"contextName"`
	Namespace      string `json:"namespace"`
	ReleaseName    string `json:"releaseName"`
	ChartRef       string `json:"chartRef"`
	ChartVersion   string `json:"chartVersion"`
	Values         string `json:"values"`
	CreateNS       bool   `json:"createNamespace"`
	Wait           bool   `json:"wait"`
	Atomic         bool   `json:"atomic"`
	TimeoutSeconds int    `json:"timeoutSeconds"`
	DryRun         bool   `json:"dryRun"`
	ResetValues    bool   `json:"resetValues"`
}

// HelmDryRunResult is what the UI shows when the user asks for a preview.
type HelmDryRunResult struct {
	Manifest string `json:"manifest"`
	Notes    string `json:"notes"`
}

// helmManager owns Helm SDK configuration and per-(context,namespace) caches.
type helmManager struct {
	settings *cli.EnvSettings

	mu      sync.Mutex
	configs map[string]*action.Configuration
	rules   *clientcmd.ClientConfigLoadingRules
}

func newHelmManager(rules *clientcmd.ClientConfigLoadingRules) (*helmManager, error) {
	// Inherit helm CLI's repo config + cache paths (cli.New() honors HELM_* env
	// vars and falls back to helm's platform defaults). Sharing the paths means
	// repositories added via `helm repo add` are immediately usable inside
	// Klustr and vice versa.
	settings := cli.New()
	if err := os.MkdirAll(filepath.Dir(settings.RepositoryConfig), 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(settings.RepositoryCache, 0o755); err != nil {
		return nil, err
	}

	return &helmManager{
		settings: settings,
		configs:  map[string]*action.Configuration{},
		rules:    rules,
	}, nil
}

// configFor returns an action.Configuration scoped to the given context and
// namespace, lazily initializing and caching it.
func (h *helmManager) configFor(contextName, namespace string) (*action.Configuration, error) {
	key := contextName + "/" + namespace
	h.mu.Lock()
	cfg, ok := h.configs[key]
	h.mu.Unlock()
	if ok {
		return cfg, nil
	}

	getter := &restClientGetter{rules: h.rules, contextName: contextName, namespace: namespace}
	c := &action.Configuration{}
	if err := c.Init(getter, namespace, "secret", func(format string, v ...interface{}) {}); err != nil {
		return nil, err
	}
	rc, err := registry.NewClient(
		registry.ClientOptDebug(false),
		registry.ClientOptEnableCache(true),
		registry.ClientOptCredentialsFile(h.settings.RegistryConfig),
	)
	if err == nil {
		c.RegistryClient = rc
	}

	h.mu.Lock()
	h.configs[key] = c
	h.mu.Unlock()
	return c, nil
}

// restClientGetter wires Helm's SDK into our kubeconfig context.
type restClientGetter struct {
	rules       *clientcmd.ClientConfigLoadingRules
	contextName string
	namespace   string
}

func (g *restClientGetter) ToRawKubeConfigLoader() clientcmd.ClientConfig {
	overrides := &clientcmd.ConfigOverrides{
		CurrentContext: g.contextName,
		Context:        clientcmdapi.Context{Namespace: g.namespace},
	}
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(g.rules, overrides)
}

func (g *restClientGetter) ToRESTConfig() (*rest.Config, error) {
	return g.ToRawKubeConfigLoader().ClientConfig()
}

func (g *restClientGetter) ToDiscoveryClient() (discovery.CachedDiscoveryInterface, error) {
	cfg, err := g.ToRESTConfig()
	if err != nil {
		return nil, err
	}
	dc, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return memory.NewMemCacheClient(dc), nil
}

func (g *restClientGetter) ToRESTMapper() (meta.RESTMapper, error) {
	dc, err := g.ToDiscoveryClient()
	if err != nil {
		return nil, err
	}
	return restmapper.NewDeferredDiscoveryRESTMapper(dc), nil
}

// --- read paths ---------------------------------------------------------

// ListReleases returns the latest revision of each release, optionally
// filtered to a single namespace. Empty namespace lists across the cluster.
func (h *helmManager) ListReleases(contextName, namespace string) ([]HelmReleaseInfo, error) {
	cfg, err := h.configFor(contextName, namespace)
	if err != nil {
		return nil, err
	}
	list := action.NewList(cfg)
	list.All = false
	list.AllNamespaces = namespace == ""
	list.SetStateMask()
	releases, err := list.Run()
	if err != nil {
		return nil, err
	}
	out := make([]HelmReleaseInfo, 0, len(releases))
	for _, r := range releases {
		out = append(out, releaseInfoFromRelease(r))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// ListReleaseRevisions returns the full revision history for one release.
func (h *helmManager) ListReleaseRevisions(contextName, namespace, name string) ([]HelmRevisionInfo, error) {
	cfg, err := h.configFor(contextName, namespace)
	if err != nil {
		return nil, err
	}
	hist := action.NewHistory(cfg)
	rev, err := hist.Run(name)
	if err != nil {
		return nil, err
	}
	out := make([]HelmRevisionInfo, 0, len(rev))
	for _, r := range rev {
		out = append(out, revisionInfoFromRelease(r))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Revision > out[j].Revision })
	return out, nil
}

// GetRelease fetches a single release at its latest revision plus its history.
func (h *helmManager) GetRelease(contextName, namespace, name string) (*HelmReleaseDetail, error) {
	cfg, err := h.configFor(contextName, namespace)
	if err != nil {
		return nil, err
	}
	get := action.NewGet(cfg)
	rel, err := get.Run(name)
	if err != nil {
		return nil, err
	}
	userVals, err := marshalValues(rel.Config)
	if err != nil {
		return nil, err
	}
	var chartDefaults map[string]any
	if rel.Chart != nil {
		chartDefaults = rel.Chart.Values
	}
	mergedVals, err := marshalValues(chartDefaults)
	if err != nil {
		return nil, err
	}
	revs, err := h.ListReleaseRevisions(contextName, namespace, name)
	if err != nil {
		revs = []HelmRevisionInfo{}
	}
	notes := ""
	if rel.Info != nil {
		notes = rel.Info.Notes
	}
	chartName := ""
	chartVer := ""
	appVer := ""
	if rel.Chart != nil && rel.Chart.Metadata != nil {
		chartName = rel.Chart.Metadata.Name
		chartVer = rel.Chart.Metadata.Version
		appVer = rel.Chart.Metadata.AppVersion
	}
	return &HelmReleaseDetail{
		Info:         releaseInfoFromRelease(rel),
		Notes:        notes,
		Manifest:     rel.Manifest,
		UserValues:   userVals,
		MergedValues: mergedVals,
		ChartName:    chartName,
		ChartVersion: chartVer,
		AppVersion:   appVer,
		Revisions:    revs,
	}, nil
}

// marshalValues serialises a values map to YAML, returning "" for nil/empty so
// the UI editor doesn't get filled with the literal "null".
func marshalValues(v map[string]any) (string, error) {
	if len(v) == 0 {
		return "", nil
	}
	b, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// --- lifecycle ----------------------------------------------------------

// Install renders, optionally dry-runs, and installs a chart.
func (h *helmManager) Install(ctx context.Context, opts HelmInstallOptions) (*HelmDryRunResult, error) {
	cfg, err := h.configFor(opts.ContextName, opts.Namespace)
	if err != nil {
		return nil, err
	}
	inst := action.NewInstall(cfg)
	inst.Namespace = opts.Namespace
	inst.ReleaseName = opts.ReleaseName
	inst.CreateNamespace = opts.CreateNS
	inst.Version = opts.ChartVersion
	inst.Wait = opts.Wait
	inst.Atomic = opts.Atomic
	inst.DryRun = opts.DryRun
	if inst.DryRun {
		inst.ClientOnly = false
	}
	inst.Timeout = resolveHelmTimeout(opts.TimeoutSeconds, inst.Wait || inst.Atomic)

	chartRef, err := h.resolveChartRef(opts.ChartRef)
	if err != nil {
		return nil, err
	}
	chartPath, err := inst.LocateChart(chartRef, h.settings)
	if err != nil {
		return nil, err
	}
	ch, err := loader.Load(chartPath)
	if err != nil {
		return nil, err
	}
	if err := validateChartInstallable(ch); err != nil {
		return nil, err
	}

	vals, err := parseValues(opts.Values)
	if err != nil {
		return nil, err
	}

	rel, err := inst.RunWithContext(ctx, ch, vals)
	if err != nil {
		return nil, err
	}
	if opts.DryRun {
		return &HelmDryRunResult{Manifest: rel.Manifest, Notes: notesFrom(rel)}, nil
	}
	return nil, nil
}

// Upgrade upgrades an existing release; behaves like Install when the chart
// pulls in new values.
func (h *helmManager) Upgrade(ctx context.Context, opts HelmInstallOptions) (*HelmDryRunResult, error) {
	cfg, err := h.configFor(opts.ContextName, opts.Namespace)
	if err != nil {
		return nil, err
	}
	up := action.NewUpgrade(cfg)
	up.Namespace = opts.Namespace
	up.Version = opts.ChartVersion
	up.Wait = opts.Wait
	up.Atomic = opts.Atomic
	up.DryRun = opts.DryRun
	up.ResetValues = opts.ResetValues
	up.Timeout = resolveHelmTimeout(opts.TimeoutSeconds, up.Wait || up.Atomic)

	chartRef, err := h.resolveChartRef(opts.ChartRef)
	if err != nil {
		return nil, err
	}
	chartPath, err := up.LocateChart(chartRef, h.settings)
	if err != nil {
		return nil, err
	}
	ch, err := loader.Load(chartPath)
	if err != nil {
		return nil, err
	}
	vals, err := parseValues(opts.Values)
	if err != nil {
		return nil, err
	}
	rel, err := up.RunWithContext(ctx, opts.ReleaseName, ch, vals)
	if err != nil {
		return nil, err
	}
	if opts.DryRun {
		return &HelmDryRunResult{Manifest: rel.Manifest, Notes: notesFrom(rel)}, nil
	}
	return nil, nil
}

// Rollback restores a previous revision.
func (h *helmManager) Rollback(contextName, namespace, name string, revision int, wait bool) error {
	cfg, err := h.configFor(contextName, namespace)
	if err != nil {
		return err
	}
	rb := action.NewRollback(cfg)
	rb.Version = revision
	rb.Wait = wait
	rb.Timeout = resolveHelmTimeout(0, wait)
	return rb.Run(name)
}

// Uninstall deletes a release; keepHistory preserves the release history.
func (h *helmManager) Uninstall(contextName, namespace, name string, keepHistory bool) error {
	cfg, err := h.configFor(contextName, namespace)
	if err != nil {
		return err
	}
	un := action.NewUninstall(cfg)
	un.KeepHistory = keepHistory
	_, err = un.Run(name)
	return err
}

// --- repos + search -----------------------------------------------------

// ListRepos returns the locally configured chart repositories.
func (h *helmManager) ListRepos() ([]HelmRepoInfo, error) {
	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil {
		return nil, err
	}
	out := make([]HelmRepoInfo, 0, len(file.Repositories))
	for _, r := range file.Repositories {
		out = append(out, HelmRepoInfo{Name: r.Name, URL: r.URL})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// AddRepo registers a new repo and downloads its index.
func (h *helmManager) AddRepo(name, url string) error {
	if name == "" || url == "" {
		return fmt.Errorf("name and url are required")
	}
	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil {
		return err
	}
	if file.Has(name) {
		return fmt.Errorf("repository %q already exists", name)
	}
	entry := &repo.Entry{Name: name, URL: url}
	cr, err := repo.NewChartRepository(entry, getter.All(h.settings))
	if err != nil {
		return err
	}
	cr.CachePath = h.settings.RepositoryCache
	if _, err := cr.DownloadIndexFile(); err != nil {
		return fmt.Errorf("download index: %w", err)
	}
	file.Update(entry)
	return file.WriteFile(h.settings.RepositoryConfig, 0o644)
}

// RemoveRepo drops the repo from the local config and deletes its cache.
func (h *helmManager) RemoveRepo(name string) error {
	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil {
		return err
	}
	if !file.Remove(name) {
		return fmt.Errorf("repository %q not found", name)
	}
	if err := file.WriteFile(h.settings.RepositoryConfig, 0o644); err != nil {
		return err
	}
	// Best-effort cache cleanup; ignore missing files.
	for _, suffix := range []string{"-index.yaml", "-charts.txt"} {
		_ = os.Remove(filepath.Join(h.settings.RepositoryCache, name+suffix))
	}
	return nil
}

// UpdateRepos refreshes the index of every configured repo.
func (h *helmManager) UpdateRepos() error {
	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil {
		return err
	}
	var lastErr error
	for _, r := range file.Repositories {
		cr, err := repo.NewChartRepository(r, getter.All(h.settings))
		if err != nil {
			lastErr = err
			continue
		}
		cr.CachePath = h.settings.RepositoryCache
		if _, err := cr.DownloadIndexFile(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// SearchCharts does a case-insensitive substring search across cached repo
// indexes. Empty query matches every chart.
func (h *helmManager) SearchCharts(query string) ([]HelmChartSearchResult, error) {
	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil {
		return nil, err
	}
	needle := strings.ToLower(query)
	out := []HelmChartSearchResult{}
	for _, r := range file.Repositories {
		idxPath := filepath.Join(h.settings.RepositoryCache, r.Name+"-index.yaml")
		idx, err := repo.LoadIndexFile(idxPath)
		if err != nil {
			continue
		}
		for chartName, versions := range idx.Entries {
			if len(versions) == 0 {
				continue
			}
			latest := versions[0]
			if needle != "" && !chartMatches(needle, r.Name, chartName, latest) {
				continue
			}
			out = append(out, HelmChartSearchResult{
				Repo:        r.Name,
				Name:        chartName,
				Version:     latest.Version,
				AppVersion:  latest.AppVersion,
				Description: latest.Description,
			})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Repo != out[j].Repo {
			return out[i].Repo < out[j].Repo
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// ChartVersions lists every version available for a given repo/chart.
func (h *helmManager) ChartVersions(repoName, chartName string) ([]string, error) {
	idxPath := filepath.Join(h.settings.RepositoryCache, repoName+"-index.yaml")
	idx, err := repo.LoadIndexFile(idxPath)
	if err != nil {
		return nil, err
	}
	versions, ok := idx.Entries[chartName]
	if !ok {
		return nil, fmt.Errorf("chart %q not found in repo %q", chartName, repoName)
	}
	out := make([]string, 0, len(versions))
	for _, v := range versions {
		out = append(out, v.Version)
	}
	return out, nil
}

// resolveChartRef accepts a user-typed chart reference and, if it is a bare
// chart name (no slash, scheme, or filesystem path), tries to disambiguate it
// to <repo>/<chart> by scanning every configured repo's cached index. This
// matters because Helm releases only store the chart name, not the originating
// repo — so a one-click "Upgrade" with a pre-filled chart name has no chance of
// working without this lookup.
func (h *helmManager) resolveChartRef(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", fmt.Errorf("chart reference is required")
	}
	if strings.Contains(ref, "/") || strings.Contains(ref, "://") ||
		strings.HasPrefix(ref, ".") || strings.HasPrefix(ref, string(filepath.Separator)) {
		return ref, nil
	}

	file, err := loadRepoFile(h.settings.RepositoryConfig)
	if err != nil || len(file.Repositories) == 0 {
		return "", fmt.Errorf("chart %q has no repo prefix and no Helm repositories are configured in Klustr — add one under Helm → Repositories (or use the form repo_name/chart)", ref)
	}
	matches := make([]string, 0, 2)
	for _, r := range file.Repositories {
		idxPath := filepath.Join(h.settings.RepositoryCache, r.Name+"-index.yaml")
		idx, err := repo.LoadIndexFile(idxPath)
		if err != nil {
			continue
		}
		if _, ok := idx.Entries[ref]; ok {
			matches = append(matches, r.Name)
		}
	}
	switch len(matches) {
	case 0:
		return "", fmt.Errorf("chart %q not found in any configured repo; add the chart's repo under Helm → Repositories or use the form repo_name/chart", ref)
	case 1:
		return matches[0] + "/" + ref, nil
	default:
		return "", fmt.Errorf("chart %q is provided by multiple repos (%s); prefix with the repo name", ref, strings.Join(matches, ", "))
	}
}

// resolveHelmTimeout mirrors helm CLI's behaviour: when --wait or --atomic is
// set and no explicit --timeout is provided, helm defaults to 5 minutes. The
// SDK does *not* apply this default — passing Timeout=0 to KubeClient.Wait
// produces an already-expired deadline and fails with "context deadline
// exceeded" instantly. We have to fill it in ourselves.
func resolveHelmTimeout(seconds int, requireWait bool) time.Duration {
	if seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	if requireWait {
		return 5 * time.Minute
	}
	return 0
}

// --- helpers ------------------------------------------------------------

func loadRepoFile(path string) (*repo.File, error) {
	f, err := repo.LoadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return repo.NewFile(), nil
		}
		// repo.LoadFile wraps os errors; treat empty file as fresh.
		if strings.Contains(err.Error(), "no such file") {
			return repo.NewFile(), nil
		}
		return nil, err
	}
	return f, nil
}

func chartMatches(needle, repoName, chartName string, v *repo.ChartVersion) bool {
	if strings.Contains(strings.ToLower(chartName), needle) {
		return true
	}
	if strings.Contains(strings.ToLower(repoName), needle) {
		return true
	}
	if strings.Contains(strings.ToLower(v.Description), needle) {
		return true
	}
	for _, kw := range v.Keywords {
		if strings.Contains(strings.ToLower(kw), needle) {
			return true
		}
	}
	return false
}

func validateChartInstallable(ch *chart.Chart) error {
	switch ch.Metadata.Type {
	case "", "application":
		return nil
	}
	return fmt.Errorf("chart %q is type %q (only application charts are installable)", ch.Name(), ch.Metadata.Type)
}

func parseValues(raw string) (map[string]any, error) {
	out := map[string]any{}
	if strings.TrimSpace(raw) == "" {
		return out, nil
	}
	if err := yaml.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("invalid values YAML: %w", err)
	}
	return out, nil
}

func releaseInfoFromRelease(r *release.Release) HelmReleaseInfo {
	chartName := ""
	chartVer := ""
	appVer := ""
	if r.Chart != nil && r.Chart.Metadata != nil {
		chartName = r.Chart.Metadata.Name
		chartVer = r.Chart.Metadata.Version
		appVer = r.Chart.Metadata.AppVersion
	}
	status := ""
	updated := ""
	desc := ""
	if r.Info != nil {
		status = r.Info.Status.String()
		if !r.Info.LastDeployed.IsZero() {
			updated = r.Info.LastDeployed.UTC().Format(time.RFC3339)
		}
		desc = r.Info.Description
	}
	return HelmReleaseInfo{
		Name:        r.Name,
		Namespace:   r.Namespace,
		Revision:    r.Version,
		Status:      status,
		Chart:       fmt.Sprintf("%s-%s", chartName, chartVer),
		ChartName:   chartName,
		ChartVer:    chartVer,
		AppVersion:  appVer,
		Updated:     updated,
		Description: desc,
	}
}

func revisionInfoFromRelease(r *release.Release) HelmRevisionInfo {
	chartName := ""
	chartVer := ""
	appVer := ""
	if r.Chart != nil && r.Chart.Metadata != nil {
		chartName = r.Chart.Metadata.Name
		chartVer = r.Chart.Metadata.Version
		appVer = r.Chart.Metadata.AppVersion
	}
	status := ""
	updated := ""
	desc := ""
	if r.Info != nil {
		status = r.Info.Status.String()
		if !r.Info.LastDeployed.IsZero() {
			updated = r.Info.LastDeployed.UTC().Format(time.RFC3339)
		}
		desc = r.Info.Description
	}
	return HelmRevisionInfo{
		Revision:    r.Version,
		Status:      status,
		Updated:     updated,
		Chart:       fmt.Sprintf("%s-%s", chartName, chartVer),
		AppVersion:  appVer,
		Description: desc,
	}
}

func notesFrom(r *release.Release) string {
	if r.Info == nil {
		return ""
	}
	return r.Info.Notes
}

// HelmChangeKind is the touch kind emitted whenever a Helm release storage
// Secret is added/updated/deleted in any watched namespace.
const HelmChangeKind = "HelmRelease"

func maybeTouchHelm(obj any, w *contextWatcher) {
	s, ok := obj.(*corev1.Secret)
	if !ok {
		return
	}
	if string(s.Type) != "helm.sh/release.v1" {
		return
	}
	w.touch(HelmChangeKind)
}

// IsHelmReleaseNotFound reports whether err is a "release not found" from Helm.
func IsHelmReleaseNotFound(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsNotFound(err) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "not found")
}

// ensure metav1 stays imported; we use it for any future direct k8s calls.
var _ = metav1.ListOptions{}

// ensure genericclioptions is referenced so future direct uses don't get
// silently dropped by goimports.
var _ genericclioptions.RESTClientGetter = (*restClientGetter)(nil)
