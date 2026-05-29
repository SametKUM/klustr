// Package update checks GitHub Releases for a newer Klustr build. It only
// reports — downloading and replacing the binary is deliberately out of scope.
package update

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

const releaseAPITimeout = 10 * time.Second

// Overridden in tests to point at an httptest server.
var apiBaseURL = "https://api.github.com"

type Result struct {
	Available   bool   `json:"available"`
	Current     string `json:"current"`
	Latest      string `json:"latest"`
	ReleaseURL  string `json:"releaseURL"`
	Notes       string `json:"notes"`
	PublishedAt string `json:"publishedAt"`
}

type githubRelease struct {
	TagName     string `json:"tag_name"`
	HTMLURL     string `json:"html_url"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
}

// Check resolves the latest published release and compares it against the
// running build. Development builds never report an update and skip the network
// call entirely.
func Check(ctx context.Context, currentVersion, owner, repo string) (Result, error) {
	if isDevVersion(currentVersion) {
		return Result{Current: currentVersion}, nil
	}
	rel, err := fetchLatest(ctx, owner, repo)
	if err != nil {
		return Result{Current: currentVersion}, err
	}
	return compare(currentVersion, rel)
}

func isDevVersion(v string) bool {
	return v == "" || v == "dev" || strings.HasPrefix(v, "dev-")
}

// fetchLatest hits the /releases/latest endpoint, which GitHub defines as the
// newest release that is neither a draft nor a prerelease — so prereleases are
// excluded without any client-side filtering.
func fetchLatest(ctx context.Context, owner, repo string) (githubRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases/latest", apiBaseURL, owner, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return githubRelease{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "klustr-update-check")

	client := &http.Client{Timeout: releaseAPITimeout}
	resp, err := client.Do(req)
	if err != nil {
		return githubRelease{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return githubRelease{}, fmt.Errorf("github releases API: unexpected status %d", resp.StatusCode)
	}

	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return githubRelease{}, err
	}
	return rel, nil
}

func compare(currentVersion string, rel githubRelease) (Result, error) {
	res := Result{Current: currentVersion}
	latest, err := semver.NewVersion(rel.TagName)
	if err != nil {
		return res, fmt.Errorf("parse latest tag %q: %w", rel.TagName, err)
	}
	current, err := semver.NewVersion(currentVersion)
	if err != nil {
		return res, fmt.Errorf("parse current version %q: %w", currentVersion, err)
	}
	res.Latest = rel.TagName
	res.ReleaseURL = rel.HTMLURL
	res.Notes = rel.Body
	res.PublishedAt = rel.PublishedAt
	res.Available = latest.GreaterThan(current)
	return res, nil
}
