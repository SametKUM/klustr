package app

import "klustr/internal/kube"

func (a *App) GetKarpenterDisruption(contextName, nodeName, nodeClaimName string) (*kube.KarpenterDisruption, error) {
	return a.clients.GetKarpenterDisruption(a.ctx, contextName, nodeName, nodeClaimName)
}
