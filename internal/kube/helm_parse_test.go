package kube

import (
	"testing"
	"time"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/release"
	"helm.sh/helm/v3/pkg/repo"
	helmtime "helm.sh/helm/v3/pkg/time"
)

func TestReleaseInfoFromRelease(t *testing.T) {
	deployed := helmtime.Time{Time: time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)}

	t.Run("full", func(t *testing.T) {
		r := &release.Release{
			Name:      "redis",
			Namespace: "data",
			Version:   3,
			Info:      &release.Info{Status: release.StatusDeployed, LastDeployed: deployed, Description: "Upgrade complete"},
			Chart:     &chart.Chart{Metadata: &chart.Metadata{Name: "redis", Version: "18.1.0", AppVersion: "7.2.1"}},
		}
		got := releaseInfoFromRelease(r)
		if got.Name != "redis" || got.Namespace != "data" || got.Revision != 3 {
			t.Fatalf("identity fields wrong: %+v", got)
		}
		if got.Status != "deployed" {
			t.Errorf("Status = %q, want deployed", got.Status)
		}
		if got.Chart != "redis-18.1.0" {
			t.Errorf("Chart = %q, want redis-18.1.0", got.Chart)
		}
		if got.ChartName != "redis" || got.ChartVer != "18.1.0" || got.AppVersion != "7.2.1" {
			t.Errorf("chart fields wrong: %+v", got)
		}
		if got.Updated != "2024-01-02T03:04:05Z" {
			t.Errorf("Updated = %q, want RFC3339 UTC", got.Updated)
		}
		if got.Description != "Upgrade complete" {
			t.Errorf("Description = %q", got.Description)
		}
	})

	t.Run("nil chart and info", func(t *testing.T) {
		got := releaseInfoFromRelease(&release.Release{Name: "x", Version: 1})
		if got.Status != "" || got.Updated != "" || got.AppVersion != "" {
			t.Errorf("expected empty optional fields, got %+v", got)
		}
		if got.Chart != "-" {
			t.Errorf("Chart = %q, want \"-\" for empty name/version", got.Chart)
		}
	})

	t.Run("zero LastDeployed", func(t *testing.T) {
		r := &release.Release{Info: &release.Info{Status: release.StatusFailed}}
		got := releaseInfoFromRelease(r)
		if got.Updated != "" {
			t.Errorf("Updated = %q, want empty for zero time", got.Updated)
		}
		if got.Status != "failed" {
			t.Errorf("Status = %q, want failed", got.Status)
		}
	})
}

func TestRevisionInfoFromRelease(t *testing.T) {
	r := &release.Release{
		Version: 5,
		Info:    &release.Info{Status: release.StatusSuperseded, Description: "rolled back"},
		Chart:   &chart.Chart{Metadata: &chart.Metadata{Name: "api", Version: "1.0.0", AppVersion: "v9"}},
	}
	got := revisionInfoFromRelease(r)
	if got.Revision != 5 || got.Status != "superseded" || got.Chart != "api-1.0.0" || got.AppVersion != "v9" || got.Description != "rolled back" {
		t.Fatalf("revisionInfoFromRelease wrong: %+v", got)
	}
}

func TestChartMatches(t *testing.T) {
	v := &repo.ChartVersion{Metadata: &chart.Metadata{
		Description: "A fast in-memory cache",
		Keywords:    []string{"database", "kv"},
	}}
	cases := []struct {
		name      string
		needle    string
		repoName  string
		chartName string
		want      bool
	}{
		{"chart name", "red", "bitnami", "redis", true},
		{"repo name", "bitn", "bitnami", "redis", true},
		{"description", "memory", "bitnami", "redis", true},
		{"keyword", "kv", "bitnami", "redis", true},
		{"no match", "postgres", "bitnami", "redis", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := chartMatches(tc.needle, tc.repoName, tc.chartName, v); got != tc.want {
				t.Errorf("chartMatches(%q) = %v, want %v", tc.needle, got, tc.want)
			}
		})
	}
}
