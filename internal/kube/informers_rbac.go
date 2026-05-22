package kube

import (
	"sort"
	"time"

	rbacv1 "k8s.io/api/rbac/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type ServiceAccountInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Secrets   int    `json:"secrets"`
	CreatedAt string `json:"createdAt"`
}

type RoleInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Rules     int    `json:"rules"`
	CreatedAt string `json:"createdAt"`
}

type RoleBindingInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	RoleRef   string `json:"roleRef"`
	Subjects  int    `json:"subjects"`
	CreatedAt string `json:"createdAt"`
}

type ClusterRoleInfo struct {
	Name        string `json:"name"`
	Rules       int    `json:"rules"`
	Aggregation bool   `json:"aggregation"`
	CreatedAt   string `json:"createdAt"`
}

type ClusterRoleBindingInfo struct {
	Name      string `json:"name"`
	RoleRef   string `json:"roleRef"`
	Subjects  int    `json:"subjects"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) ServiceAccounts(namespace string) []ServiceAccountInfo {
	f := w.factoryFor("ServiceAccount")
	if f == nil {
		return []ServiceAccountInfo{}
	}
	lister := f.Core().V1().ServiceAccounts().Lister()
	var (
		sas []*corev1.ServiceAccount
		err error
	)
	if namespace == "" {
		sas, err = lister.List(labels.Everything())
	} else {
		sas, err = lister.ServiceAccounts(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ServiceAccountInfo{}
	}
	out := make([]ServiceAccountInfo, 0, len(sas))
	for _, s := range sas {
		out = append(out, ServiceAccountInfo{
			Name:      s.Name,
			Namespace: s.Namespace,
			Secrets:   len(s.Secrets),
			CreatedAt: s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) Roles(namespace string) []RoleInfo {
	f := w.factoryFor("Role")
	if f == nil {
		return []RoleInfo{}
	}
	lister := f.Rbac().V1().Roles().Lister()
	var (
		roles []*rbacv1.Role
		err   error
	)
	if namespace == "" {
		roles, err = lister.List(labels.Everything())
	} else {
		roles, err = lister.Roles(namespace).List(labels.Everything())
	}
	if err != nil {
		return []RoleInfo{}
	}
	out := make([]RoleInfo, 0, len(roles))
	for _, r := range roles {
		out = append(out, RoleInfo{
			Name:      r.Name,
			Namespace: r.Namespace,
			Rules:     len(r.Rules),
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) RoleBindings(namespace string) []RoleBindingInfo {
	f := w.factoryFor("RoleBinding")
	if f == nil {
		return []RoleBindingInfo{}
	}
	lister := f.Rbac().V1().RoleBindings().Lister()
	var (
		bindings []*rbacv1.RoleBinding
		err      error
	)
	if namespace == "" {
		bindings, err = lister.List(labels.Everything())
	} else {
		bindings, err = lister.RoleBindings(namespace).List(labels.Everything())
	}
	if err != nil {
		return []RoleBindingInfo{}
	}
	out := make([]RoleBindingInfo, 0, len(bindings))
	for _, b := range bindings {
		ref := b.RoleRef.Kind + "/" + b.RoleRef.Name
		out = append(out, RoleBindingInfo{
			Name:      b.Name,
			Namespace: b.Namespace,
			RoleRef:   ref,
			Subjects:  len(b.Subjects),
			CreatedAt: b.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ClusterRoles() []ClusterRoleInfo {
	f := w.factoryFor("ClusterRole")
	if f == nil {
		return []ClusterRoleInfo{}
	}
	list, err := f.Rbac().V1().ClusterRoles().Lister().List(labels.Everything())
	if err != nil {
		return []ClusterRoleInfo{}
	}
	out := make([]ClusterRoleInfo, 0, len(list))
	for _, r := range list {
		out = append(out, ClusterRoleInfo{
			Name:        r.Name,
			Rules:       len(r.Rules),
			Aggregation: r.AggregationRule != nil,
			CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) ClusterRoleBindings() []ClusterRoleBindingInfo {
	f := w.factoryFor("ClusterRoleBinding")
	if f == nil {
		return []ClusterRoleBindingInfo{}
	}
	list, err := f.Rbac().V1().ClusterRoleBindings().Lister().List(labels.Everything())
	if err != nil {
		return []ClusterRoleBindingInfo{}
	}
	out := make([]ClusterRoleBindingInfo, 0, len(list))
	for _, b := range list {
		ref := b.RoleRef.Kind + "/" + b.RoleRef.Name
		out = append(out, ClusterRoleBindingInfo{
			Name:      b.Name,
			RoleRef:   ref,
			Subjects:  len(b.Subjects),
			CreatedAt: b.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
