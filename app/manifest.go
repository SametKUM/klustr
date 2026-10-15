package app

import "klustr/internal/kube"

func (a *App) GetManifestCatalog(contextName string) (*kube.ManifestCatalog, error) {
	return a.clients.ManifestCatalog(contextName)
}

func (a *App) GetManifestSchema(contextName, apiVersion string) (string, error) {
	return a.clients.ManifestSchema(a.ctx, contextName, apiVersion)
}

func (a *App) ReviewManifest(contextName, defaultNamespace, source string) (*kube.ManifestOperation, error) {
	return a.clients.ReviewManifest(a.ctx, contextName, defaultNamespace, source)
}

func (a *App) ReviewRemainingManifest(id string) (*kube.ManifestOperation, error) {
	return a.clients.ReviewRemainingManifest(a.ctx, id)
}

func (a *App) CreateManifest(id string) (*kube.ManifestOperation, error) {
	return a.clients.CreateManifest(a.ctx, id, func(operation kube.ManifestOperation) { emit(a.ctx, "manifest:progress", operation) })
}

func (a *App) GetManifestOperation(id string) (*kube.ManifestOperation, error) {
	return a.clients.GetManifestOperation(id)
}

func (a *App) GetManifestPreview(id string, index int, reveal bool) (*kube.ManifestPreview, error) {
	return a.clients.GetManifestPreview(id, index, reveal)
}

func (a *App) GetRemainingManifest(id string) (string, error) {
	return a.clients.GetRemainingManifest(id)
}

func (a *App) CancelManifest(id string) error { return a.clients.CancelManifest(id) }

func (a *App) ReleaseManifest(id string) error { return a.clients.ReleaseManifest(id) }
