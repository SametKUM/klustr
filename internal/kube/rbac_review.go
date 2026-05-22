package kube

import (
	"sort"
	"strings"

	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// AccessSubject is the "who" surface for the access-review picker. The same
// subject may be reached via different kinds (an SA can be addressed as a
// ServiceAccount subject *or* via a system:serviceaccount Group); we list
// each addressable identity once.
type AccessSubject struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// SubjectAccessRule is a single "this subject can do X to Y" row, paired
// with the binding chain that granted it so the UI can show a click-through
// trace ("why do I have this?").
type SubjectAccessRule struct {
	APIGroups        []string `json:"apiGroups"`
	Resources        []string `json:"resources"`
	Verbs            []string `json:"verbs"`
	ResourceNames    []string `json:"resourceNames"`
	NonResourceURLs  []string `json:"nonResourceURLs"`
	BindingKind      string   `json:"bindingKind"`
	BindingName      string   `json:"bindingName"`
	BindingNamespace string   `json:"bindingNamespace"`
	RoleKind         string   `json:"roleKind"`
	RoleName         string   `json:"roleName"`
	RoleNamespace    string   `json:"roleNamespace"`
	Scope            string   `json:"scope"`
	ViaGroup         string   `json:"viaGroup"`
}

type SubjectAccess struct {
	Subject      AccessSubject       `json:"subject"`
	Rules        []SubjectAccessRule `json:"rules"`
	HasWildcard  bool                `json:"hasWildcard"`
	ClusterAdmin bool                `json:"clusterAdmin"`
}

// RBACReviewInputs is the slice-of-pointers snapshot the compute layer needs.
// Keeping it pure (no listers, no client-go interfaces) is what lets the
// table tests run with hand-crafted objects.
type RBACReviewInputs struct {
	Roles               []*rbacv1.Role
	RoleBindings        []*rbacv1.RoleBinding
	ClusterRoles        []*rbacv1.ClusterRole
	ClusterRoleBindings []*rbacv1.ClusterRoleBinding
}

func ComputeSubjectAccess(sub AccessSubject, in RBACReviewInputs) *SubjectAccess {
	identities := expandSubjectIdentities(sub)
	clusterRoles := indexClusterRoles(in.ClusterRoles)
	roles := indexRoles(in.Roles)

	out := &SubjectAccess{Subject: sub, Rules: []SubjectAccessRule{}}

	for _, b := range in.ClusterRoleBindings {
		via, ok := matchAny(b.Subjects, identities)
		if !ok {
			continue
		}
		cr, found := clusterRoles[b.RoleRef.Name]
		if !found {
			continue
		}
		for _, r := range cr.Rules {
			out.Rules = append(out.Rules, makeRule(r, SubjectAccessRule{
				BindingKind: "ClusterRoleBinding",
				BindingName: b.Name,
				RoleKind:    "ClusterRole",
				RoleName:    cr.Name,
				Scope:       "*",
				ViaGroup:    via,
			}))
		}
	}

	for _, b := range in.RoleBindings {
		via, ok := matchAny(b.Subjects, identities)
		if !ok {
			continue
		}
		switch b.RoleRef.Kind {
		case "ClusterRole":
			cr, found := clusterRoles[b.RoleRef.Name]
			if !found {
				continue
			}
			for _, r := range cr.Rules {
				out.Rules = append(out.Rules, makeRule(r, SubjectAccessRule{
					BindingKind:      "RoleBinding",
					BindingName:      b.Name,
					BindingNamespace: b.Namespace,
					RoleKind:         "ClusterRole",
					RoleName:         cr.Name,
					Scope:            b.Namespace,
					ViaGroup:         via,
				}))
			}
		case "Role":
			rl, found := roles[roleKey(b.Namespace, b.RoleRef.Name)]
			if !found {
				continue
			}
			for _, r := range rl.Rules {
				out.Rules = append(out.Rules, makeRule(r, SubjectAccessRule{
					BindingKind:      "RoleBinding",
					BindingName:      b.Name,
					BindingNamespace: b.Namespace,
					RoleKind:         "Role",
					RoleName:         rl.Name,
					RoleNamespace:    rl.Namespace,
					Scope:            b.Namespace,
					ViaGroup:         via,
				}))
			}
		}
	}

	sortSubjectRules(out.Rules)
	annotateFlags(out)
	return out
}

func makeRule(r rbacv1.PolicyRule, base SubjectAccessRule) SubjectAccessRule {
	base.APIGroups = append([]string{}, r.APIGroups...)
	base.Resources = append([]string{}, r.Resources...)
	base.Verbs = append([]string{}, r.Verbs...)
	base.ResourceNames = append([]string{}, r.ResourceNames...)
	base.NonResourceURLs = append([]string{}, r.NonResourceURLs...)
	return base
}

func annotateFlags(a *SubjectAccess) {
	for _, r := range a.Rules {
		if hasStar(r.APIGroups) || hasStar(r.Resources) || hasStar(r.Verbs) {
			a.HasWildcard = true
		}
		if hasStar(r.APIGroups) && hasStar(r.Resources) && hasStar(r.Verbs) && r.Scope == "*" {
			a.ClusterAdmin = true
		}
	}
}

func hasStar(values []string) bool {
	for _, v := range values {
		if v == "*" {
			return true
		}
	}
	return false
}

func sortSubjectRules(rules []SubjectAccessRule) {
	sort.SliceStable(rules, func(i, j int) bool {
		a, b := rules[i], rules[j]
		if a.Scope != b.Scope {
			if a.Scope == "*" {
				return true
			}
			if b.Scope == "*" {
				return false
			}
			return a.Scope < b.Scope
		}
		if a.RoleKind != b.RoleKind {
			return a.RoleKind < b.RoleKind
		}
		if a.RoleName != b.RoleName {
			return a.RoleName < b.RoleName
		}
		return strings.Join(a.Resources, ",") < strings.Join(b.Resources, ",")
	})
}

// subjectIdentity captures the literal-and-implicit ways one user shows up
// in a Subjects list: a ServiceAccount is also reachable via the
// system:serviceaccount[s][:ns] groups, and every authenticated request is
// reachable via system:authenticated.
type subjectIdentity struct {
	kind      string
	name      string
	namespace string
	viaGroup  string
}

func expandSubjectIdentities(s AccessSubject) []subjectIdentity {
	out := []subjectIdentity{{kind: s.Kind, name: s.Name, namespace: s.Namespace}}
	if s.Kind == rbacv1.ServiceAccountKind && s.Namespace != "" && s.Name != "" {
		out = append(out,
			subjectIdentity{kind: rbacv1.GroupKind, name: "system:serviceaccount:" + s.Namespace + ":" + s.Name, viaGroup: "system:serviceaccount:" + s.Namespace + ":" + s.Name},
			subjectIdentity{kind: rbacv1.GroupKind, name: "system:serviceaccounts:" + s.Namespace, viaGroup: "system:serviceaccounts:" + s.Namespace},
			subjectIdentity{kind: rbacv1.GroupKind, name: "system:serviceaccounts", viaGroup: "system:serviceaccounts"},
			subjectIdentity{kind: rbacv1.GroupKind, name: "system:authenticated", viaGroup: "system:authenticated"},
		)
	}
	if s.Kind == rbacv1.UserKind && s.Name != "" {
		out = append(out, subjectIdentity{kind: rbacv1.GroupKind, name: "system:authenticated", viaGroup: "system:authenticated"})
	}
	return out
}

func matchAny(subjects []rbacv1.Subject, identities []subjectIdentity) (string, bool) {
	for _, s := range subjects {
		for _, id := range identities {
			if subjectMatches(s, id) {
				return id.viaGroup, true
			}
		}
	}
	return "", false
}

func subjectMatches(s rbacv1.Subject, id subjectIdentity) bool {
	if s.Kind != id.kind {
		return false
	}
	if s.Name != id.name {
		return false
	}
	if s.Kind == rbacv1.ServiceAccountKind && s.Namespace != id.namespace {
		return false
	}
	return true
}

func indexClusterRoles(list []*rbacv1.ClusterRole) map[string]*rbacv1.ClusterRole {
	m := make(map[string]*rbacv1.ClusterRole, len(list))
	for _, r := range list {
		m[r.Name] = r
	}
	return m
}

func indexRoles(list []*rbacv1.Role) map[string]*rbacv1.Role {
	m := make(map[string]*rbacv1.Role, len(list))
	for _, r := range list {
		m[roleKey(r.Namespace, r.Name)] = r
	}
	return m
}

func roleKey(ns, name string) string { return ns + "/" + name }

// ListAccessSubjects scans the watcher's RBAC cache for every distinct
// identity that *could* be selected in the picker: every ServiceAccount in
// the cluster plus every Subject literally referenced by a binding.
func (w *contextWatcher) ListAccessSubjects() []AccessSubject {
	seen := make(map[string]AccessSubject)
	add := func(s AccessSubject) {
		key := s.Kind + "|" + s.Namespace + "|" + s.Name
		if _, ok := seen[key]; !ok {
			seen[key] = s
		}
	}

	if f := w.factoryFor("ServiceAccount"); f != nil {
		if sas, err := f.Core().V1().ServiceAccounts().Lister().List(labels.Everything()); err == nil {
			for _, sa := range sas {
				add(AccessSubject{Kind: rbacv1.ServiceAccountKind, Name: sa.Name, Namespace: sa.Namespace})
			}
		}
	}
	if f := w.factoryFor("RoleBinding"); f != nil {
		if rbs, err := f.Rbac().V1().RoleBindings().Lister().List(labels.Everything()); err == nil {
			for _, b := range rbs {
				for _, s := range b.Subjects {
					add(AccessSubject{Kind: s.Kind, Name: s.Name, Namespace: s.Namespace})
				}
			}
		}
	}
	if f := w.factoryFor("ClusterRoleBinding"); f != nil {
		if crbs, err := f.Rbac().V1().ClusterRoleBindings().Lister().List(labels.Everything()); err == nil {
			for _, b := range crbs {
				for _, s := range b.Subjects {
					add(AccessSubject{Kind: s.Kind, Name: s.Name, Namespace: s.Namespace})
				}
			}
		}
	}

	out := make([]AccessSubject, 0, len(seen))
	for _, s := range seen {
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return subjectKindRank(out[i].Kind) < subjectKindRank(out[j].Kind)
		}
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func subjectKindRank(k string) int {
	switch k {
	case rbacv1.ServiceAccountKind:
		return 0
	case rbacv1.UserKind:
		return 1
	case rbacv1.GroupKind:
		return 2
	default:
		return 3
	}
}

func (w *contextWatcher) GetSubjectAccess(sub AccessSubject) *SubjectAccess {
	in := RBACReviewInputs{}
	if f := w.factoryFor("Role"); f != nil {
		if list, err := f.Rbac().V1().Roles().Lister().List(labels.Everything()); err == nil {
			in.Roles = list
		}
	}
	if f := w.factoryFor("RoleBinding"); f != nil {
		if list, err := f.Rbac().V1().RoleBindings().Lister().List(labels.Everything()); err == nil {
			in.RoleBindings = list
		}
	}
	if f := w.factoryFor("ClusterRole"); f != nil {
		if list, err := f.Rbac().V1().ClusterRoles().Lister().List(labels.Everything()); err == nil {
			in.ClusterRoles = list
		}
	}
	if f := w.factoryFor("ClusterRoleBinding"); f != nil {
		if list, err := f.Rbac().V1().ClusterRoleBindings().Lister().List(labels.Everything()); err == nil {
			in.ClusterRoleBindings = list
		}
	}
	return ComputeSubjectAccess(sub, in)
}
