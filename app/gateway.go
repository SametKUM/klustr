package app

import "klustr/internal/kube"

func (a *App) ListTLSRoutes(contextName, namespace string) []kube.TLSRouteInfo {
	return a.clients.TLSRoutes(contextName, namespace)
}

func (a *App) GetTLSRoute(contextName, namespace, name string) (*kube.TLSRouteDetail, error) {
	return a.clients.TLSRoute(contextName, namespace, name)
}

func (a *App) ListTCPRoutes(contextName, namespace string) []kube.TCPRouteInfo {
	return a.clients.TCPRoutes(contextName, namespace)
}

func (a *App) GetTCPRoute(contextName, namespace, name string) (*kube.TCPRouteDetail, error) {
	return a.clients.TCPRoute(contextName, namespace, name)
}

func (a *App) ListUDPRoutes(contextName, namespace string) []kube.UDPRouteInfo {
	return a.clients.UDPRoutes(contextName, namespace)
}

func (a *App) GetUDPRoute(contextName, namespace, name string) (*kube.UDPRouteDetail, error) {
	return a.clients.UDPRoute(contextName, namespace, name)
}

func (a *App) ListListenerSets(contextName, namespace string) []kube.ListenerSetInfo {
	return a.clients.ListenerSets(contextName, namespace)
}

func (a *App) GetListenerSet(contextName, namespace, name string) (*kube.ListenerSetDetail, error) {
	return a.clients.ListenerSet(contextName, namespace, name)
}

func (a *App) ListBackendTLSPolicies(contextName, namespace string) []kube.BackendTLSPolicyInfo {
	return a.clients.BackendTLSPolicies(contextName, namespace)
}

func (a *App) GetBackendTLSPolicy(contextName, namespace, name string) (*kube.BackendTLSPolicyDetail, error) {
	return a.clients.BackendTLSPolicy(contextName, namespace, name)
}
