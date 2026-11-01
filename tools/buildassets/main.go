// Command buildassets renders the build files that carry Klustr's identity and
// version: the macOS Info.plist and the Windows version resource and manifest.
// The values come from the info section of build/config.yml and the version
// from -version. Wails v2 rendered these files from wails.json; with v3 the
// project renders them itself.
//
//	go run ./tools/buildassets -version v1.2.3 -out build/bin/assets
package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"text/template"

	"sigs.k8s.io/yaml"
)

// binaryName is the executable's name on every platform (klustr, klustr.exe,
// klustr.app/Contents/MacOS/klustr).
const binaryName = "klustr"

// templates maps each source template, relative to the repository root, to
// the file it renders in the output directory. Info.plist sets
// LSMinimumSystemVersion to 12.0, the macOS Go has required since Go 1.25 and
// the deployment target the build uses.
var templates = map[string]string{
	"build/darwin/Info.plist":          "Info.plist",
	"build/windows/info.json":          "info.json",
	"build/windows/wails.exe.manifest": "wails.exe.manifest",
}

type info struct {
	CompanyName       string `json:"companyName"`
	ProductName       string `json:"productName"`
	ProductIdentifier string `json:"productIdentifier"`
	Copyright         string `json:"copyright"`
	Comments          string `json:"comments"`
}

type values struct {
	info
	BinaryName string
	// Version is numbers only: macOS wants three integers in
	// CFBundleShortVersionString, and a Windows VERSIONINFO file version
	// cannot carry a prerelease suffix.
	Version string
}

var releaseVersion = regexp.MustCompile(`^v?(\d+\.\d+\.\d+)(-[0-9A-Za-z.]+)?$`)

// numericVersion turns a release version such as v1.2.3-rc.1 into 1.2.3. An
// empty version, a local build's, becomes 0.0.0.
func numericVersion(version string) (string, error) {
	if version == "" {
		return "0.0.0", nil
	}
	m := releaseVersion.FindStringSubmatch(version)
	if m == nil {
		return "", fmt.Errorf("version %q is not a release version (v1.2.3 or v1.2.3-rc.1)", version)
	}
	return m[1], nil
}

func loadInfo(configPath string) (info, error) {
	raw, err := os.ReadFile(configPath)
	if err != nil {
		return info{}, err
	}
	var config struct {
		Info info `json:"info"`
	}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		return info{}, fmt.Errorf("%s: %w", configPath, err)
	}
	i := config.Info
	if i.ProductName == "" || i.ProductIdentifier == "" || i.CompanyName == "" {
		return info{}, fmt.Errorf("%s: info needs productName, productIdentifier and companyName", configPath)
	}
	return i, nil
}

var funcs = template.FuncMap{
	// xml escapes a value for an XML text node or attribute.
	"xml": func(s string) (string, error) {
		var b strings.Builder
		err := xml.EscapeText(&b, []byte(s))
		return b.String(), err
	},
	// json quotes a value as a JSON string.
	"json": func(s string) (string, error) {
		b, err := json.Marshal(s)
		return string(b), err
	},
}

func render(root, outDir string, v values) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	for src, dst := range templates {
		text, err := os.ReadFile(filepath.Join(root, src))
		if err != nil {
			return err
		}
		tmpl, err := template.New(src).Funcs(funcs).Option("missingkey=error").Parse(string(text))
		if err != nil {
			return err
		}
		var out bytes.Buffer
		if err := tmpl.Execute(&out, v); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(outDir, dst), out.Bytes(), 0o644); err != nil {
			return err
		}
	}
	return nil
}

func run(args []string) error {
	flags := flag.NewFlagSet("buildassets", flag.ContinueOnError)
	root := flags.String("root", ".", "repository root")
	config := flags.String("config", "build/config.yml", "Wails project config, relative to -root")
	version := flags.String("version", "", "release version (v1.2.3 or v1.2.3-rc.1); empty for a local build")
	out := flags.String("out", "", "output directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *out == "" {
		return errors.New("-out is required")
	}
	i, err := loadInfo(filepath.Join(*root, *config))
	if err != nil {
		return err
	}
	numeric, err := numericVersion(*version)
	if err != nil {
		return err
	}
	return render(*root, *out, values{info: i, BinaryName: binaryName, Version: numeric})
}

func main() {
	log.SetFlags(0)
	if err := run(os.Args[1:]); err != nil {
		log.Fatalf("buildassets: %v", err)
	}
}
