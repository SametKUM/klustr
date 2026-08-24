package kube

import (
	"fmt"
	"io"
	"testing"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart"
	kubefake "helm.sh/helm/v3/pkg/kube/fake"
	"helm.sh/helm/v3/pkg/release"
	"helm.sh/helm/v3/pkg/storage"
	"helm.sh/helm/v3/pkg/storage/driver"
)

func helmTestRelease(name, namespace string, revision int, status release.Status) *release.Release {
	return &release.Release{
		Name:      name,
		Namespace: namespace,
		Version:   revision,
		Info:      &release.Info{Status: status, Description: string(status)},
		Chart: &chart.Chart{
			Metadata: &chart.Metadata{Name: name, Version: "1.0.0", AppVersion: "1.0.0"},
		},
	}
}

func helmTestConfig(t *testing.T, releases ...*release.Release) *action.Configuration {
	t.Helper()
	mem := driver.NewMemory()
	for _, r := range releases {
		key := fmt.Sprintf("sh.helm.release.v1.%s.v%d", r.Name, r.Version)
		if err := mem.Create(key, r); err != nil {
			t.Fatalf("seeding %s/%s v%d: %v", r.Namespace, r.Name, r.Version, err)
		}
	}
	// Create() pins the driver to the namespace of the release it just stored;
	// an empty namespace is what makes List span all of them.
	mem.SetNamespace("")
	return &action.Configuration{
		Releases:   storage.Init(mem),
		KubeClient: &kubefake.PrintingKubeClient{Out: io.Discard, LogOutput: io.Discard},
		Log:        func(string, ...interface{}) {},
	}
}

// A release stuck mid-install or mid-upgrade must stay in the list: those are
// the states the user opens Klustr to fix. The Helm SDK default state mask is
// deployed|failed and drops them, so this guards helmListStateMask.
func TestListReleasesIncludesPendingAndInProgressStates(t *testing.T) {
	cfg := helmTestConfig(t,
		helmTestRelease("mariadb-operator", "operator-system", 1, release.StatusDeployed),
		helmTestRelease("clickhouse-operator", "operator-system", 1, release.StatusSuperseded),
		helmTestRelease("clickhouse-operator", "operator-system", 2, release.StatusPendingUpgrade),
		helmTestRelease("keda", "operator-system", 1, release.StatusPendingInstall),
		helmTestRelease("valkey-operator", "operator-system", 1, release.StatusPendingRollback),
		helmTestRelease("victoriametrics-operator", "operator-system", 1, release.StatusUninstalling),
		helmTestRelease("cert-manager", "cert-manager", 1, release.StatusFailed),
	)

	got, err := listReleases(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := map[string]string{
		"cert-manager/cert-manager":                "failed",
		"operator-system/clickhouse-operator":      "pending-upgrade",
		"operator-system/keda":                     "pending-install",
		"operator-system/mariadb-operator":         "deployed",
		"operator-system/valkey-operator":          "pending-rollback",
		"operator-system/victoriametrics-operator": "uninstalling",
	}
	if len(got) != len(want) {
		t.Fatalf("got %d rows, want %d: %+v", len(got), len(want), got)
	}
	for _, row := range got {
		key := row.Namespace + "/" + row.Name
		status, ok := want[key]
		if !ok {
			t.Errorf("unexpected release %s in list", key)
			continue
		}
		if row.Status != status {
			t.Errorf("%s: got status %q, want %q", key, row.Status, status)
		}
	}

	// The superseded revision 1 must not add a second row, and the row that does
	// survive is the newest revision.
	for _, row := range got {
		if row.Name == "clickhouse-operator" && row.Revision != 2 {
			t.Errorf("clickhouse-operator: got revision %d, want 2", row.Revision)
		}
	}
}

// `helm uninstall --keep-history` leaves an uninstalled release behind. Those
// are history, not workloads, so they stay out of the list.
func TestListReleasesSkipsUninstalledReleases(t *testing.T) {
	cfg := helmTestConfig(t,
		helmTestRelease("gone", "default", 1, release.StatusUninstalled),
		helmTestRelease("here", "default", 1, release.StatusDeployed),
	)

	got, err := listReleases(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].Name != "here" {
		t.Fatalf("got %+v, want only the deployed release", got)
	}
}

// Rows cross the bridge sorted by namespace then name so the table has a stable
// order before the user sorts it.
func TestListReleasesSortsByNamespaceThenName(t *testing.T) {
	cfg := helmTestConfig(t,
		helmTestRelease("zookeeper", "apps", 1, release.StatusDeployed),
		helmTestRelease("api", "apps", 1, release.StatusPendingUpgrade),
		helmTestRelease("nginx", "aaa-infra", 1, release.StatusDeployed),
	)

	got, err := listReleases(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"aaa-infra/nginx", "apps/api", "apps/zookeeper"}
	for i, w := range want {
		if got[i].Namespace+"/"+got[i].Name != w {
			t.Fatalf("row %d: got %s/%s, want %s", i, got[i].Namespace, got[i].Name, w)
		}
	}
}
