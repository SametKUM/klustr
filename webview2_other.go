//go:build !windows

package main

// ensureWebView2 checks for the Windows WebView2 runtime (webview2_windows.go);
// other platforms ship their webview with the OS or the package dependencies.
func ensureWebView2() error { return nil }
