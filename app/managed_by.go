package app

import "klustr/internal/kube"

func (a *App) GetResourceManagers(contextName, kind, namespace, name string) ([]kube.ResourceManager, error) {
	return a.clients.GetResourceManagers(a.ctx, contextName, kind, namespace, name)
}
