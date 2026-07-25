package main

import (
	"embed"
	"log"
	"runtime"

	"klustr/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
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
