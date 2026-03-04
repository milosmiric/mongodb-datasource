package plugin

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// QueryFormatType specifies the output format for query results.
type QueryFormatType string

const (
	// QueryFormatTable outputs data as a table frame.
	QueryFormatTable QueryFormatType = "table"
	// QueryFormatTimeSeries outputs data as time-series frames.
	QueryFormatTimeSeries QueryFormatType = "time_series"
)

// QueryModel represents the frontend query configuration sent to the backend.
type QueryModel struct {
	// Database is the MongoDB database to query.
	Database string `json:"database"`
	// Collection is the MongoDB collection to query.
	Collection string `json:"collection"`
	// Pipeline is the raw JSON aggregation pipeline.
	Pipeline string `json:"pipeline"`
	// TimeField is the document field to use as the time axis in time-series mode.
	TimeField string `json:"timeField"`
	// Format specifies the output format (table or time_series).
	Format QueryFormatType `json:"format"`
	// LegendFormat is an optional Go template string for time-series legend labels.
	LegendFormat string `json:"legendFormat"`
}

// DatasourceSettings holds the configuration for a MongoDB datasource instance.
type DatasourceSettings struct {
	// URI is the MongoDB connection string (e.g., mongodb://host:port).
	URI string `json:"uri"`
	// Database is the default database name.
	Database string `json:"database"`
	// IsSRV indicates whether the connection uses MongoDB+SRV protocol (Atlas).
	IsSRV bool `json:"isSrv"`
	// TLSEnabled indicates whether TLS is enabled for the connection.
	TLSEnabled bool `json:"tlsEnabled"`
	// TLSCACert is the PEM-encoded CA certificate for TLS connections.
	TLSCACert string `json:"tlsCaCert"`
	// AuthMechanism specifies the authentication mechanism (e.g., SCRAM-SHA-256).
	AuthMechanism string `json:"authMechanism"`
	// Username is the MongoDB username for SCRAM authentication.
	Username string `json:"username"`
	// Password is the MongoDB password extracted from secure JSON data.
	Password string `json:"-"`
	// TLSClientCert is the PEM-encoded client certificate for X.509 auth.
	TLSClientCert string `json:"-"`
	// TLSClientKey is the PEM-encoded client private key for X.509 auth.
	TLSClientKey string `json:"-"`
}

// ParseQueryModel parses a QueryModel from a Grafana DataQuery.
func ParseQueryModel(query backend.DataQuery) (QueryModel, error) {
	var model QueryModel
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return model, fmt.Errorf("failed to parse query model: %w", err)
	}

	if model.Database == "" {
		return model, ErrMissingDatabase
	}
	if model.Collection == "" {
		return model, ErrMissingCollection
	}
	if model.Format == "" {
		model.Format = QueryFormatTable
	}

	return model, nil
}

// ParseDatasourceSettings extracts DatasourceSettings from Grafana's datasource instance settings.
func ParseDatasourceSettings(settings backend.DataSourceInstanceSettings) (DatasourceSettings, error) {
	var dsSettings DatasourceSettings
	if err := json.Unmarshal(settings.JSONData, &dsSettings); err != nil {
		return dsSettings, fmt.Errorf("failed to parse datasource settings: %w", err)
	}

	// Extract secrets from secure JSON data.
	if password, ok := settings.DecryptedSecureJSONData["password"]; ok && password != "" {
		dsSettings.Password = password
	}
	if cert, ok := settings.DecryptedSecureJSONData["tlsClientCert"]; ok && cert != "" {
		dsSettings.TLSClientCert = cert
	}
	if key, ok := settings.DecryptedSecureJSONData["tlsClientKey"]; ok && key != "" {
		dsSettings.TLSClientKey = key
	}

	if dsSettings.URI == "" {
		// Build URI from secure data if provided.
		if uri, ok := settings.DecryptedSecureJSONData["uri"]; ok {
			dsSettings.URI = uri
		}
	}

	if dsSettings.URI == "" {
		return dsSettings, ErrMissingConnectionURI
	}

	return dsSettings, nil
}
