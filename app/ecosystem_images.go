package app

import "klustr/internal/kube"

func (a *App) ListFluxImageRepositories(contextName, namespace string) []kube.FluxImageRepositoryInfo {
	return a.clients.ListFluxImageRepositories(contextName, namespace)
}

func (a *App) GetFluxImageRepository(contextName, namespace, name string) (*kube.FluxImageRepositoryDetail, error) {
	return a.clients.GetFluxImageRepository(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxImagePolicies(contextName, namespace string) []kube.FluxImagePolicyInfo {
	return a.clients.ListFluxImagePolicies(contextName, namespace)
}

func (a *App) GetFluxImagePolicy(contextName, namespace, name string) (*kube.FluxImagePolicyDetail, error) {
	return a.clients.GetFluxImagePolicy(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxImageUpdateAutomations(contextName, namespace string) []kube.FluxImageUpdateAutomationInfo {
	return a.clients.ListFluxImageUpdateAutomations(contextName, namespace)
}

func (a *App) GetFluxImageUpdateAutomation(contextName, namespace, name string) (*kube.FluxImageUpdateAutomationDetail, error) {
	return a.clients.GetFluxImageUpdateAutomation(a.ctx, contextName, namespace, name)
}

func (a *App) ListKarpenterEC2NodeClasses(contextName string) []kube.KarpenterEC2NodeClassInfo {
	return a.clients.ListKarpenterEC2NodeClasses(contextName)
}

func (a *App) GetKarpenterEC2NodeClass(contextName, name string) (*kube.KarpenterEC2NodeClassDetail, error) {
	return a.clients.GetKarpenterEC2NodeClass(a.ctx, contextName, name)
}
