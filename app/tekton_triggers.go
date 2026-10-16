package app

import "klustr/internal/kube"

func (a *App) ListTektonEventListeners(contextName, namespace string) []kube.TektonEventListenerInfo {
	return a.clients.ListTektonEventListeners(contextName, namespace)
}

func (a *App) GetTektonEventListener(contextName, namespace, name string) (*kube.TektonEventListenerDetail, error) {
	return a.clients.GetTektonEventListener(a.ctx, contextName, namespace, name)
}

func (a *App) ListTektonTriggers(contextName, namespace string) []kube.TektonTriggerInfo {
	return a.clients.ListTektonTriggers(contextName, namespace)
}

func (a *App) GetTektonTrigger(contextName, namespace, name string) (*kube.TektonTriggerDetail, error) {
	return a.clients.GetTektonTrigger(a.ctx, contextName, namespace, name)
}

func (a *App) ListTektonTriggerTemplates(contextName, namespace string) []kube.TektonTriggerTemplateInfo {
	return a.clients.ListTektonTriggerTemplates(contextName, namespace)
}

func (a *App) GetTektonTriggerTemplate(contextName, namespace, name string) (*kube.TektonTriggerTemplateDetail, error) {
	return a.clients.GetTektonTriggerTemplate(a.ctx, contextName, namespace, name)
}

func (a *App) ListTektonTriggerBindings(contextName, namespace string) []kube.TektonTriggerBindingInfo {
	return a.clients.ListTektonTriggerBindings(contextName, namespace)
}

func (a *App) GetTektonTriggerBinding(contextName, namespace, name string) (*kube.TektonTriggerBindingDetail, error) {
	return a.clients.GetTektonTriggerBinding(a.ctx, contextName, namespace, name)
}

func (a *App) ListTektonClusterTriggerBindings(contextName string) []kube.TektonTriggerBindingInfo {
	return a.clients.ListTektonClusterTriggerBindings(contextName)
}

func (a *App) GetTektonClusterTriggerBinding(contextName, name string) (*kube.TektonTriggerBindingDetail, error) {
	return a.clients.GetTektonClusterTriggerBinding(a.ctx, contextName, name)
}
