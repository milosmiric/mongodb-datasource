// Package plugin implements the MongoDB datasource backend for Grafana.
//
// It provides query execution via MongoDB aggregation pipelines, connection
// management with pooling, and BSON-to-DataFrame type conversion. The plugin
// communicates with Grafana through the grafana-plugin-sdk-go gRPC interface.
package plugin
