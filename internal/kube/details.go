package kube

import (
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// nestedSliceNoCopy / nestedMapNoCopy are unstructured.NestedSlice / NestedMap
// without the sub-tree deep copy, for the per-row integration extractors. The
// result aliases obj, so it is read-only. A wrong-typed field reads as
// not-found and error is always nil.
func nestedSliceNoCopy(obj map[string]any, fields ...string) ([]any, bool, error) {
	v, found, err := unstructured.NestedFieldNoCopy(obj, fields...)
	if err != nil || !found {
		return nil, false, err
	}
	s, ok := v.([]any)
	if !ok {
		return nil, false, nil
	}
	return s, true, nil
}

func nestedMapNoCopy(obj map[string]any, fields ...string) (map[string]any, bool, error) {
	v, found, err := unstructured.NestedFieldNoCopy(obj, fields...)
	if err != nil || !found {
		return nil, false, err
	}
	m, ok := v.(map[string]any)
	if !ok {
		return nil, false, nil
	}
	return m, true, nil
}

// ContainerSummary is the per-container shape rendered in workload detail
// dialogs. It is shared by every workload kind (Deployment, StatefulSet,
// ReplicaSet, DaemonSet, Job, CronJob, ReplicationController) so it lives
// here rather than in any single details_<kind>.go file.
type ContainerSummary struct {
	Name     string   `json:"name"`
	Image    string   `json:"image"`
	Ports    []string `json:"ports"`
	Command  []string `json:"command"`
	Args     []string `json:"args"`
	EnvCount int      `json:"envCount"`
}

func containerSummaries(specs []corev1.Container) []ContainerSummary {
	out := make([]ContainerSummary, 0, len(specs))
	for _, c := range specs {
		ports := make([]string, 0, len(c.Ports))
		for _, p := range c.Ports {
			proto := string(p.Protocol)
			if proto == "" {
				proto = "TCP"
			}
			ports = append(ports, fmt.Sprintf("%d/%s", p.ContainerPort, proto))
		}
		out = append(out, ContainerSummary{
			Name:     c.Name,
			Image:    c.Image,
			Ports:    ports,
			Command:  append([]string{}, c.Command...),
			Args:     append([]string{}, c.Args...),
			EnvCount: len(c.Env) + len(c.EnvFrom),
		})
	}
	return out
}

func matchLabels(sel *metav1.LabelSelector) map[string]string {
	if sel == nil {
		return nil
	}
	if len(sel.MatchExpressions) == 0 {
		return sel.MatchLabels
	}
	// Fold matchExpressions in as readable chips (value empty so Chips renders
	// the whole expression) — a selector using only expressions would otherwise
	// show as empty, claiming the workload selects nothing.
	out := make(map[string]string, len(sel.MatchLabels)+len(sel.MatchExpressions))
	for k, v := range sel.MatchLabels {
		out[k] = v
	}
	for _, m := range sel.MatchExpressions {
		op := strings.ToLower(string(m.Operator))
		if len(m.Values) > 0 {
			out[fmt.Sprintf("%s %s (%s)", m.Key, op, strings.Join(m.Values, ", "))] = ""
		} else {
			out[fmt.Sprintf("%s %s", m.Key, op)] = ""
		}
	}
	return out
}

func deploymentConditions(conds []appsv1.DeploymentCondition) []ConditionDetail {
	out := make([]ConditionDetail, 0, len(conds))
	for _, c := range conds {
		out = append(out, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return out
}

func nodeConditions(conds []corev1.NodeCondition) []ConditionDetail {
	out := make([]ConditionDetail, 0, len(conds))
	for _, c := range conds {
		out = append(out, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return out
}

func quantitiesToStrings(m corev1.ResourceList) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[string(k)] = v.String()
	}
	return out
}
