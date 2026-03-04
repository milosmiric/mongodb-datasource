// Package main is the entry point for the MongoDB datasource backend plugin.
// It starts the gRPC server that communicates with Grafana.
package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/milosmiric/mongodb-datasource/pkg/plugin"
)

func main() {
	if err := datasource.Manage("milosmiric-mongodb-datasource", plugin.NewDatasource, datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error("failed to start plugin", "error", err)
		os.Exit(1)
	}
}
