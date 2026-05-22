package kube

import (
	"reflect"
	"strings"
	"testing"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func clusterRole(name string, rules ...rbacv1.PolicyRule) *rbacv1.ClusterRole {
	return &rbacv1.ClusterRole{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Rules:      rules,
	}
}

func role(ns, name string, rules ...rbacv1.PolicyRule) *rbacv1.Role {
	return &rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
		Rules:      rules,
	}
}

func clusterBinding(name, roleName string, subs ...rbacv1.Subject) *rbacv1.ClusterRoleBinding {
	return &rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: roleName},
		Subjects:   subs,
	}
}

func roleBinding(ns, name, roleKind, roleName string, subs ...rbacv1.Subject) *rbacv1.RoleBinding {
	return &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
		RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: roleKind, Name: roleName},
		Subjects:   subs,
	}
}

func rule(apiGroups, resources, verbs []string) rbacv1.PolicyRule {
	return rbacv1.PolicyRule{APIGroups: apiGroups, Resources: resources, Verbs: verbs}
}

func saSub(ns, name string) rbacv1.Subject {
	return rbacv1.Subject{Kind: rbacv1.ServiceAccountKind, Namespace: ns, Name: name}
}

func userSub(name string) rbacv1.Subject {
	return rbacv1.Subject{Kind: rbacv1.UserKind, Name: name, APIGroup: rbacv1.GroupName}
}

func groupSub(name string) rbacv1.Subject {
	return rbacv1.Subject{Kind: rbacv1.GroupKind, Name: name, APIGroup: rbacv1.GroupName}
}

