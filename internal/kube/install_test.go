package kube

import "testing"

// Only the installer's managed-by label marks metrics-server as Klustr-managed.
// A "klustr" managedFields manager (written by any scale/restart/apply) must
// NOT count — otherwise the overview would offer to uninstall a Helm/cloud
// install the user merely touched, and the uninstaller would delete it.
func TestMetricsServerKlustrManaged(t *testing.T) {
	if !metricsServerKlustrManaged(map[string]string{MetricsServerManagedByLabel: MetricsServerManagedByValue}) {
		t.Error("installer label must count as managed")
	}
	if metricsServerKlustrManaged(nil) {
		t.Error("no labels must not count as managed")
	}
	if metricsServerKlustrManaged(map[string]string{MetricsServerManagedByLabel: "something-else"}) {
		t.Error("a different label value must not count as managed")
	}
	if metricsServerKlustrManaged(map[string]string{"app": "metrics-server"}) {
		t.Error("an unrelated label must not count as managed")
	}
}
