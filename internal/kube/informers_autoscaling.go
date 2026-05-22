package kube

import (
	"fmt"
	"strings"
	"time"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	policyv1 "k8s.io/api/policy/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type PodDisruptionBudgetInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	MinAvailable   string `json:"minAvailable"`
	MaxUnavailable string `json:"maxUnavailable"`
	CurrentHealthy int32  `json:"currentHealthy"`
	DesiredHealthy int32  `json:"desiredHealthy"`
	Allowed        int32  `json:"allowed"`
	CreatedAt      string `json:"createdAt"`
}

type HPAMetricTarget struct {
	Name    string `json:"name"`
	Current int32  `json:"current"`
	Target  int32  `json:"target"`
	Text    string `json:"text"`
}

type HorizontalPodAutoscalerInfo struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	Reference       string            `json:"reference"`
	MinReplicas     int32             `json:"minReplicas"`
	MaxReplicas     int32             `json:"maxReplicas"`
	CurrentReplicas int32             `json:"currentReplicas"`
	Metrics         []HPAMetricTarget `json:"metrics"`
	CreatedAt       string            `json:"createdAt"`
}

func (w *contextWatcher) PodDisruptionBudgets(namespace string) []PodDisruptionBudgetInfo {
	lister := w.factory.Policy().V1().PodDisruptionBudgets().Lister()
	var (
		pdbs []*policyv1.PodDisruptionBudget
		err  error
	)
	if namespace == "" {
		pdbs, err = lister.List(labels.Everything())
	} else {
		pdbs, err = lister.PodDisruptionBudgets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []PodDisruptionBudgetInfo{}
	}
	out := make([]PodDisruptionBudgetInfo, 0, len(pdbs))
	for _, p := range pdbs {
		minAvail := ""
		if p.Spec.MinAvailable != nil {
			minAvail = p.Spec.MinAvailable.String()
		}
		maxUnavail := ""
		if p.Spec.MaxUnavailable != nil {
			maxUnavail = p.Spec.MaxUnavailable.String()
		}
		out = append(out, PodDisruptionBudgetInfo{
			Name:           p.Name,
			Namespace:      p.Namespace,
			MinAvailable:   minAvail,
			MaxUnavailable: maxUnavail,
			CurrentHealthy: p.Status.CurrentHealthy,
			DesiredHealthy: p.Status.DesiredHealthy,
			Allowed:        p.Status.DisruptionsAllowed,
			CreatedAt:      p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) HorizontalPodAutoscalers(namespace string) []HorizontalPodAutoscalerInfo {
	lister := w.factory.Autoscaling().V2().HorizontalPodAutoscalers().Lister()
	var (
		hpas []*autoscalingv2.HorizontalPodAutoscaler
		err  error
	)
	if namespace == "" {
		hpas, err = lister.List(labels.Everything())
	} else {
		hpas, err = lister.HorizontalPodAutoscalers(namespace).List(labels.Everything())
	}
	if err != nil {
		return []HorizontalPodAutoscalerInfo{}
	}
	out := make([]HorizontalPodAutoscalerInfo, 0, len(hpas))
	for _, h := range hpas {
		var min int32 = 1
		if h.Spec.MinReplicas != nil {
			min = *h.Spec.MinReplicas
		}
		ref := h.Spec.ScaleTargetRef.Kind + "/" + h.Spec.ScaleTargetRef.Name
		out = append(out, HorizontalPodAutoscalerInfo{
			Name:            h.Name,
			Namespace:       h.Namespace,
			Reference:       ref,
			MinReplicas:     min,
			MaxReplicas:     h.Spec.MaxReplicas,
			CurrentReplicas: h.Status.CurrentReplicas,
			Metrics:         hpaMetricTargets(h),
			CreatedAt:       h.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

// hpaMetricTargets returns a structured per-metric current/target view.
// For Resource/Utilization metrics both Current and Target are populated
// as percentages, so the frontend can render a bar. Other metric kinds
// fall back to a human-readable Text field with Current == Target == -1.
func hpaMetricTargets(h *autoscalingv2.HorizontalPodAutoscaler) []HPAMetricTarget {
	out := make([]HPAMetricTarget, 0, len(h.Spec.Metrics))
	for _, spec := range h.Spec.Metrics {
		switch spec.Type {
		case autoscalingv2.ResourceMetricSourceType:
			if spec.Resource == nil {
				continue
			}
			name := string(spec.Resource.Name)
			cur := int32(-1)
			for _, st := range h.Status.CurrentMetrics {
				if st.Type != autoscalingv2.ResourceMetricSourceType || st.Resource == nil {
					continue
				}
				if string(st.Resource.Name) != name {
					continue
				}
				if st.Resource.Current.AverageUtilization != nil {
					cur = *st.Resource.Current.AverageUtilization
				}
				break
			}
			if spec.Resource.Target.Type == autoscalingv2.UtilizationMetricType && spec.Resource.Target.AverageUtilization != nil {
				out = append(out, HPAMetricTarget{
					Name:    name,
					Current: cur,
					Target:  *spec.Resource.Target.AverageUtilization,
				})
				continue
			}
			out = append(out, HPAMetricTarget{
				Name:    name,
				Current: -1,
				Target:  -1,
				Text:    fmt.Sprintf("%s: %s", name, hpaMetricTargetText(spec.Resource.Target)),
			})
		default:
			out = append(out, HPAMetricTarget{
				Name:    strings.ToLower(string(spec.Type)),
				Current: -1,
				Target:  -1,
				Text:    string(spec.Type),
			})
		}
	}
	return out
}

func hpaMetricTargetText(t autoscalingv2.MetricTarget) string {
	switch t.Type {
	case autoscalingv2.UtilizationMetricType:
		if t.AverageUtilization != nil {
			return fmt.Sprintf("%d%%", *t.AverageUtilization)
		}
	case autoscalingv2.AverageValueMetricType:
		if t.AverageValue != nil {
			return t.AverageValue.String()
		}
	case autoscalingv2.ValueMetricType:
		if t.Value != nil {
			return t.Value.String()
		}
	}
	return "?"
}
