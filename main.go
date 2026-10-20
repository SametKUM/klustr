package main

import (
	"embed"
	"log"
	"runtime"

	"klustr/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	a := app.New()

	appOptions := &options.App{
		Title:  "Klustr",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  a.Startup,
		OnShutdown: a.Shutdown,
		Bind:       []interface{}{a},
		// Wails v2 enables the zoom (full-screen) button only when Mac options
		// are set; without them it stays greyed out. Esc closes dialogs and
		// the inspector, so it must not also leave full screen.
		Mac: &mac.Options{DisableEscapeExitsFullscreen: true},
	}
	if runtime.GOOS == "linux" {
		// Wails v2 otherwise locks GTK's maximum size to the startup monitor.
		appOptions.MaxWidth = 32767
		appOptions.MaxHeight = 32767
	}

	err := wails.Run(appOptions)
	if err != nil {
		log.Fatal(err)
	}
}