func TestComputeSubjectAccess(t *testing.T) {
	readPods := rule([]string{""}, []string{"pods"}, []string{"get", "list", "watch"})
	deletePods := rule([]string{""}, []string{"pods"}, []string{"delete"})
	readSecrets := rule([]string{""}, []string{"secrets"}, []string{"get", "list"})
	starRule := rule([]string{"*"}, []string{"*"}, []string{"*"})

	cases := []struct {
		name        string
		subject     AccessSubject
		inputs      RBACReviewInputs
		wantRules   int
		wantScopes  []string
		wildcard    bool
		clusterAdm  bool
		mustInclude []string // substrings that must appear in the printed rule trace
	}{
		{
			name:    "no bindings ⇒ empty",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "default", Name: "ci"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{clusterRole("admin", readPods)},
			},
			wantRules: 0,
		},
		{
			name:    "direct ServiceAccount binding via ClusterRoleBinding",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "default", Name: "ci"},
			inputs: RBACReviewInputs{
				ClusterRoles:        []*rbacv1.ClusterRole{clusterRole("view", readPods)},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{clusterBinding("ci-view", "view", saSub("default", "ci"))},
			},
			wantRules:   1,
			wantScopes:  []string{"*"},
			mustInclude: []string{"ClusterRoleBinding/ci-view→ClusterRole/view"},
		},
		{
			name:    "additive across multiple bindings",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "default", Name: "ci"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{
					clusterRole("view", readPods),
					clusterRole("deleter", deletePods),
				},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{
					clusterBinding("a", "view", saSub("default", "ci")),
					clusterBinding("b", "deleter", saSub("default", "ci")),
				},
			},
			wantRules: 2,
		},
		{
			name:    "namespaced RoleBinding to a Role",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "team-a", Name: "deployer"},
			inputs: RBACReviewInputs{
				Roles: []*rbacv1.Role{role("team-a", "edit", readPods)},
				RoleBindings: []*rbacv1.RoleBinding{
					roleBinding("team-a", "deployer-edit", "Role", "edit", saSub("team-a", "deployer")),
				},
			},
			wantRules:  1,
			wantScopes: []string{"team-a"},
		},
		{
			name:    "namespaced RoleBinding to a ClusterRole",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "team-a", Name: "deployer"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{clusterRole("view", readPods)},
				RoleBindings: []*rbacv1.RoleBinding{
					roleBinding("team-a", "deployer-view", "ClusterRole", "view", saSub("team-a", "deployer")),
				},
			},
			wantRules:  1,
			wantScopes: []string{"team-a"},
		},
		{
			name:    "system:serviceaccounts:<ns> group reaches a SA",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "team-a", Name: "deployer"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{clusterRole("read-secrets", readSecrets)},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{
					clusterBinding("ns-team-a-readers", "read-secrets", groupSub("system:serviceaccounts:team-a")),
				},
			},
			wantRules:   1,
			mustInclude: []string{"via system:serviceaccounts:team-a"},
		},
		{
			name:    "User subject + system:authenticated",
			subject: AccessSubject{Kind: rbacv1.UserKind, Name: "alice"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{
					clusterRole("view", readPods),
					clusterRole("self-access", readSecrets),
				},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{
					clusterBinding("alice-view", "view", userSub("alice")),
					clusterBinding("authn-self", "self-access", groupSub("system:authenticated")),
				},
			},
			wantRules: 2,
		},
		{
			name:    "cluster-admin wildcard rule",
			subject: AccessSubject{Kind: rbacv1.UserKind, Name: "root"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{clusterRole("cluster-admin", starRule)},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{
					clusterBinding("root-admin", "cluster-admin", userSub("root")),
				},
			},
			wantRules:  1,
			wildcard:   true,
			clusterAdm: true,
		},
		{
			name:    "RoleBinding pointing at a missing Role is dropped",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "team-a", Name: "deployer"},
			inputs: RBACReviewInputs{
				RoleBindings: []*rbacv1.RoleBinding{
					roleBinding("team-a", "broken", "Role", "missing", saSub("team-a", "deployer")),
				},
			},
			wantRules: 0,
		},
		{
			name:    "different SA in same name does not match",
			subject: AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "team-b", Name: "deployer"},
			inputs: RBACReviewInputs{
				ClusterRoles: []*rbacv1.ClusterRole{clusterRole("view", readPods)},
				ClusterRoleBindings: []*rbacv1.ClusterRoleBinding{
					clusterBinding("a", "view", saSub("team-a", "deployer")),
				},
			},
			wantRules: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeSubjectAccess(tc.subject, tc.inputs)
			if len(got.Rules) != tc.wantRules {
				t.Fatalf("rules: want %d, got %d (%+v)", tc.wantRules, len(got.Rules), got.Rules)
			}
			if tc.wildcard != got.HasWildcard {
				t.Errorf("HasWildcard: want %v, got %v", tc.wildcard, got.HasWildcard)
			}
			if tc.clusterAdm != got.ClusterAdmin {
				t.Errorf("ClusterAdmin: want %v, got %v", tc.clusterAdm, got.ClusterAdmin)
			}
			if tc.wantScopes != nil {
				scopes := make([]string, 0, len(got.Rules))
				for _, r := range got.Rules {
					scopes = append(scopes, r.Scope)
				}
				if !reflect.DeepEqual(scopes, tc.wantScopes) {
					t.Errorf("scopes: want %v, got %v", tc.wantScopes, scopes)
				}
			}
			if len(tc.mustInclude) > 0 {
				printed := traceJoin(got.Rules)
				for _, s := range tc.mustInclude {
					if !strings.Contains(printed, s) {
						t.Errorf("trace %q does not contain %q", printed, s)
					}
				}
			}
		})
	}
}

func traceJoin(rules []SubjectAccessRule) string {
	parts := make([]string, 0, len(rules))
	for _, r := range rules {
		s := r.BindingKind + "/" + r.BindingName + "→" + r.RoleKind + "/" + r.RoleName
		if r.ViaGroup != "" {
			s += " via " + r.ViaGroup
		}
		parts = append(parts, s)
	}
	return strings.Join(parts, " | ")
}

func TestExpandSubjectIdentities(t *testing.T) {
	got := expandSubjectIdentities(AccessSubject{Kind: rbacv1.ServiceAccountKind, Namespace: "default", Name: "ci"})
	wantGroups := []string{
		"system:serviceaccount:default:ci",
		"system:serviceaccounts:default",
		"system:serviceaccounts",
		"system:authenticated",
	}
	for _, g := range wantGroups {
		found := false
		for _, id := range got {
			if id.kind == rbacv1.GroupKind && id.name == g {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing implicit group %q in %+v", g, got)
		}
	}
}
