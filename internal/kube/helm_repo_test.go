package kube

import (
	"testing"

	"helm.sh/helm/v3/pkg/chart"
)

func TestValidateRepoName(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"plain", "bitnami", false},
		{"with dash", "ingress-nginx", false},
		{"with dot", "my.repo", false},
		{"empty", "", true},
		{"forward slash", "foo/bar", true},
		{"back slash", `foo\bar`, true},
		{"parent traversal", "../evil", true},
		{"nested traversal", "a/../../etc", true},
		{"trailing dotdot", "repo..", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateRepoName(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateRepoName(%q) error = %v, wantErr %v", tc.input, err, tc.wantErr)
			}
		})
	}
}

func TestValidateChartInstallable(t *testing.T) {
	cases := []struct {
		name    string
		chart   *chart.Chart
		wantErr bool
	}{
		{"nil metadata", &chart.Chart{}, true},
		{"empty type", &chart.Chart{Metadata: &chart.Metadata{Name: "x"}}, false},
		{"application", &chart.Chart{Metadata: &chart.Metadata{Name: "x", Type: "application"}}, false},
		{"library", &chart.Chart{Metadata: &chart.Metadata{Name: "x", Type: "library"}}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateChartInstallable(tc.chart)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateChartInstallable() error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}
