package kube

import (
	"context"
	"fmt"
)

func (m *ClientManager) HelmReleases(contextName, namespace string) ([]HelmReleaseInfo, error) {
	if w, ok := m.watcher(contextName); ok {
		return listAcrossNamespacesErr(namespace, w.HelmReleases)
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return listAcrossNamespacesErr(namespace, func(ns string) ([]HelmReleaseInfo, error) {
		return m.helm.ListReleases(contextName, ns)
	})
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
	if err := m.assertWritable(opts.ContextName); err != nil {
		return nil, err
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Install(ctx, opts)
}

func (m *ClientManager) HelmUpgrade(ctx context.Context, opts HelmInstallOptions) (*HelmDryRunResult, error) {
	if err := m.assertWritable(opts.ContextName); err != nil {
		return nil, err
	}
	if m.helm == nil {
		return nil, fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Upgrade(ctx, opts)
}

func (m *ClientManager) HelmRollback(ctx context.Context, contextName, namespace, name string, revision int, wait bool) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Rollback(ctx, contextName, namespace, name, revision, wait)
}

func (m *ClientManager) HelmUninstall(ctx context.Context, contextName, namespace, name string, keepHistory bool) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	if m.helm == nil {
		return fmt.Errorf("helm subsystem unavailable")
	}
	return m.helm.Uninstall(ctx, contextName, namespace, name, keepHistory)
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
