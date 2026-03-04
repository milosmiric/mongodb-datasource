package plugin

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MongoClient defines the interface for MongoDB client operations.
// This interface enables dependency injection and testability.
type MongoClient interface {
	// Ping verifies the connection to MongoDB.
	Ping(ctx context.Context) error
	// ListDatabaseNames returns all accessible database names.
	ListDatabaseNames(ctx context.Context) ([]string, error)
	// ListCollectionNames returns all collection names in the given database.
	ListCollectionNames(ctx context.Context, database string) ([]string, error)
	// Aggregate executes an aggregation pipeline on the given database and collection.
	Aggregate(ctx context.Context, database, collection string, pipeline interface{}) ([]bson.D, error)
	// ServerVersion returns the MongoDB server version string.
	ServerVersion(ctx context.Context) (string, error)
	// ReplicaSetStatus returns the replica set name, or empty if not a replica set.
	ReplicaSetStatus(ctx context.Context) (string, error)
	// Disconnect closes the MongoDB connection.
	Disconnect(ctx context.Context) error
}

// DefaultMongoClient wraps the official MongoDB Go driver client.
type DefaultMongoClient struct {
	client *mongo.Client
}

// BuildClientOptions constructs MongoDB client options from datasource settings.
// It applies authentication credentials and TLS configuration based on the settings.
func BuildClientOptions(settings DatasourceSettings) (*options.ClientOptions, error) {
	clientOpts := options.Client().ApplyURI(settings.URI)

	if settings.AuthMechanism != "" {
		cred := options.Credential{
			AuthMechanism: settings.AuthMechanism,
		}
		if settings.AuthMechanism != "MONGODB-X509" {
			cred.Password = settings.Password
			cred.PasswordSet = true
		}
		clientOpts.SetAuth(cred)
	}

	if settings.TLSEnabled {
		tlsCfg := &tls.Config{}
		if settings.TLSCACert != "" {
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM([]byte(settings.TLSCACert)) {
				return nil, ErrInvalidCACert
			}
			tlsCfg.RootCAs = pool
		}
		clientOpts.SetTLSConfig(tlsCfg)
	}

	return clientOpts, nil
}

// NewDefaultMongoClient creates a new DefaultMongoClient from datasource settings.
func NewDefaultMongoClient(ctx context.Context, settings DatasourceSettings) (*DefaultMongoClient, error) {
	clientOpts, err := BuildClientOptions(settings)
	if err != nil {
		return nil, fmt.Errorf("building client options: %w", err)
	}

	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("connecting to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("pinging MongoDB: %w", err)
	}

	return &DefaultMongoClient{client: client}, nil
}

// Ping verifies the connection to MongoDB.
func (c *DefaultMongoClient) Ping(ctx context.Context) error {
	return c.client.Ping(ctx, nil)
}

// ListDatabaseNames returns all accessible database names.
func (c *DefaultMongoClient) ListDatabaseNames(ctx context.Context) ([]string, error) {
	result, err := c.client.ListDatabaseNames(ctx, bson.D{})
	if err != nil {
		return nil, fmt.Errorf("listing databases: %w", err)
	}
	return result, nil
}

// ListCollectionNames returns all collection names in the given database.
func (c *DefaultMongoClient) ListCollectionNames(ctx context.Context, database string) ([]string, error) {
	db := c.client.Database(database)
	result, err := db.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return nil, fmt.Errorf("listing collections in %q: %w", database, err)
	}
	return result, nil
}

// Aggregate executes an aggregation pipeline on the given database and collection.
func (c *DefaultMongoClient) Aggregate(ctx context.Context, database, collection string, pipeline interface{}) ([]bson.D, error) {
	coll := c.client.Database(database).Collection(collection)
	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("running aggregation: %w", err)
	}
	defer cursor.Close(ctx)

	var results []bson.D
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("reading aggregation results: %w", err)
	}

	return results, nil
}

// ServerVersion returns the MongoDB server version string.
func (c *DefaultMongoClient) ServerVersion(ctx context.Context) (string, error) {
	var result bson.M
	err := c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "buildInfo", Value: 1}}).Decode(&result)
	if err != nil {
		return "", fmt.Errorf("getting server version: %w", err)
	}
	version, ok := result["version"].(string)
	if !ok {
		return "unknown", nil
	}
	return version, nil
}

// ReplicaSetStatus returns the replica set name, or empty string if not a replica set.
func (c *DefaultMongoClient) ReplicaSetStatus(ctx context.Context) (string, error) {
	var result bson.M
	err := c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "replSetGetStatus", Value: 1}}).Decode(&result)
	if err != nil {
		// Not a replica set or insufficient permissions — not an error.
		return "", nil
	}
	setName, _ := result["set"].(string)
	return setName, nil
}

