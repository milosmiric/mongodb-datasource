package plugin

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// fieldByPath finds an inferred field by its path.
func fieldByPath(fields []FieldInfo, path string) (FieldInfo, bool) {
	for _, f := range fields {
		if f.Path == path {
			return f, true
		}
	}
	return FieldInfo{}, false
}

func TestParseSampleSize(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want int
	}{
		{"empty defaults", "", defaultSampleSize},
		{"valid", "50", 50},
		{"zero defaults", "0", defaultSampleSize},
		{"negative defaults", "-5", defaultSampleSize},
		{"garbage defaults", "abc", defaultSampleSize},
		{"over cap clamps", "100000", maxSampleSize},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, parseSampleSize(tt.raw))
		})
	}
}

func TestBsonTypeName(t *testing.T) {
	oid := bson.NewObjectID()
	dec, _ := bson.ParseDecimal128("1.5")
	tests := []struct {
		value interface{}
		want  string
	}{
		{nil, "null"},
		{true, "bool"},
		{int32(1), "int"},
		{int64(1), "long"},
		{1.5, "double"},
		{"hello", "string"},
		{oid, "objectId"},
		{dec, "decimal"},
		{bson.DateTime(0), "date"},
		{time.Now(), "date"},
		{bson.D{}, "object"},
		{bson.A{}, "array"},
		{bson.Binary{}, "binData"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, bsonTypeName(tt.value), "for %T", tt.value)
	}
}

// TestInferFields_SamplePath verifies the union of dotted/nested/array field
// paths across a heterogeneous sample, with types, frequency, and index ranking.
func TestInferFields_SamplePath(t *testing.T) {
	client := &mockMongoClient{
		indexedFields: []string{"_id", "sensor"},
		aggregateData: []bson.D{
			{
				{Key: "_id", Value: bson.NewObjectID()},
				{Key: "sensor", Value: "temperature"},
				{Key: "value", Value: 21.5},
				{Key: "meta", Value: bson.D{{Key: "region", Value: "eu"}}},
				{Key: "tags", Value: bson.A{
					bson.D{{Key: "k", Value: "color"}},
				}},
			},
			{
				{Key: "_id", Value: bson.NewObjectID()},
				{Key: "sensor", Value: "humidity"},
				// no "value" in this doc -> frequency 0.5
				{Key: "meta", Value: bson.D{{Key: "region", Value: "us"}}},
			},
		},
	}

	fields, err := InferFields(context.Background(), client, "demo", "readings", 100)
	require.NoError(t, err)

	// Nested + array-of-object dotted paths are surfaced.
	for _, p := range []string{"_id", "sensor", "value", "meta", "meta.region", "tags", "tags.k"} {
		_, ok := fieldByPath(fields, p)
		assert.True(t, ok, "expected field %q to be inferred", p)
	}

	sensor, _ := fieldByPath(fields, "sensor")
	assert.Equal(t, []string{"string"}, sensor.Types)
	assert.Equal(t, 1.0, sensor.Frequency)
	assert.True(t, sensor.Indexed)

	value, _ := fieldByPath(fields, "value")
	assert.Equal(t, []string{"double"}, value.Types)
	assert.InDelta(t, 0.5, value.Frequency, 0.0001)
	assert.False(t, value.Indexed)

	meta, _ := fieldByPath(fields, "meta")
	assert.Equal(t, []string{"object"}, meta.Types)

	// Indexed fields rank ahead of non-indexed ones.
	require.NotEmpty(t, fields)
	assert.True(t, fields[0].Indexed, "first field should be indexed")
}

// TestInferFields_MixedTypes verifies a field seen with different types reports
// all of them, sorted.
func TestInferFields_MixedTypes(t *testing.T) {
	client := &mockMongoClient{
		aggregateData: []bson.D{
			{{Key: "id", Value: int32(1)}},
			{{Key: "id", Value: "two"}},
		},
	}

	fields, err := InferFields(context.Background(), client, "demo", "things", 100)
	require.NoError(t, err)

	id, ok := fieldByPath(fields, "id")
	require.True(t, ok)
	assert.Equal(t, []string{"int", "string"}, id.Types)
}

