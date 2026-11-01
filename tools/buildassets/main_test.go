package main

import (
	"encoding/json"
	"encoding/xml"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNumericVersion(t *testing.T) {
	cases := map[string]string{
		"":             "0.0.0",
		"v1.2.3":       "1.2.3",
		"1.2.3":        "1.2.3",
		"v0.93.0-rc.1": "0.93.0",
	}
	for in, want := range cases {
		got, err := numericVersion(in)
		if err != nil || got != want {
			t.Errorf("numericVersion(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"v1.2", "latest", "v1.2.3 ; rm -rf /"} {
		if _, err := numericVersion(bad); err == nil {
			t.Errorf("numericVersion(%q) accepted a non-release version", bad)
		}
	}
}

// TestRenderRepositoryTemplates renders the real templates and config, so a
// template that stops parsing or loses a value fails here, not in a release.
func TestRenderRepositoryTemplates(t *testing.T) {
	out := t.TempDir()
	if err := run([]string{"-root", "../..", "-version", "v1.2.3-rc.1", "-out", out}); err != nil {
		t.Fatal(err)
	}

	plist := read(t, out, "Info.plist")
	var doc struct {
		Dict struct {
			Keys    []string `xml:"key"`
			Strings []string `xml:"string"`
		} `xml:"dict"`
	}
	if err := xml.Unmarshal([]byte(plist), &doc); err != nil {
		t.Fatalf("Info.plist is not valid XML: %v", err)
	}
	fields := map[string]string{}
	for i, key := range doc.Dict.Keys {
		fields[key] = doc.Dict.Strings[i]
	}
	for key, want := range map[string]string{
		"CFBundleIdentifier":         "com.wails.klustr",
		"CFBundleExecutable":         "klustr",
		"CFBundleName":               "Klustr",
		"CFBundleShortVersionString": "1.2.3",
		"CFBundleVersion":            "1.2.3",
		"CFBundleIconFile":           "iconfile",
	} {
		if fields[key] != want {
			t.Errorf("Info.plist %s = %q, want %q", key, fields[key], want)
		}
	}

	var versionInfo struct {
		Fixed struct {
			FileVersion string `json:"file_version"`
		} `json:"fixed"`
		Info map[string]map[string]string `json:"info"`
	}
	if err := json.Unmarshal([]byte(read(t, out, "info.json")), &versionInfo); err != nil {
		t.Fatalf("info.json is not valid JSON: %v", err)
	}
	strs := versionInfo.Info["0000"]
	if versionInfo.Fixed.FileVersion != "1.2.3" || strs["ProductVersion"] != "1.2.3" ||
		strs["ProductName"] != "Klustr" || strs["FileDescription"] != "Klustr" || strs["CompanyName"] != "Samet Kum" {
		t.Errorf("info.json = %+v", versionInfo)
	}

	manifest := read(t, out, "wails.exe.manifest")
	if err := xml.Unmarshal([]byte(manifest), new(struct{})); err != nil {
		t.Fatalf("manifest is not valid XML: %v", err)
	}
	if !strings.Contains(manifest, `name="com.wails.klustr" version="1.2.3.0"`) {
		t.Errorf("manifest assemblyIdentity missing name or version:\n%s", manifest)
	}
}

func TestXMLAndJSONEscaping(t *testing.T) {
	out := t.TempDir()
	root := t.TempDir()
	for src := range templates {
		text, err := os.ReadFile(filepath.Join("../..", src))
		if err != nil {
			t.Fatal(err)
		}
		writeFile(t, filepath.Join(root, src), string(text))
	}
	v := values{
		info: info{
			CompanyName: `A & "B" <C>`, ProductName: "P", ProductIdentifier: "com.example.p",
			Copyright: "c", Comments: "x",
		},
		BinaryName: "p",
		Version:    "1.0.0",
	}
	if err := render(root, out, v); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(read(t, out, "info.json")), new(map[string]any)); err != nil {
		t.Errorf("info.json with quotes is not valid JSON: %v", err)
	}
}

func read(t *testing.T, dir, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
