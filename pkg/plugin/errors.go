package plugin

import "errors"

// Sentinel errors for the MongoDB datasource plugin.
var (
	// ErrMissingConnectionURI indicates the datasource configuration has no connection URI.
	ErrMissingConnectionURI = errors.New("connection URI is required")

	// ErrMissingDatabase indicates no database was specified in the query.
	ErrMissingDatabase = errors.New("database is required")

	// ErrMissingCollection indicates no collection was specified in the query.
	ErrMissingCollection = errors.New("collection is required")

	// ErrInvalidPipeline indicates the aggregation pipeline JSON is malformed.
	ErrInvalidPipeline = errors.New("invalid aggregation pipeline JSON")

	// ErrEmptyPipeline indicates an empty aggregation pipeline was provided.
	ErrEmptyPipeline = errors.New("aggregation pipeline must not be empty")

	// ErrConnectionFailed indicates the plugin could not connect to MongoDB.
	ErrConnectionFailed = errors.New("failed to connect to MongoDB")

	// ErrQueryFailed indicates the aggregation query execution failed.
	ErrQueryFailed = errors.New("query execution failed")

	// ErrHealthCheckFailed indicates the health check could not complete.
	ErrHealthCheckFailed = errors.New("health check failed")

	// ErrUnsupportedBSONType indicates a BSON type that cannot be converted to a DataFrame value.
	ErrUnsupportedBSONType = errors.New("unsupported BSON type")

	// ErrInvalidCACert indicates the CA certificate PEM could not be parsed.
	ErrInvalidCACert = errors.New("failed to parse CA certificate PEM")
)
