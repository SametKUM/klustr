package kube

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type awsVaultProvider struct{}

func (awsVaultProvider) Name() string { return "aws-vault" }

func (awsVaultProvider) Detect() bool {
	_, err := exec.LookPath("aws-vault")
	return err == nil
}

func (awsVaultProvider) ListProfiles() ([]string, error) {
	path := os.Getenv("AWS_CONFIG_FILE")
	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return []string{}, err
		}
		path = filepath.Join(home, ".aws", "config")
	}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return []string{}, err
	}
	defer f.Close()
	return parseAWSConfigProfiles(f), nil
}

func parseAWSConfigProfiles(r io.Reader) []string {
	seen := make(map[string]bool)
	profiles := []string{}
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "[") || !strings.HasSuffix(line, "]") {
			continue
		}
		section := strings.TrimSpace(line[1 : len(line)-1])
		name := ""
		switch {
		case section == "default":
			name = "default"
		case strings.HasPrefix(section, "profile "):
			name = strings.TrimSpace(strings.TrimPrefix(section, "profile "))
		}
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		profiles = append(profiles, name)
	}
	sort.Strings(profiles)
	return profiles
}

func (awsVaultProvider) Capture(ctx context.Context, profile string) (CapturedCredentials, error) {
	cmd := exec.CommandContext(ctx, "aws-vault", "export", "--format=json", profile)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return CapturedCredentials{}, fmt.Errorf("aws-vault export: %s", stderrTail(stderr.String(), err))
	}
	return parseAWSVaultExport(stdout.Bytes())
}

// stderrTail reduces a helper's stderr to its last non-empty line so error
// surfacing stays one-line; stdout (which carries the secrets) must never
// reach an error message.
func stderrTail(stderr string, fallback error) string {
	lines := strings.Split(strings.TrimSpace(stderr), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if l := strings.TrimSpace(lines[i]); l != "" {
			return l
		}
	}
	return fallback.Error()
}

func parseAWSVaultExport(out []byte) (CapturedCredentials, error) {
	var payload struct {
		AccessKeyID     string `json:"AccessKeyId"`
		SecretAccessKey string `json:"SecretAccessKey"`
		SessionToken    string `json:"SessionToken"`
		Expiration      string `json:"Expiration"`
	}
	if err := json.Unmarshal(out, &payload); err != nil {
		return CapturedCredentials{}, errors.New("aws-vault export returned unexpected output")
	}
	if payload.AccessKeyID == "" || payload.SecretAccessKey == "" {
		return CapturedCredentials{}, errors.New("aws-vault export returned no credentials")
	}
	env := map[string]string{
		"AWS_ACCESS_KEY_ID":     payload.AccessKeyID,
		"AWS_SECRET_ACCESS_KEY": payload.SecretAccessKey,
	}
	if payload.SessionToken != "" {
		env["AWS_SESSION_TOKEN"] = payload.SessionToken
	}
	var expiry time.Time
	if payload.Expiration != "" {
		t, err := time.Parse(time.RFC3339, payload.Expiration)
		if err != nil {
			return CapturedCredentials{}, errors.New("aws-vault export returned an unparseable expiration")
		}
		expiry = t
	}
	return CapturedCredentials{env: env, expiry: expiry}, nil
}
