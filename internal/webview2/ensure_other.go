//go:build !windows

package webview2

// Ensure checks for the WebView2 runtime on Windows (ensure_windows.go). Other
// platforms ship their webview with the OS or the package dependencies.
func Ensure() error { return nil }