// TestInferFields_ValidatorFastPath verifies a $jsonSchema validator yields fields
// without sampling (the aggregate data, if read, would differ).
func TestInferFields_ValidatorFastPath(t *testing.T) {
	client := &mockMongoClient{
		indexedFields: []string{"email"},
		// If sampling were (incorrectly) used, "shouldNotAppear" would surface.
		aggregateData: []bson.D{{{Key: "shouldNotAppear", Value: 1}}},
		validator: bson.M{
			"$jsonSchema": bson.M{
				"bsonType": "object",
				"required": bson.A{"email"},
				"properties": bson.M{
					"email": bson.M{"bsonType": "string"},
					"age":   bson.M{"bsonType": "int"},
					"address": bson.M{
						"bsonType": "object",
						"properties": bson.M{
							"city": bson.M{"bsonType": "string"},
						},
					},
					"orders": bson.M{
						"bsonType": "array",
						"items": bson.M{
							"bsonType": "object",
							"properties": bson.M{
								"sku": bson.M{"bsonType": "string"},
							},
						},
					},
				},
			},
		},
	}

	fields, err := InferFields(context.Background(), client, "demo", "users", 100)
	require.NoError(t, err)

	_, leaked := fieldByPath(fields, "shouldNotAppear")
	assert.False(t, leaked, "validator path must not fall back to sampling")

	for _, p := range []string{"email", "age", "address", "address.city", "orders", "orders.sku"} {
		_, ok := fieldByPath(fields, p)
		assert.True(t, ok, "expected validator field %q", p)
	}

	email, _ := fieldByPath(fields, "email")
	assert.Equal(t, []string{"string"}, email.Types)
	assert.Equal(t, 1.0, email.Frequency, "required field has frequency 1.0")
	assert.True(t, email.Indexed)

	age, _ := fieldByPath(fields, "age")
	assert.Equal(t, 0.0, age.Frequency, "optional validator field has frequency 0.0")
}

// TestInferFields_ValidatorWithoutJSONSchema falls back to sampling when the
// validator does not use $jsonSchema.
func TestInferFields_ValidatorWithoutJSONSchema(t *testing.T) {
	client := &mockMongoClient{
		validator:     bson.M{"$expr": bson.M{"$gt": bson.A{"$qty", 0}}},
		aggregateData: []bson.D{{{Key: "qty", Value: int32(5)}}},
	}

	fields, err := InferFields(context.Background(), client, "demo", "stock", 100)
	require.NoError(t, err)

	_, ok := fieldByPath(fields, "qty")
	assert.True(t, ok, "should sample when validator lacks $jsonSchema")
}

// TestInferFields_SampleError surfaces a sampling failure as an error.
func TestInferFields_SampleError(t *testing.T) {
	client := &mockMongoClient{aggregateErr: assertAnError}
	_, err := InferFields(context.Background(), client, "demo", "readings", 100)
	require.Error(t, err)
}

// TestInferFields_IndexErrorDegradesGracefully verifies an index-listing failure
// is non-fatal (best-effort ranking hint).
func TestInferFields_IndexErrorDegradesGracefully(t *testing.T) {
	client := &mockMongoClient{
		indexErr:      assertAnError,
		aggregateData: []bson.D{{{Key: "a", Value: int32(1)}}},
	}

	fields, err := InferFields(context.Background(), client, "demo", "c", 100)
	require.NoError(t, err)
	a, ok := fieldByPath(fields, "a")
	require.True(t, ok)
	assert.False(t, a.Indexed)
}

// TestInferFields_BoundsFieldCount verifies the returned field list is capped.
func TestInferFields_BoundsFieldCount(t *testing.T) {
	doc := bson.D{}
	for i := 0; i < maxFields+50; i++ {
		doc = append(doc, bson.E{Key: "f" + bson.NewObjectID().Hex() + string(rune('a'+i%26)), Value: i})
	}
	client := &mockMongoClient{aggregateData: []bson.D{doc}}

	fields, err := InferFields(context.Background(), client, "demo", "wide", 100)
	require.NoError(t, err)
	assert.LessOrEqual(t, len(fields), maxFields)
}

var assertAnError = &inferTestError{}

type inferTestError struct{}

func (e *inferTestError) Error() string { return "boom" }
