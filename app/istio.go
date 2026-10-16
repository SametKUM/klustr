package app

import "klustr/internal/kube"

func (a *App) ListIstioGateways(contextName, namespace string) []kube.IstioGatewayInfo {
	return a.clients.ListIstioGateways(contextName, namespace)
}

func (a *App) GetIstioGateway(contextName, namespace, name string) (*kube.IstioGatewayDetail, error) {
	return a.clients.GetIstioGateway(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioServiceEntries(contextName, namespace string) []kube.IstioServiceEntryInfo {
	return a.clients.ListIstioServiceEntries(contextName, namespace)
}

func (a *App) GetIstioServiceEntry(contextName, namespace, name string) (*kube.IstioServiceEntryDetail, error) {
	return a.clients.GetIstioServiceEntry(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioSidecars(contextName, namespace string) []kube.IstioSidecarInfo {
	return a.clients.ListIstioSidecars(contextName, namespace)
}

func (a *App) GetIstioSidecar(contextName, namespace, name string) (*kube.IstioSidecarDetail, error) {
	return a.clients.GetIstioSidecar(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioAuthorizationPolicies(contextName, namespace string) []kube.IstioAuthorizationPolicyInfo {
	return a.clients.ListIstioAuthorizationPolicies(contextName, namespace)
}

func (a *App) GetIstioAuthorizationPolicy(contextName, namespace, name string) (*kube.IstioAuthorizationPolicyDetail, error) {
	return a.clients.GetIstioAuthorizationPolicy(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioRequestAuthentications(contextName, namespace string) []kube.IstioRequestAuthenticationInfo {
	return a.clients.ListIstioRequestAuthentications(contextName, namespace)
}

func (a *App) GetIstioRequestAuthentication(contextName, namespace, name string) (*kube.IstioRequestAuthenticationDetail, error) {
	return a.clients.GetIstioRequestAuthentication(a.ctx, contextName, namespace, name)
}
