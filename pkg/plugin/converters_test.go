package plugin

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestConvertDocumentsToFrame_EmptyDocs(t *testing.T) {
	frame, err := ConvertDocumentsToFrame("test", []bson.D{}, "")
	require.NoError(t, err)
	assert.Equal(t, "test", frame.Name)
	assert.Empty(t, frame.Fields)
}

func TestConvertDocumentsToFrame_AllBSONTypes(t *testing.T) {
	now := time.Date(2024, 6, 15, 12, 0, 0, 0, time.UTC)
	oid := bson.NewObjectID()
	dec128, _ := bson.ParseDecimal128("12345.6789")

	docs := []bson.D{
		{
			{Key: "_id", Value: oid},
			{Key: "string", Value: "hello"},
			{Key: "int32", Value: int32(42)},
			{Key: "int64", Value: int64(9999999999)},
			{Key: "double", Value: 3.14},
			{Key: "bool", Value: true},
			{Key: "date", Value: now},
			{Key: "decimal", Value: dec128},
			{Key: "null", Value: nil},
			{Key: "array", Value: bson.A{"a", "b"}},
			{Key: "embedded", Value: bson.D{{Key: "key", Value: "value"}}},
		},
	}

	frame, err := ConvertDocumentsToFrame("result", docs, "")
	require.NoError(t, err)
	require.NotNil(t, frame)
	assert.Equal(t, "result", frame.Name)

	// Verify field count matches document keys.
	assert.Len(t, frame.Fields, 11)

	// Verify field order matches document order.
	expectedOrder := []string{"_id", "string", "int32", "int64", "double", "bool", "date", "decimal", "null", "array", "embedded"}
	for i, name := range expectedOrder {
		assert.Equal(t, name, frame.Fields[i].Name, "field %d should be %q", i, name)
	}

	// Verify specific conversions by name.
	fieldByName := make(map[string]*data.Field)
	for _, f := range frame.Fields {
		fieldByName[f.Name] = f
	}

	// ObjectID -> string
	idField := fieldByName["_id"]
	require.NotNil(t, idField)
	val, ok := idField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, oid.Hex(), val)

	// string -> string
	strField := fieldByName["string"]
	require.NotNil(t, strField)
	val, ok = strField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, "hello", val)

	// int32 -> float64
	i32Field := fieldByName["int32"]
	require.NotNil(t, i32Field)
	val, ok = i32Field.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, float64(42), val)

	// int64 -> float64
	i64Field := fieldByName["int64"]
	require.NotNil(t, i64Field)
	val, ok = i64Field.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, float64(9999999999), val)

	// double -> float64
	dblField := fieldByName["double"]
	require.NotNil(t, dblField)
	val, ok = dblField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, 3.14, val)

	// bool -> bool
	boolField := fieldByName["bool"]
	require.NotNil(t, boolField)
	val, ok = boolField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, true, val)

	// Date -> time
	dateField := fieldByName["date"]
	require.NotNil(t, dateField)
	val, ok = dateField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, now, val)

	// null -> nil (nullable)
	nullField := fieldByName["null"]
	require.NotNil(t, nullField)
	_, ok = nullField.ConcreteAt(0)
	assert.False(t, ok) // nil value

	// array -> JSON string
	arrField := fieldByName["array"]
	require.NotNil(t, arrField)
	val, ok = arrField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, `["a","b"]`, val)

	// embedded doc -> JSON string
	embField := fieldByName["embedded"]
	require.NotNil(t, embField)
	val, ok = embField.ConcreteAt(0)
	require.True(t, ok)
	assert.Contains(t, val.(string), "key")
}

func TestConvertDocumentsToFrame_TimeField(t *testing.T) {
	now := time.Date(2024, 6, 15, 12, 0, 0, 0, time.UTC)

	docs := []bson.D{
		{{Key: "timestamp", Value: now}, {Key: "value", Value: 42.0}},
		{{Key: "timestamp", Value: now.Add(time.Hour)}, {Key: "value", Value: 43.0}},
	}

	frame, err := ConvertDocumentsToFrame("ts", docs, "timestamp")
	require.NoError(t, err)
	require.NotNil(t, frame)

	// Verify field order.
	require.Len(t, frame.Fields, 2)
	assert.Equal(t, "timestamp", frame.Fields[0].Name)
	assert.Equal(t, "value", frame.Fields[1].Name)

	tsField := frame.Fields[0]
	val, ok := tsField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, now, val)

	val, ok = tsField.ConcreteAt(1)
	require.True(t, ok)
	assert.Equal(t, now.Add(time.Hour), val)
}

