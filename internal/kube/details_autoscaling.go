package kube

import (
	"time"
)

type PodDisruptionBudgetDetail struct {
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	UID                string            `json:"uid"`
	MinAvailable       string            `json:"minAvailable"`
	MaxUnavailable     string            `json:"maxUnavailable"`
	Selector           string            `json:"selector"`
	CurrentHealthy     int32             `json:"currentHealthy"`
	DesiredHealthy     int32             `json:"desiredHealthy"`
	ExpectedPods       int32             `json:"expectedPods"`
	DisruptionsAllowed int32             `json:"disruptionsAllowed"`
	Conditions         []ConditionDetail `json:"conditions"`
	Labels             map[string]string `json:"labels"`
	Annotations        map[string]string `json:"annotations"`
	CreatedAt          string            `json:"createdAt"`
}

type HorizontalPodAutoscalerDetail struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	UID             string            `json:"uid"`
	Reference       string            `json:"reference"`
	MinReplicas     int32             `json:"minReplicas"`
	MaxReplicas     int32             `json:"maxReplicas"`
	CurrentReplicas int32             `json:"currentReplicas"`
	DesiredReplicas int32             `json:"desiredReplicas"`
	Metrics         []HPAMetricTarget `json:"metrics"`
	Conditions      []ConditionDetail `json:"conditions"`
	Labels          map[string]string `json:"labels"`
	Annotations     map[string]string `json:"annotations"`
	CreatedAt       string            `json:"createdAt"`
}

func (w *contextWatcher) PodDisruptionBudget(namespace, name string) (*PodDisruptionBudgetDetail, error) {
	p, err := w.factory.Policy().V1().PodDisruptionBudgets().Lister().PodDisruptionBudgets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	minAvail := ""
	if p.Spec.MinAvailable != nil {
		minAvail = p.Spec.MinAvailable.String()
	}
	maxUnavail := ""
	if p.Spec.MaxUnavailable != nil {
		maxUnavail = p.Spec.MaxUnavailable.String()
	}
	conds := make([]ConditionDetail, 0, len(p.Status.Conditions))
	for _, c := range p.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    c.Type,
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &PodDisruptionBudgetDetail{
		Name:               p.Name,
		Namespace:          p.Namespace,
		UID:                string(p.UID),
		MinAvailable:       minAvail,
		MaxUnavailable:     maxUnavail,
		Selector:           formatLabelSelector(p.Spec.Selector),
		CurrentHealthy:     p.Status.CurrentHealthy,
		DesiredHealthy:     p.Status.DesiredHealthy,
		ExpectedPods:       p.Status.ExpectedPods,
		DisruptionsAllowed: p.Status.DisruptionsAllowed,
		Conditions:         conds,
		Labels:             p.Labels,
		Annotations:        p.Annotations,
		CreatedAt:          p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) HorizontalPodAutoscaler(namespace, name string) (*HorizontalPodAutoscalerDetail, error) {
	h, err := w.factory.Autoscaling().V2().HorizontalPodAutoscalers().Lister().HorizontalPodAutoscalers(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	var minR int32 = 1
	if h.Spec.MinReplicas != nil {
		minR = *h.Spec.MinReplicas
	}
	metrics := hpaMetricTargets(h)
	conds := make([]ConditionDetail, 0, len(h.Status.Conditions))
	for _, c := range h.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &HorizontalPodAutoscalerDetail{
		Name:            h.Name,
		Namespace:       h.Namespace,
		UID:             string(h.UID),
		Reference:       h.Spec.ScaleTargetRef.Kind + "/" + h.Spec.ScaleTargetRef.Name,
		MinReplicas:     minR,
		MaxReplicas:     h.Spec.MaxReplicas,
		CurrentReplicas: h.Status.CurrentReplicas,
		DesiredReplicas: h.Status.DesiredReplicas,
		Metrics:         metrics,
		Conditions:      conds,
		Labels:          h.Labels,
		Annotations:     h.Annotations,
		CreatedAt:       h.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
