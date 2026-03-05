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
	pingErr       error
	databases     []string
	dbErr         error
	collections   []string
	collErr       error
	aggregateData []bson.D
	aggregateErr  error
	serverVersion string
	versionErr    error
	replicaSet    string
	rsErr         error
	disconnectErr error
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

// newTestQuery creates a backend.DataQuery with sensible defaults for testing.
func newTestQuery(timeRange backend.TimeRange) backend.DataQuery {
	return backend.DataQuery{
		TimeRange:     timeRange,
		MaxDataPoints: 100,
	}
}

func TestBuildPipeline(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}
	q := newTestQuery(tr)

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
		{
			name:    "pipeline with macros and $__match",
			input:   `[{"$__match": {"sensor": "temperature"}}, {"$match": {$__timeFilter(timestamp)}}, {"$limit": 10}]`,
			wantLen: 3,
		},
		{
			name:    "$__match with $__all drops stage",
			input:   `[{"$__match": {"sensor": "$__all"}}, {"$limit": 10}]`,
			wantLen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := buildPipeline(tt.input, q)
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

func TestComputeIntervalUnit(t *testing.T) {
	tests := []struct {
		name       string
		intervalMs int64
		wantUnit   string
		wantBin    int64
	}{
		{"500ms → second/1", 500, "second", 1},
		{"5000ms → second/5", 5000, "second", 5},
		{"30000ms → second/30", 30000, "second", 30},
		{"60000ms → minute/1", 60000, "minute", 1},
		{"300000ms → minute/5", 300000, "minute", 5},
		{"3600000ms → hour/1", 3600000, "hour", 1},
		{"7200000ms → hour/2", 7200000, "hour", 2},
		{"86400000ms → day/1", 86400000, "day", 1},
		{"604800000ms → day/7", 604800000, "day", 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unit, binSize := computeIntervalUnit(tt.intervalMs)
			assert.Equal(t, tt.wantUnit, unit)
			assert.Equal(t, tt.wantBin, binSize)
		})
	}
}

func TestGenerateObjectIDHex(t *testing.T) {
	ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	// 2024-01-01T00:00:00Z → Unix timestamp 1704067200 → hex 65920080
	fromOid := generateObjectIDHex(ts, "00")
	assert.Equal(t, `{"$oid":"659200800000000000000000"}`, fromOid)

	toOid := generateObjectIDHex(ts, "ff")
	assert.Equal(t, `{"$oid":"65920080ffffffffffffffff"}`, toOid)
}

