package kube

import (
	"time"
)

type WebhookSummary struct {
	Name        string   `json:"name"`
	ClientCfg   string   `json:"clientCfg"`
	FailPolicy  string   `json:"failPolicy"`
	SideEffects string   `json:"sideEffects"`
	Operations  []string `json:"operations"`
	Resources   []string `json:"resources"`
}

type WebhookConfigurationDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Webhooks    []WebhookSummary  `json:"webhooks"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

func (w *contextWatcher) ValidatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	f := w.factoryFor("ValidatingWebhookConfiguration")
	if f == nil {
		return nil, errKindNoAccess("ValidatingWebhookConfiguration")
	}
	c, err := f.Admissionregistration().V1().ValidatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		summary := WebhookSummary{Name: h.Name}
		if h.ClientConfig.Service != nil {
			summary.ClientCfg = h.ClientConfig.Service.Namespace + "/" + h.ClientConfig.Service.Name
		} else if h.ClientConfig.URL != nil {
			summary.ClientCfg = *h.ClientConfig.URL
		}
		if h.FailurePolicy != nil {
			summary.FailPolicy = string(*h.FailurePolicy)
		}
		if h.SideEffects != nil {
			summary.SideEffects = string(*h.SideEffects)
		}
		seenOps := map[string]struct{}{}
		seenRes := map[string]struct{}{}
		for _, r := range h.Rules {
			for _, op := range r.Operations {
				if _, ok := seenOps[string(op)]; !ok {
					seenOps[string(op)] = struct{}{}
					summary.Operations = append(summary.Operations, string(op))
				}
			}
			for _, rs := range r.Resources {
				if _, ok := seenRes[rs]; !ok {
					seenRes[rs] = struct{}{}
					summary.Resources = append(summary.Resources, rs)
				}
			}
		}
		whs = append(whs, summary)
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) MutatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	f := w.factoryFor("MutatingWebhookConfiguration")
	if f == nil {
		return nil, errKindNoAccess("MutatingWebhookConfiguration")
	}
	c, err := f.Admissionregistration().V1().MutatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		summary := WebhookSummary{Name: h.Name}
		if h.ClientConfig.Service != nil {
			summary.ClientCfg = h.ClientConfig.Service.Namespace + "/" + h.ClientConfig.Service.Name
		} else if h.ClientConfig.URL != nil {
			summary.ClientCfg = *h.ClientConfig.URL
		}
		if h.FailurePolicy != nil {
			summary.FailPolicy = string(*h.FailurePolicy)
		}
		if h.SideEffects != nil {
			summary.SideEffects = string(*h.SideEffects)
		}
		seenOps := map[string]struct{}{}
		seenRes := map[string]struct{}{}
		for _, r := range h.Rules {
			for _, op := range r.Operations {
				if _, ok := seenOps[string(op)]; !ok {
					seenOps[string(op)] = struct{}{}
					summary.Operations = append(summary.Operations, string(op))
				}
			}
			for _, rs := range r.Resources {
				if _, ok := seenRes[rs]; !ok {
					seenRes[rs] = struct{}{}
					summary.Resources = append(summary.Resources, rs)
				}
			}
		}
		whs = append(whs, summary)
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
