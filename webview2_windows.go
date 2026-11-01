//go:build windows

package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// The dialog text Wails v2 showed when the runtime was missing or too old.
const (
	webView2InstallationRequired = "The WebView2 runtime is required. Press Ok to download and install. Note: The installer will download silently so please wait."
	webView2UpdateRequired       = "The WebView2 runtime needs updating. Press Ok to download and install. Note: The installer will download silently so please wait."
	webView2MissingRequirements  = "Missing Requirements"
	webView2NotInstalled         = "WebView2 runtime not installed"
	webView2FailedToInstall      = "The runtime failed to install correctly. Please try again."
)

// idOK is what MessageBox returns for the OK button.
const idOK = 1

// ensureWebView2 keeps the start-up check Wails v2 made on Windows. Without a
// WebView2 runtime, Wails v3 opens a window that never loads. Like v2, this
// offers to download and run Microsoft's bootstrapper when the runtime is
// missing or older than minimumWebView2, and fails when the user declines.
func ensureWebView2() error {
	installed, found := installedWebView2()
	if found {
		if cmp, ok := compareVersions(installed, minimumWebView2); ok && cmp >= 0 {
			return nil
		}
	}
	message := webView2InstallationRequired
	if found {
		message = webView2UpdateRequired
	}
	if messageBox(message, webView2MissingRequirements, windows.MB_OKCANCEL) != idOK {
		return errors.New(webView2NotInstalled)
	}
	if err := installWebView2(); err != nil {
		text := err.Error()
		if errors.Is(err, errInstallerFailed) {
			text = webView2FailedToInstall
		}
		messageBox(text, "Error", windows.MB_OK|windows.MB_ICONERROR)
		return err
	}
	return nil
}

var errInstallerFailed = errors.New("the WebView2 runtime installer failed")

// webView2Channels are the EdgeUpdate client ids of the WebView2 runtime
// channels, stable first, the ones the WebView2 loader searches.
var webView2Channels = []string{
	"{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
	"{2CD8A007-E189-409D-A2C8-9AF4EF3C72AA}",
	"{0D50BFEC-CD6A-4F9A-964C-C7416E3ACB10}",
	"{65C35B14-6C1D-4122-AC46-7148CC9D6497}",
}

// installedWebView2 finds the runtime the way the WebView2 loader in Wails v3
// does: EdgeUpdate's EBWebView value per channel, machine-wide then per user.
// The folder that value names is the runtime's version.
func installedWebView2() (version string, found bool) {
	newest := ""
	for _, channel := range webView2Channels {
		for _, root := range []registry.Key{registry.LOCAL_MACHINE, registry.CURRENT_USER} {
			key, err := registry.OpenKey(root, `Software\Microsoft\EdgeUpdate\ClientState\`+channel,
				registry.READ|registry.WOW64_32KEY)
			if err != nil {
				continue
			}
			folder, _, err := key.GetStringValue("EBWebView")
			_ = key.Close()
			if err != nil || folder == "" {
				continue
			}
			v := filepath.Base(folder)
			if _, ok := parseVersion(v); !ok {
				continue
			}
			if cmp, _ := compareVersions(v, newest); newest == "" || cmp > 0 {
				newest = v
			}
		}
	}
	return newest, newest != ""
}

// installWebView2 downloads Microsoft's Evergreen bootstrapper, as Wails v2
// did, and runs it to completion.
func installWebView2() error {
	const bootstrapperURL = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

	installer, err := os.CreateTemp("", "MicrosoftEdgeWebview2Setup-*.exe")
	if err != nil {
		return err
	}
	path := installer.Name()
	defer func() { _ = os.Remove(path) }()

	resp, err := http.Get(bootstrapperURL)
	if err != nil {
		_ = installer.Close()
		return fmt.Errorf("download the WebView2 runtime: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_ = installer.Close()
		return fmt.Errorf("download the WebView2 runtime: %s", resp.Status)
	}
	if _, err := io.Copy(installer, resp.Body); err != nil {
		_ = installer.Close()
		return fmt.Errorf("download the WebView2 runtime: %w", err)
	}
	if err := installer.Close(); err != nil {
		return err
	}

	if err := exec.Command(path).Run(); err != nil {
		return fmt.Errorf("%w: %w", errInstallerFailed, err)
	}
	return nil
}

func messageBox(text, caption string, style uint32) int32 {
	t, _ := windows.UTF16PtrFromString(text)
	c, _ := windows.UTF16PtrFromString(caption)
	ret, _ := windows.MessageBox(0, t, c, style)
	return ret
}
