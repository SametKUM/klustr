package kube

import (
	"time"

	rbacv1 "k8s.io/api/rbac/v1"
)

type ObjectRefDetail struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

type ServiceAccountDetail struct {
	Name                         string            `json:"name"`
	Namespace                    string            `json:"namespace"`
	UID                          string            `json:"uid"`
	AutomountServiceAccountToken string            `json:"automountServiceAccountToken"`
	Secrets                      []ObjectRefDetail `json:"secrets"`
	ImagePullSecrets             []ObjectRefDetail `json:"imagePullSecrets"`
	Labels                       map[string]string `json:"labels"`
	Annotations                  map[string]string `json:"annotations"`
	CreatedAt                    string            `json:"createdAt"`
}

type PolicyRuleDetail struct {
	Verbs           []string `json:"verbs"`
	APIGroups       []string `json:"apiGroups"`
	Resources       []string `json:"resources"`
	ResourceNames   []string `json:"resourceNames"`
	NonResourceURLs []string `json:"nonResourceURLs"`
}

type RoleDetail struct {
	Name        string             `json:"name"`
	Namespace   string             `json:"namespace"`
	UID         string             `json:"uid"`
	Rules       []PolicyRuleDetail `json:"rules"`
	Labels      map[string]string  `json:"labels"`
	Annotations map[string]string  `json:"annotations"`
	CreatedAt   string             `json:"createdAt"`
}

type SubjectDetail struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	APIGroup  string `json:"apiGroup"`
}

type RoleRefDetail struct {
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	APIGroup string `json:"apiGroup"`
}

type RoleBindingDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	RoleRef     RoleRefDetail     `json:"roleRef"`
	Subjects    []SubjectDetail   `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ClusterRoleDetail struct {
	Name             string             `json:"name"`
	UID              string             `json:"uid"`
	Rules            []PolicyRuleDetail `json:"rules"`
	AggregationLabel map[string]string  `json:"aggregationLabel"`
	Labels           map[string]string  `json:"labels"`
	Annotations      map[string]string  `json:"annotations"`
	CreatedAt        string             `json:"createdAt"`
}

type ClusterRoleBindingDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	RoleRef     RoleRefDetail     `json:"roleRef"`
	Subjects    []SubjectDetail   `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

func (w *contextWatcher) ServiceAccount(namespace, name string) (*ServiceAccountDetail, error) {
	s, err := w.factory.Core().V1().ServiceAccounts().Lister().ServiceAccounts(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	secrets := make([]ObjectRefDetail, 0, len(s.Secrets))
	for _, r := range s.Secrets {
		secrets = append(secrets, ObjectRefDetail{Kind: "Secret", Namespace: r.Namespace, Name: r.Name})
	}
	pulls := make([]ObjectRefDetail, 0, len(s.ImagePullSecrets))
	for _, r := range s.ImagePullSecrets {
		pulls = append(pulls, ObjectRefDetail{Kind: "Secret", Namespace: s.Namespace, Name: r.Name})
	}
	automount := ""
	if s.AutomountServiceAccountToken != nil {
		if *s.AutomountServiceAccountToken {
			automount = "true"
		} else {
			automount = "false"
		}
	}
	return &ServiceAccountDetail{
		Name:                         s.Name,
		Namespace:                    s.Namespace,
		UID:                          string(s.UID),
		AutomountServiceAccountToken: automount,
		Secrets:                      secrets,
		ImagePullSecrets:             pulls,
		Labels:                       s.Labels,
		Annotations:                  s.Annotations,
		CreatedAt:                    s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Role(namespace, name string) (*RoleDetail, error) {
	r, err := w.factory.Rbac().V1().Roles().Lister().Roles(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &RoleDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Rules:       policyRules(r.Rules),
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) RoleBinding(namespace, name string) (*RoleBindingDetail, error) {
	b, err := w.factory.Rbac().V1().RoleBindings().Lister().RoleBindings(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &RoleBindingDetail{
		Name:      b.Name,
		Namespace: b.Namespace,
		UID:       string(b.UID),
		RoleRef: RoleRefDetail{
			Kind:     b.RoleRef.Kind,
			Name:     b.RoleRef.Name,
			APIGroup: b.RoleRef.APIGroup,
		},
		Subjects:    rbacSubjects(b.Subjects),
		Labels:      b.Labels,
		Annotations: b.Annotations,
		CreatedAt:   b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ClusterRole(name string) (*ClusterRoleDetail, error) {
	r, err := w.factory.Rbac().V1().ClusterRoles().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	var aggLabel map[string]string
	if r.AggregationRule != nil && len(r.AggregationRule.ClusterRoleSelectors) > 0 {
		merged := map[string]string{}
		for _, sel := range r.AggregationRule.ClusterRoleSelectors {
			for k, v := range sel.MatchLabels {
				merged[k] = v
			}
		}
		if len(merged) > 0 {
			aggLabel = merged
		}
	}
	return &ClusterRoleDetail{
		Name:             r.Name,
		UID:              string(r.UID),
		Rules:            policyRules(r.Rules),
		AggregationLabel: aggLabel,
		Labels:           r.Labels,
		Annotations:      r.Annotations,
		CreatedAt:        r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ClusterRoleBinding(name string) (*ClusterRoleBindingDetail, error) {
	b, err := w.factory.Rbac().V1().ClusterRoleBindings().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &ClusterRoleBindingDetail{
		Name: b.Name,
		UID:  string(b.UID),
		RoleRef: RoleRefDetail{
			Kind:     b.RoleRef.Kind,
			Name:     b.RoleRef.Name,
			APIGroup: b.RoleRef.APIGroup,
		},
		Subjects:    rbacSubjects(b.Subjects),
		Labels:      b.Labels,
		Annotations: b.Annotations,
		CreatedAt:   b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func policyRules(rules []rbacv1.PolicyRule) []PolicyRuleDetail {
	out := make([]PolicyRuleDetail, 0, len(rules))
	for _, r := range rules {
		out = append(out, PolicyRuleDetail{
			Verbs:           append([]string{}, r.Verbs...),
			APIGroups:       append([]string{}, r.APIGroups...),
			Resources:       append([]string{}, r.Resources...),
			ResourceNames:   append([]string{}, r.ResourceNames...),
			NonResourceURLs: append([]string{}, r.NonResourceURLs...),
		})
	}
	return out
}

func rbacSubjects(subjects []rbacv1.Subject) []SubjectDetail {
	out := make([]SubjectDetail, 0, len(subjects))
	for _, s := range subjects {
		out = append(out, SubjectDetail{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
			APIGroup:  s.APIGroup,
		})
	}
	return out
}