func TestConvertDocumentsToFrame_SparseDocs(t *testing.T) {
	docs := []bson.D{
		{{Key: "a", Value: "x"}, {Key: "b", Value: int32(1)}},
		{{Key: "a", Value: "y"}, {Key: "c", Value: true}},
		{{Key: "b", Value: int32(3)}, {Key: "c", Value: false}},
	}

	frame, err := ConvertDocumentsToFrame("sparse", docs, "")
	require.NoError(t, err)
	require.NotNil(t, frame)

	// Should have 3 fields: a, b, c (in first-seen order).
	require.Len(t, frame.Fields, 3)
	assert.Equal(t, "a", frame.Fields[0].Name)
	assert.Equal(t, "b", frame.Fields[1].Name)
	assert.Equal(t, "c", frame.Fields[2].Name)

	// Check that missing values are nil.
	fieldByName := make(map[string]*data.Field)
	for _, f := range frame.Fields {
		fieldByName[f.Name] = f
	}

	// Row 0: "c" missing
	_, ok := fieldByName["c"].ConcreteAt(0)
	assert.False(t, ok)

	// Row 1: "b" missing
	_, ok = fieldByName["b"].ConcreteAt(1)
	assert.False(t, ok)

	// Row 2: "a" missing
	_, ok = fieldByName["a"].ConcreteAt(2)
	assert.False(t, ok)
}

func TestConvertDocumentsToFrame_BSONDateTime(t *testing.T) {
	bsonDate := bson.NewDateTimeFromTime(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

	docs := []bson.D{
		{{Key: "ts", Value: bsonDate}, {Key: "val", Value: 1.0}},
	}

	frame, err := ConvertDocumentsToFrame("bsondate", docs, "ts")
	require.NoError(t, err)

	require.Len(t, frame.Fields, 2)
	assert.Equal(t, "ts", frame.Fields[0].Name)

	tsField := frame.Fields[0]
	val, ok := tsField.ConcreteAt(0)
	require.True(t, ok)
	assert.Equal(t, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), val)
}

func TestConvertDocumentsToFrame_FieldOrderPreserved(t *testing.T) {
	// Run multiple times to confirm order is deterministic (not random like bson.M).
	for i := 0; i < 10; i++ {
		docs := []bson.D{
			{
				{Key: "zebra", Value: "z"},
				{Key: "alpha", Value: "a"},
				{Key: "middle", Value: "m"},
			},
		}

		frame, err := ConvertDocumentsToFrame("order", docs, "")
		require.NoError(t, err)
		require.Len(t, frame.Fields, 3)
		assert.Equal(t, "zebra", frame.Fields[0].Name)
		assert.Equal(t, "alpha", frame.Fields[1].Name)
		assert.Equal(t, "middle", frame.Fields[2].Name)
	}
}

func TestToString(t *testing.T) {
	tests := []struct {
		name string
		val  interface{}
		want string
	}{
		{"string", "hello", "hello"},
		{"objectid", bson.NewObjectID(), ""}, // just check no panic
		{"bool true", true, "true"},
		{"bool false", false, "false"},
		{"nil", nil, ""},
		{"int slice", []int{1, 2, 3}, "[1,2,3]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := toString(tt.val)
			if tt.name == "objectid" {
				assert.Len(t, result, 24) // ObjectID hex is 24 chars
				return
			}
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestToFloat64(t *testing.T) {
	tests := []struct {
		name    string
		val     interface{}
		want    float64
		wantErr bool
	}{
		{"float64", float64(3.14), 3.14, false},
		{"float32", float32(2.5), 2.5, false},
		{"int32", int32(42), 42.0, false},
		{"int64", int64(100), 100.0, false},
		{"int", int(7), 7.0, false},
		{"string fails", "nope", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := toFloat64(tt.val)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.InDelta(t, tt.want, result, 0.01)
		})
	}
}

func TestToTime(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Millisecond)

	tests := []struct {
		name    string
		val     interface{}
		want    time.Time
		wantErr bool
	}{
		{"time.Time", now, now, false},
		{"bson.DateTime", bson.NewDateTimeFromTime(now), now, false},
		{"string fails", "not a time", time.Time{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := toTime(tt.val)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, result)
		})
	}
}
