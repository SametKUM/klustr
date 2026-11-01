package main

import (
	"embed"
	"io/fs"
	"log"

	"klustr/app"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
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
