package kube

import (
	"sort"
	"time"

	"k8s.io/apimachinery/pkg/labels"
)

type WebhookConfigurationInfo struct {
	Name      string `json:"name"`
	Webhooks  int    `json:"webhooks"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) ValidatingWebhookConfigurations() []WebhookConfigurationInfo {
	whs, err := w.factory.Admissionregistration().V1().ValidatingWebhookConfigurations().Lister().List(labels.Everything())
	if err != nil {
		return []WebhookConfigurationInfo{}
	}
	out := make([]WebhookConfigurationInfo, 0, len(whs))
	for _, c := range whs {
		out = append(out, WebhookConfigurationInfo{
			Name:      c.Name,
			Webhooks:  len(c.Webhooks),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) MutatingWebhookConfigurations() []WebhookConfigurationInfo {
	whs, err := w.factory.Admissionregistration().V1().MutatingWebhookConfigurations().Lister().List(labels.Everything())
	if err != nil {
		return []WebhookConfigurationInfo{}
	}
	out := make([]WebhookConfigurationInfo, 0, len(whs))
	for _, c := range whs {
		out = append(out, WebhookConfigurationInfo{
			Name:      c.Name,
			Webhooks:  len(c.Webhooks),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