func TestInterpolateVariables(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	tests := []struct {
		name     string
		input    string
		query    backend.DataQuery
		expect   string
		contains string // use when exact match is hard
	}{
		{
			name:   "replaces $__from_ms",
			input:  `{"ts": {"$gte": $__from_ms}}`,
			query:  newTestQuery(tr),
			expect: `{"ts": {"$gte": 1704067200000}}`,
		},
		{
			name:   "replaces $__to_ms",
			input:  `{"ts": {"$lte": $__to_ms}}`,
			query:  newTestQuery(tr),
			expect: `{"ts": {"$lte": 1704153600000}}`,
		},
		{
			name:   "replaces ${__from_ms} braced syntax",
			input:  `{"ts": {"$gte": ${__from_ms}}}`,
			query:  newTestQuery(tr),
			expect: `{"ts": {"$gte": 1704067200000}}`,
		},
		{
			name:   "no variables unchanged",
			input:  `{"$limit": 10}`,
			query:  newTestQuery(tr),
			expect: `{"$limit": 10}`,
		},
		{
			name:   "replaces $__from_s",
			input:  `{"ts": $__from_s}`,
			query:  newTestQuery(tr),
			expect: `{"ts": 1704067200}`,
		},
		{
			name:   "replaces $__to_s",
			input:  `{"ts": $__to_s}`,
			query:  newTestQuery(tr),
			expect: `{"ts": 1704153600}`,
		},
		{
			name:   "replaces $__from_oid",
			input:  `{"_id": {"$gte": $__from_oid}}`,
			query:  newTestQuery(tr),
			expect: `{"_id": {"$gte": {"$oid":"659200800000000000000000"}}}`,
		},
		{
			name:   "replaces $__to_oid",
			input:  `{"_id": {"$lte": $__to_oid}}`,
			query:  newTestQuery(tr),
			expect: `{"_id": {"$lte": {"$oid":"65935200ffffffffffffffff"}}}`,
		},
		{
			name:   "replaces $__range_ms",
			input:  `{"range": $__range_ms}`,
			query:  newTestQuery(tr),
			expect: `{"range": 86400000}`,
		},
		{
			name:   "replaces $__range_s",
			input:  `{"range": $__range_s}`,
			query:  newTestQuery(tr),
			expect: `{"range": 86400}`,
		},
		{
			name:   "replaces $__maxDataPoints default",
			input:  `{"n": $__maxDataPoints}`,
			query:  newTestQuery(tr),
			expect: `{"n": 100}`,
		},
		{
			name: "replaces $__maxDataPoints custom",
			input: `{"n": $__maxDataPoints}`,
			query: backend.DataQuery{
				TimeRange:     tr,
				MaxDataPoints: 500,
			},
			expect: `{"n": 500}`,
		},
		{
			name:     "replaces $__interval_unit",
			input:    `{"unit": $__interval_unit}`,
			query:    newTestQuery(tr),
			contains: `"unit": "`,
		},
		{
			name:     "replaces $__interval_binSize",
			input:    `{"binSize": $__interval_binSize}`,
			query:    newTestQuery(tr),
			contains: `"binSize": `,
		},
		{
			name:   "$__from_s not partially matched by $__from",
			input:  `{"a": $__from_s, "b": $__from}`,
			query:  newTestQuery(tr),
			expect: `{"a": 1704067200, "b": {"$date":"2024-01-01T00:00:00Z"}}`,
		},
		{
			name:   "bare $__all gets quoted",
			input:  `{"sensor": $__all}`,
			query:  newTestQuery(tr),
			expect: `{"sensor": "$__all"}`,
		},
		{
			name:   "already quoted $__all stays quoted",
			input:  `{"sensor": "$__all"}`,
			query:  newTestQuery(tr),
			expect: `{"sensor": "$__all"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := interpolateVariables(tt.input, tt.query)
			if tt.expect != "" {
				assert.Equal(t, tt.expect, result)
			}
			if tt.contains != "" {
				assert.Contains(t, result, tt.contains)
			}
		})
	}
}

func TestExpandMacros(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	tests := []struct {
		name     string
		input    string
		wantErr  error
		contains []string
	}{
		{
			name:  "$__timeFilter expands to date range",
			input: `[{"$match": {$__timeFilter(ts)}}]`,
			contains: []string{
				`"ts"`,
				`"$gte"`,
				`"$lte"`,
				`"$date"`,
			},
		},
		{
			name:  "$__timeFilter_ms expands to epoch ms range",
			input: `[{"$match": {$__timeFilter_ms(ts_ms)}}]`,
			contains: []string{
				`"ts_ms"`,
				`1704067200000`,
				`1704153600000`,
			},
		},
		{
			name:  "$__oidFilter expands to ObjectId range",
			input: `[{"$match": {$__oidFilter(_id)}}]`,
			contains: []string{
				`"_id"`,
				`{"$oid":"65920080`,
				`{"$oid":"65935200`,
			},
		},
		{
			name:  "$__timeGroup expands to $dateTrunc",
			input: `{"_id": $__timeGroup(timestamp)}`,
			contains: []string{
				`"$dateTrunc"`,
				`"$timestamp"`,
				`"unit"`,
				`"binSize"`,
			},
		},
		{
			name:  "multiple macros in one pipeline",
			input: `[{"$match": {$__timeFilter(ts)}}, {"$group": {"_id": $__timeGroup(ts)}}]`,
			contains: []string{
				`"ts"`,
				`"$dateTrunc"`,
			},
		},
		{
			name:  "no macros unchanged",
			input: `[{"$limit": 10}]`,
			contains: []string{
				`[{"$limit": 10}]`,
			},
		},
		{
			name:    "empty field name returns error",
			input:   `[{"$match": {$__timeFilter()}}]`,
			wantErr: ErrInvalidMacro,
		},
		{
			name:    "whitespace-only field name returns error",
			input:   `[{"$match": {$__timeFilter(  )}}]`,
			wantErr: ErrInvalidMacro,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := expandMacros(tt.input, tr)
			if tt.wantErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			for _, c := range tt.contains {
				assert.Contains(t, result, c)
			}
		})
	}
}

