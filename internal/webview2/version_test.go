package webview2

import "testing"

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"94.0.992.31", "94.0.992.31", 0},
		{"130.0.2849.80", "94.0.992.31", 1},
		{"94.0.992.30", "94.0.992.31", -1},
		{"94.0.1000.0", "94.0.992.31", 1},
		{"94.0.992", "94.0.992.0", 0},
		{"93.9.9999.9", "94.0.992.31", -1},
	}
	for _, c := range cases {
		got, ok := compareVersions(c.a, c.b)
		if !ok || got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, %v; want %d", c.a, c.b, got, ok, c.want)
		}
	}
	for _, bad := range []string{"", "94.x.1", "94..1", "-1.0"} {
		if _, ok := compareVersions(bad, minimumVersion); ok {
			t.Errorf("compareVersions(%q, ...) accepted a malformed version", bad)
		}
	}
}
