package plugin

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// mockMongoClient is a test double for MongoClient.
type mockMongoClient struct {
	pingErr        error
	databases      []string
	dbErr          error
	collections    []string
	collErr        error
	aggregateData  []bson.D
	aggregateErr   error
	serverVersion  string
	versionErr     error
	replicaSet     string
	rsErr          error
	disconnectErr  error
}

func (m *mockMongoClient) Ping(_ context.Context) error {
	return m.pingErr
}

func (m *mockMongoClient) ListDatabaseNames(_ context.Context) ([]string, error) {
	return m.databases, m.dbErr
}

func (m *mockMongoClient) ListCollectionNames(_ context.Context, _ string) ([]string, error) {
	return m.collections, m.collErr
}

func (m *mockMongoClient) Aggregate(_ context.Context, _, _ string, _ interface{}) ([]bson.D, error) {
	return m.aggregateData, m.aggregateErr
}

func (m *mockMongoClient) ServerVersion(_ context.Context) (string, error) {
	return m.serverVersion, m.versionErr
}

func (m *mockMongoClient) ReplicaSetStatus(_ context.Context) (string, error) {
	return m.replicaSet, m.rsErr
}

func (m *mockMongoClient) Disconnect(_ context.Context) error {
	return m.disconnectErr
}

func TestBuildPipeline(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	tests := []struct {
		name    string
		input   string
		wantErr error
		wantLen int
	}{
		{
			name:    "valid simple pipeline",
			input:   `[{"$limit": 10}]`,
			wantLen: 1,
		},
		{
			name:    "multi-stage pipeline",
			input:   `[{"$match": {"status": "active"}}, {"$group": {"_id": "$type", "count": {"$sum": 1}}}]`,
			wantLen: 2,
		},
		{
			name:    "empty string returns error",
			input:   "",
			wantErr: ErrEmptyPipeline,
		},
		{
			name:    "whitespace only returns error",
			input:   "   ",
			wantErr: ErrEmptyPipeline,
		},
		{
			name:    "invalid JSON returns error",
			input:   "not json",
			wantErr: ErrInvalidPipeline,
		},
		{
			name:    "empty array returns error",
			input:   "[]",
			wantErr: ErrEmptyPipeline,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := buildPipeline(tt.input, tr)
			if tt.wantErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Len(t, result, tt.wantLen)
		})
	}
}

func TestInterpolateVariables(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{
			name:   "replaces $__from_ms",
			input:  `{"ts": {"$gte": $__from_ms}}`,
			expect: `{"ts": {"$gte": 1704067200000}}`,
		},
		{
			name:   "replaces $__to_ms",
			input:  `{"ts": {"$lte": $__to_ms}}`,
			expect: `{"ts": {"$lte": 1704153600000}}`,
		},
		{
			name:   "replaces ${__from_ms} braced syntax",
			input:  `{"ts": {"$gte": ${__from_ms}}}`,
			expect: `{"ts": {"$gte": 1704067200000}}`,
		},
		{
			name:   "no variables unchanged",
			input:  `{"$limit": 10}`,
			expect: `{"$limit": 10}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := interpolateVariables(tt.input, tr)
			assert.Equal(t, tt.expect, result)
		})
	}
}

func TestQuery_Success(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Millisecond)

	client := &mockMongoClient{
		aggregateData: []bson.D{
			{{Key: "timestamp", Value: now}, {Key: "value", Value: 42.0}, {Key: "sensor", Value: "temp1"}},
			{{Key: "timestamp", Value: now.Add(time.Minute)}, {Key: "value", Value: 43.5}, {Key: "sensor", Value: "temp1"}},
		},
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	queryJSON, _ := json.Marshal(QueryModel{
		Database:   "demo",
		Collection: "sensors",
		Pipeline:   `[{"$limit": 10}]`,
		TimeField:  "timestamp",
		Format:     QueryFormatTimeSeries,
	})

	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
		TimeRange: backend.TimeRange{
			From: now.Add(-time.Hour),
			To:   now.Add(time.Hour),
		},
	})

	require.NoError(t, resp.Error)
	require.Len(t, resp.Frames, 1)
	assert.Equal(t, "A", resp.Frames[0].Name)
	assert.Len(t, resp.Frames[0].Fields, 3) // timestamp, value, sensor
}

func TestQuery_MissingDatabase(t *testing.T) {
	client := &mockMongoClient{}
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	queryJSON, _ := json.Marshal(QueryModel{
		Collection: "sensors",
		Pipeline:   `[{"$limit": 10}]`,
	})

	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
	})

	require.Error(t, resp.Error)
	assert.ErrorIs(t, resp.Error, ErrMissingDatabase)
}

func TestQuery_NilClient(t *testing.T) {
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, nil)

	queryJSON, _ := json.Marshal(QueryModel{
		Database:   "demo",
		Collection: "sensors",
		Pipeline:   `[{"$limit": 10}]`,
	})

	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
	})

	require.Error(t, resp.Error)
	assert.ErrorIs(t, resp.Error, ErrConnectionFailed)
}

func TestQuery_AggregateError(t *testing.T) {
	client := &mockMongoClient{
		aggregateErr: assert.AnError,
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	queryJSON, _ := json.Marshal(QueryModel{
		Database:   "demo",
		Collection: "sensors",
		Pipeline:   `[{"$limit": 10}]`,
	})

	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
	})

	require.Error(t, resp.Error)
	assert.ErrorIs(t, resp.Error, ErrQueryFailed)
}