// Disconnect closes the MongoDB connection.
func (c *DefaultMongoClient) Disconnect(ctx context.Context) error {
	return c.client.Disconnect(ctx)
}

// Datasource implements the Grafana backend datasource interfaces.
type Datasource struct {
	settings DatasourceSettings
	client   MongoClient
}

// Ensure Datasource implements required interfaces.
var (
	_ backend.QueryDataHandler    = (*Datasource)(nil)
	_ backend.CheckHealthHandler  = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance. It is called by the instance
// manager when Grafana creates or updates a datasource configuration.
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	dsSettings, err := ParseDatasourceSettings(settings)
	if err != nil {
		return nil, fmt.Errorf("parsing datasource settings: %w", err)
	}

	client, err := NewDefaultMongoClient(ctx, dsSettings)
	if err != nil {
		log.DefaultLogger.Error("failed to create MongoDB client", "error", err)
		// Return the datasource anyway so it can report errors via health check.
		return &Datasource{settings: dsSettings, client: nil}, nil
	}

	log.DefaultLogger.Info("MongoDB datasource created", "database", dsSettings.Database)
	return &Datasource{settings: dsSettings, client: client}, nil
}

// newDatasourceWithClient creates a Datasource with an injected MongoClient (for testing).
func newDatasourceWithClient(settings DatasourceSettings, client MongoClient) *Datasource {
	return &Datasource{settings: settings, client: client}
}

// Dispose cleans up the datasource instance when it is no longer needed.
func (d *Datasource) Dispose() {
	if d.client != nil {
		if err := d.client.Disconnect(context.Background()); err != nil {
			log.DefaultLogger.Error("failed to disconnect MongoDB client", "error", err)
		}
		log.DefaultLogger.Info("MongoDB client disconnected")
	}
}

// QueryData handles multiple data queries within a single request.
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)
		response.Responses[q.RefID] = res
	}

	return response, nil
}

// CheckHealth verifies the MongoDB connection and returns server information.
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if d.client == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "MongoDB client not initialized. Check connection settings.",
		}, nil
	}

	if err := d.client.Ping(ctx); err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to ping MongoDB: %v", err),
		}, nil
	}

	version, err := d.client.ServerVersion(ctx)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Connected but failed to get server version: %v", err),
		}, nil
	}

	rsName, _ := d.client.ReplicaSetStatus(ctx)
	message := fmt.Sprintf("MongoDB connected. Server version: %s", version)
	if rsName != "" {
		message += fmt.Sprintf(". Replica set: %s", rsName)
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: message,
	}, nil
}

// RegisterRoutes registers HTTP resource routes for the datasource.
// These are called by the frontend to populate dropdowns.
func (d *Datasource) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/databases", d.handleDatabases)
	mux.HandleFunc("/collections", d.handleCollections)
}

// CallResource handles HTTP resource requests from the frontend.
// This method delegates to the registered routes.
func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	mux := http.NewServeMux()
	d.RegisterRoutes(mux)
	handler := httpadapter.New(mux)
	return handler.CallResource(ctx, req, sender)
}

// handleDatabases responds with a JSON array of database names.
func (d *Datasource) handleDatabases(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if d.client == nil {
		http.Error(w, "MongoDB client not initialized", http.StatusServiceUnavailable)
		return
	}

	databases, err := d.client.ListDatabaseNames(ctx)
	if err != nil {
		log.DefaultLogger.Error("failed to list databases", "error", err)
		http.Error(w, fmt.Sprintf("failed to list databases: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(databases); err != nil {
		log.DefaultLogger.Error("failed to encode databases response", "error", err)
	}
}

// handleCollections responds with a JSON array of collection names for the given database.
func (d *Datasource) handleCollections(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if d.client == nil {
		http.Error(w, "MongoDB client not initialized", http.StatusServiceUnavailable)
		return
	}

	database := r.URL.Query().Get("database")
	if database == "" {
		http.Error(w, "database query parameter is required", http.StatusBadRequest)
		return
	}

	collections, err := d.client.ListCollectionNames(ctx, database)
	if err != nil {
		log.DefaultLogger.Error("failed to list collections", "database", database, "error", err)
		http.Error(w, fmt.Sprintf("failed to list collections: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(collections); err != nil {
		log.DefaultLogger.Error("failed to encode collections response", "error", err)
	}
}
