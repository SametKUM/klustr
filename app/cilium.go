package app

import "klustr/internal/kube"

func (a *App) ListCiliumResources(contextName, resource, namespace string) []kube.CiliumResourceInfo {
	return a.clients.ListCiliumResources(contextName, resource, namespace)
}

func (a *App) GetCiliumResource(contextName, resource, namespace, name string) (*kube.CiliumResourceDetail, error) {
	return a.clients.GetCiliumResource(a.ctx, contextName, resource, namespace, name)
}
