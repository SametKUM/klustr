package app

import "klustr/internal/kube"

func (a *App) ListKyvernoMutatingPolicies(contextName string) []kube.KyvernoMutatingPolicyInfo {
	return a.clients.ListKyvernoMutatingPolicies(contextName)
}

func (a *App) ListKyvernoNamespacedMutatingPolicies(contextName, namespace string) []kube.KyvernoMutatingPolicyInfo {
	return a.clients.ListKyvernoNamespacedMutatingPolicies(contextName, namespace)
}

func (a *App) GetKyvernoMutatingPolicy(contextName, name string) (*kube.KyvernoMutatingPolicyDetail, error) {
	return a.clients.GetKyvernoMutatingPolicy(a.ctx, contextName, name)
}

func (a *App) GetKyvernoNamespacedMutatingPolicy(contextName, namespace, name string) (*kube.KyvernoMutatingPolicyDetail, error) {
	return a.clients.GetKyvernoNamespacedMutatingPolicy(a.ctx, contextName, namespace, name)
}

func (a *App) ListKyvernoGeneratingPolicies(contextName string) []kube.KyvernoGeneratingPolicyInfo {
	return a.clients.ListKyvernoGeneratingPolicies(contextName)
}

func (a *App) ListKyvernoNamespacedGeneratingPolicies(contextName, namespace string) []kube.KyvernoGeneratingPolicyInfo {
	return a.clients.ListKyvernoNamespacedGeneratingPolicies(contextName, namespace)
}

func (a *App) GetKyvernoGeneratingPolicy(contextName, name string) (*kube.KyvernoGeneratingPolicyDetail, error) {
	return a.clients.GetKyvernoGeneratingPolicy(a.ctx, contextName, name)
}

func (a *App) GetKyvernoNamespacedGeneratingPolicy(contextName, namespace, name string) (*kube.KyvernoGeneratingPolicyDetail, error) {
	return a.clients.GetKyvernoNamespacedGeneratingPolicy(a.ctx, contextName, namespace, name)
}

func (a *App) ListKyvernoDeletingPolicies(contextName string) []kube.KyvernoDeletingPolicyInfo {
	return a.clients.ListKyvernoDeletingPolicies(contextName)
}

func (a *App) ListKyvernoNamespacedDeletingPolicies(contextName, namespace string) []kube.KyvernoDeletingPolicyInfo {
	return a.clients.ListKyvernoNamespacedDeletingPolicies(contextName, namespace)
}

func (a *App) GetKyvernoDeletingPolicy(contextName, name string) (*kube.KyvernoDeletingPolicyDetail, error) {
	return a.clients.GetKyvernoDeletingPolicy(a.ctx, contextName, name)
}

func (a *App) GetKyvernoNamespacedDeletingPolicy(contextName, namespace, name string) (*kube.KyvernoDeletingPolicyDetail, error) {
	return a.clients.GetKyvernoNamespacedDeletingPolicy(a.ctx, contextName, namespace, name)
}

func (a *App) ListKyvernoImageValidatingPolicies(contextName string) []kube.KyvernoImageValidatingPolicyInfo {
	return a.clients.ListKyvernoImageValidatingPolicies(contextName)
}

func (a *App) ListKyvernoNamespacedImageValidatingPolicies(contextName, namespace string) []kube.KyvernoImageValidatingPolicyInfo {
	return a.clients.ListKyvernoNamespacedImageValidatingPolicies(contextName, namespace)
}

func (a *App) GetKyvernoImageValidatingPolicy(contextName, name string) (*kube.KyvernoImageValidatingPolicyDetail, error) {
	return a.clients.GetKyvernoImageValidatingPolicy(a.ctx, contextName, name)
}

func (a *App) GetKyvernoNamespacedImageValidatingPolicy(contextName, namespace, name string) (*kube.KyvernoImageValidatingPolicyDetail, error) {
	return a.clients.GetKyvernoNamespacedImageValidatingPolicy(a.ctx, contextName, namespace, name)
}
