package plugin

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckHealth_Success(t *testing.T) {
	client := &mockMongoClient{
		serverVersion: "8.0.1",
		replicaSet:    "rs0",
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusOk, result.Status)
	assert.Contains(t, result.Message, "MongoDB connected")
	assert.Contains(t, result.Message, "8.0.1")
	assert.Contains(t, result.Message, "rs0")
}

func TestCheckHealth_NilClient(t *testing.T) {
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, nil)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "not initialized")
}

func TestCheckHealth_PingFails(t *testing.T) {
	client := &mockMongoClient{
		pingErr: errors.New("connection refused"),
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "ping")
}

func TestCheckHealth_NoReplicaSet(t *testing.T) {
	client := &mockMongoClient{
		serverVersion: "8.0.0",
		replicaSet:    "",
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusOk, result.Status)
	assert.NotContains(t, result.Message, "Replica set")
}

func TestDispose(t *testing.T) {
	client := &mockMongoClient{}
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	// Should not panic.
	ds.Dispose()
}

func TestDispose_NilClient(t *testing.T) {
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, nil)

	// Should not panic with nil client.
	ds.Dispose()
}

func TestQueryData_MultipleQueries(t *testing.T) {
	client := &mockMongoClient{
		aggregateData: nil,
		aggregateErr:  nil,
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	req := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				JSON:  []byte(`{"database":"db1","collection":"coll1","pipeline":"[{\"$limit\":5}]"}`),
			},
			{
				RefID: "B",
				JSON:  []byte(`{"database":"db2","collection":"coll2","pipeline":"[{\"$limit\":10}]"}`),
			},
		},
	}

	resp, err := ds.QueryData(context.Background(), req)
	require.NoError(t, err)
	assert.Len(t, resp.Responses, 2)
	assert.Contains(t, resp.Responses, "A")
	assert.Contains(t, resp.Responses, "B")
}
