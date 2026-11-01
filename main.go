package main

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"runtime"

	"klustr/app"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if err := ensureWebView2(); err != nil {
		log.Fatal(err)
	}

	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	a := app.New()
	wailsApp := application.New(application.Options{
		Name:     "Klustr",
		Services: []application.Service{application.NewService(a)},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(dist),
		},
		// Klustr is a single-window app: closing it quits, as it did on v2.
		Mac: application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true},
	})

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Klustr",
		URL:    startURL(),
		Width:  1280,
		Height: 800,
		// Esc closes dialogs and the inspector, so it must not also leave
		// full screen.
		Mac: application.MacWindow{DisableEscapeExitsFullscreen: true},
	})

	if err := wailsApp.Run(); err != nil {
		log.Fatal(err)
	}
}

// startURL keeps the page on the origin Wails v2 served it from. The webview
// keeps localStorage per origin, and the frontend stores its settings there
// (theme, table layouts, context tags and groups), so a new origin would
// start every upgraded user from scratch. On Linux and macOS v2 used
// wails://wails/ and v3 defaults to wails://localhost; v3 ignores the host
// when it serves assets. On Windows both use http://wails.localhost already.
// Under wails3 dev the page comes from Vite, whose origin it keeps.
func startURL() string {
	if runtime.GOOS == "windows" || os.Getenv("FRONTEND_DEVSERVER_URL") != "" {
		return ""
	}
	return "wails://wails/"
}
