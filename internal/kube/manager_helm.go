package kube

import (
	"context"
	"fmt"
)

func (m *ClientManager) HelmReleases(contextName, namespace string) ([]HelmReleaseInfo, error) {
	if w, ok := m.watcher(contextName); ok {
		return w.HelmReleases(namespace)
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.ListReleases(contextName, namespace)
}

func (m *ClientManager) HelmReleaseHistory(contextName, namespace, name string) ([]HelmRevisionInfo, error) {
	if w, ok := m.watcher(contextName); ok {
		return w.HelmReleaseRevisions(namespace, name)
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.ListReleaseRevisions(contextName, namespace, name)
}

func (m *ClientManager) HelmRelease(contextName, namespace, name string) (*HelmReleaseDetail, error) {
	if w, ok := m.watcher(contextName); ok {
		return w.HelmRelease(namespace, name)
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.GetRelease(contextName, namespace, name)
}

func (m *ClientManager) HelmInstall(ctx context.Context, opts HelmInstallOptions) (*HelmDryRunResult, error) {
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Install(ctx, opts)
}

func (m *ClientManager) HelmUpgrade(ctx context.Context, opts HelmInstallOptions) (*HelmDryRunResult, error) {
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Upgrade(ctx, opts)
}

func (m *ClientManager) HelmRollback(contextName, namespace, name string, revision int, wait bool) error {
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Rollback(contextName, namespace, name, revision, wait)
}

func (m *ClientManager) HelmUninstall(contextName, namespace, name string, keepHistory bool) error {
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Uninstall(contextName, namespace, name, keepHistory)
}

func (m *ClientManager) HelmRepos() ([]HelmRepoInfo, error) {
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.ListRepos()
}

func (m *ClientManager) HelmAddRepo(name, url string) error {
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.AddRepo(name, url)
}

func (m *ClientManager) HelmRemoveRepo(name string) error {
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.RemoveRepo(name)
}

func (m *ClientManager) HelmUpdateRepos() error {
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.UpdateRepos()
}

func (m *ClientManager) HelmSearchCharts(query string) ([]HelmChartSearchResult, error) {
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.SearchCharts(query)
}

func (m *ClientManager) HelmChartVersions(repoName, chartName string) ([]string, error) {
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.ChartVersions(repoName, chartName)
}