func TestProcessCustomStages(t *testing.T) {
	tests := []struct {
		name    string
		input   []bson.D
		wantLen int
		check   func(t *testing.T, result []bson.D)
	}{
		{
			name: "single string value → exact $match",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{{Key: "sensor", Value: "temperature"}}}},
			},
			wantLen: 1,
			check: func(t *testing.T, result []bson.D) {
				assert.Equal(t, "$match", result[0][0].Key)
				matchDoc := result[0][0].Value.(bson.D)
				assert.Equal(t, "sensor", matchDoc[0].Key)
				assert.Equal(t, "temperature", matchDoc[0].Value)
			},
		},
		{
			name: "array value → $in conversion",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{{Key: "sensor", Value: bson.A{"temperature", "humidity"}}}}},
			},
			wantLen: 1,
			check: func(t *testing.T, result []bson.D) {
				assert.Equal(t, "$match", result[0][0].Key)
				matchDoc := result[0][0].Value.(bson.D)
				inDoc := matchDoc[0].Value.(bson.D)
				assert.Equal(t, "$in", inDoc[0].Key)
				arr := inDoc[0].Value.(bson.A)
				assert.Len(t, arr, 2)
			},
		},
		{
			name: "$__all string → field removed, stage dropped",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{{Key: "sensor", Value: "$__all"}}}},
			},
			wantLen: 0,
		},
		{
			name: "partial $__all — some fields all, some not",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{
					{Key: "sensor", Value: "$__all"},
					{Key: "location", Value: "building_a"},
				}}},
			},
			wantLen: 1,
			check: func(t *testing.T, result []bson.D) {
				matchDoc := result[0][0].Value.(bson.D)
				assert.Len(t, matchDoc, 1)
				assert.Equal(t, "location", matchDoc[0].Key)
				assert.Equal(t, "building_a", matchDoc[0].Value)
			},
		},
		{
			name: "all fields $__all → stage dropped entirely",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{
					{Key: "sensor", Value: "$__all"},
					{Key: "location", Value: "$__all"},
				}}},
			},
			wantLen: 0,
		},
		{
			name: "preserves non-$__match stages",
			input: []bson.D{
				{{Key: "$match", Value: bson.D{{Key: "status", Value: "active"}}}},
				{{Key: "$limit", Value: int32(10)}},
			},
			wantLen: 2,
			check: func(t *testing.T, result []bson.D) {
				assert.Equal(t, "$match", result[0][0].Key)
				assert.Equal(t, "$limit", result[1][0].Key)
			},
		},
		{
			name: "mixed $__match + regular $match stages",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{{Key: "sensor", Value: "temperature"}}}},
				{{Key: "$match", Value: bson.D{{Key: "status", Value: "active"}}}},
				{{Key: "$limit", Value: int32(10)}},
			},
			wantLen: 3,
			check: func(t *testing.T, result []bson.D) {
				assert.Equal(t, "$match", result[0][0].Key)
				assert.Equal(t, "$match", result[1][0].Key)
			},
		},
		{
			name: "numeric value → exact match preserved",
			input: []bson.D{
				{{Key: "$__match", Value: bson.D{{Key: "count", Value: int32(42)}}}},
			},
			wantLen: 1,
			check: func(t *testing.T, result []bson.D) {
				matchDoc := result[0][0].Value.(bson.D)
				assert.Equal(t, int32(42), matchDoc[0].Value)
			},
		},
		{
			name:    "no custom stages → unchanged",
			input:   []bson.D{{{Key: "$limit", Value: int32(5)}}},
			wantLen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := processCustomStages(tt.input)
			assert.Len(t, result, tt.wantLen)
			if tt.check != nil {
				tt.check(t, result)
			}
		})
	}
}

func TestInterpolateVariables_IntervalUnit(t *testing.T) {
	// 24h range / 100 data points = 864000ms interval → "minute", 15
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}
	q := newTestQuery(tr)

	result := interpolateVariables(`$__interval_unit`, q)
	assert.Equal(t, `"minute"`, result)

	result = interpolateVariables(`$__interval_binSize`, q)
	assert.Equal(t, "15", result)
}

func TestExpandMacros_TimeGroup_Uses_Range_Interval(t *testing.T) {
	// Verify $__timeGroup expands using the time range.
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	result, err := expandMacros(`$__timeGroup(ts)`, tr)
	require.NoError(t, err)
	assert.Contains(t, result, `"$dateTrunc"`)
	assert.Contains(t, result, `"$ts"`)
	assert.Contains(t, result, `"unit"`)
	assert.Contains(t, result, `"binSize"`)
}

func TestBuildPipeline_Integration_Macros_And_Match(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}
	q := backend.DataQuery{
		TimeRange:     tr,
		MaxDataPoints: 100,
	}

	pipeline := `[{"$__match": {"sensor": "temperature"}}, {"$match": {$__timeFilter(timestamp)}}, {"$sort": {"timestamp": 1}}]`
	result, err := buildPipeline(pipeline, q)
	require.NoError(t, err)
	assert.Len(t, result, 3)

	// First stage should be converted to $match.
	assert.Equal(t, "$match", result[0][0].Key)
	// Second stage should have expanded time filter.
	assert.Equal(t, "$match", result[1][0].Key)
	// Third stage should be sort.
	assert.Equal(t, "$sort", result[2][0].Key)
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

func TestExpandMacros_FullPipelineValidJSON(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	// Test that $__timeFilter_ms produces valid JSON that can be parsed.
	input := `[{"$match": {$__timeFilter_ms(ts)}}]`
	result, err := expandMacros(input, tr)
	require.NoError(t, err)

	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)
	assert.Len(t, parsed, 1)
}

func TestInterpolateVariables_BracedSyntax(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		To:   time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
	}
	q := newTestQuery(tr)

	// Verify braced syntax works for new variables too.
	result := interpolateVariables(`${__from_s}`, q)
	assert.Equal(t, "1704067200", result)

	result = interpolateVariables(`${__range_ms}`, q)
	assert.Equal(t, "86400000", result)

	result = interpolateVariables(`${__maxDataPoints}`, q)
	assert.Equal(t, "100", result)
}

func TestProcessCustomStages_EmptyPipeline(t *testing.T) {
	result := processCustomStages([]bson.D{})
	assert.Len(t, result, 0)
}
