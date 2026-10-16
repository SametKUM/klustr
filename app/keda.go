package app

import "klustr/internal/kube"

func (a *App) ListKEDAScaledObjects(contextName, namespace string) []kube.KEDAScaledObjectInfo {
	return a.clients.ListKEDAScaledObjects(contextName, namespace)
}

func (a *App) GetKEDAScaledObject(contextName, namespace, name string) (*kube.KEDAScaledObjectDetail, error) {
	return a.clients.GetKEDAScaledObject(a.ctx, contextName, namespace, name)
}

func (a *App) ListKEDAScaledJobs(contextName, namespace string) []kube.KEDAScaledJobInfo {
	return a.clients.ListKEDAScaledJobs(contextName, namespace)
}

func (a *App) GetKEDAScaledJob(contextName, namespace, name string) (*kube.KEDAScaledJobDetail, error) {
	return a.clients.GetKEDAScaledJob(a.ctx, contextName, namespace, name)
}

func (a *App) ListKEDAScaledJobJobs(contextName, namespace, name string) []kube.JobInfo {
	return a.clients.ListKEDAScaledJobJobs(contextName, namespace, name)
}

func (a *App) ListKEDATriggerAuthentications(contextName, namespace string) []kube.KEDATriggerAuthenticationInfo {
	return a.clients.ListKEDATriggerAuthentications(contextName, namespace)
}

func (a *App) GetKEDATriggerAuthentication(contextName, namespace, name string) (*kube.KEDATriggerAuthenticationDetail, error) {
	return a.clients.GetKEDATriggerAuthentication(a.ctx, contextName, namespace, name)
}

func (a *App) ListKEDAClusterTriggerAuthentications(contextName string) []kube.KEDATriggerAuthenticationInfo {
	return a.clients.ListKEDAClusterTriggerAuthentications(contextName)
}

func (a *App) GetKEDAClusterTriggerAuthentication(contextName, name string) (*kube.KEDATriggerAuthenticationDetail, error) {
	return a.clients.GetKEDAClusterTriggerAuthentication(a.ctx, contextName, name)
}

func (a *App) PauseKEDAScaledObject(contextName, namespace, name string, replicas int32) error {
	return a.clients.PauseKEDAScaledObject(a.ctx, contextName, namespace, name, replicas)
}

func (a *App) ResumeKEDAScaledObject(contextName, namespace, name string) error {
	return a.clients.ResumeKEDAScaledObject(a.ctx, contextName, namespace, name)
}

func (a *App) SetKEDAScaledJobPaused(contextName, namespace, name string, paused bool) error {
	return a.clients.SetKEDAScaledJobPaused(a.ctx, contextName, namespace, name, paused)
}
