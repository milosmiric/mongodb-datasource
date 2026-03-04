package plugin

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// ConvertDocumentsToFrame converts a slice of ordered BSON documents into a Grafana DataFrame.
// Using bson.D (ordered) instead of bson.M (unordered) preserves MongoDB's field order.
func ConvertDocumentsToFrame(name string, docs []bson.D, timeField string) (*data.Frame, error) {
	if len(docs) == 0 {
		return data.NewFrame(name), nil
	}

	// Collect all unique field names across all documents, preserving insertion order.
	fieldOrder := collectFieldNames(docs)

	// Build a lookup for fast access: field name → per-row values.
	// Create fields based on detected types from first non-nil value for each field.
	fields := make(map[string]*data.Field, len(fieldOrder))
	fieldTypes := make(map[string]data.FieldType, len(fieldOrder))

	for _, fieldName := range fieldOrder {
		ft := detectFieldType(docs, fieldName, timeField)
		fieldTypes[fieldName] = ft
		fields[fieldName] = createNullableField(fieldName, ft, len(docs))
	}

	// Populate field values.
	for rowIdx, doc := range docs {
		docMap := docToMap(doc)
		for _, fieldName := range fieldOrder {
			val, exists := docMap[fieldName]
			if !exists {
				// Leave as nil (nullable field).
				continue
			}
			if err := setFieldValue(fields[fieldName], rowIdx, val, fieldTypes[fieldName]); err != nil {
				return nil, fmt.Errorf("failed to set field %q row %d: %w", fieldName, rowIdx, err)
			}
		}
	}

	// Build the frame in field order.
	frame := data.NewFrame(name)
	for _, fieldName := range fieldOrder {
		frame.Fields = append(frame.Fields, fields[fieldName])
	}

	return frame, nil
}

// docToMap converts a bson.D to a map for fast field lookup within a single row.
func docToMap(doc bson.D) map[string]interface{} {
	m := make(map[string]interface{}, len(doc))
	for _, elem := range doc {
		m[elem.Key] = elem.Value
	}
	return m
}

// collectFieldNames returns all unique field names from ordered documents,
// preserving the order they first appear (first document's order takes priority).
func collectFieldNames(docs []bson.D) []string {
	seen := make(map[string]bool)
	var order []string
	for _, doc := range docs {
		for _, elem := range doc {
			if !seen[elem.Key] {
				seen[elem.Key] = true
				order = append(order, elem.Key)
			}
		}
	}
	return order
}

// detectFieldType determines the data.FieldType for a field by scanning documents
// for the first non-nil value.
func detectFieldType(docs []bson.D, fieldName string, timeField string) data.FieldType {
	// If this is the designated time field, always treat as time.
	if fieldName == timeField {
		return data.FieldTypeNullableTime
	}

	for _, doc := range docs {
		for _, elem := range doc {
			if elem.Key == fieldName && elem.Value != nil {
				return bsonValueToFieldType(elem.Value)
			}
		}
	}

	// All nil — default to string.
	return data.FieldTypeNullableString
}

// bsonValueToFieldType maps a Go value (from BSON decoding) to a Grafana FieldType.
func bsonValueToFieldType(val interface{}) data.FieldType {
	switch val.(type) {
	case float64:
		return data.FieldTypeNullableFloat64
	case float32:
		return data.FieldTypeNullableFloat64
	case int32:
		return data.FieldTypeNullableFloat64
	case int64:
		return data.FieldTypeNullableFloat64
	case int:
		return data.FieldTypeNullableFloat64
	case bool:
		return data.FieldTypeNullableBool
	case string:
		return data.FieldTypeNullableString
	case bson.ObjectID:
		return data.FieldTypeNullableString
	case bson.Decimal128:
		return data.FieldTypeNullableFloat64
	case time.Time:
		return data.FieldTypeNullableTime
	case bson.DateTime:
		return data.FieldTypeNullableTime
	default:
		// Arrays, embedded documents, binary, regex, etc. — serialize to JSON string.
		return data.FieldTypeNullableString
	}
}

// createNullableField creates a data.Field with the appropriate nullable slice type.
func createNullableField(name string, ft data.FieldType, length int) *data.Field {
	switch ft {
	case data.FieldTypeNullableFloat64:
		vals := make([]*float64, length)
		return data.NewField(name, nil, vals)
	case data.FieldTypeNullableBool:
		vals := make([]*bool, length)
		return data.NewField(name, nil, vals)
	case data.FieldTypeNullableString:
		vals := make([]*string, length)
		return data.NewField(name, nil, vals)
	case data.FieldTypeNullableTime:
		vals := make([]*time.Time, length)
		return data.NewField(name, nil, vals)
	default:
		vals := make([]*string, length)
		return data.NewField(name, nil, vals)
	}
}

// setFieldValue sets a single value in a data.Field at the given index,
// performing type conversion as needed.
func setFieldValue(field *data.Field, idx int, val interface{}, ft data.FieldType) error {
	if val == nil {
		return nil // Leave as nil in nullable field.
	}

	switch ft {
	case data.FieldTypeNullableFloat64:
		v, err := toFloat64(val)
		if err != nil {
			return err
		}
		field.Set(idx, &v)

	case data.FieldTypeNullableBool:
		v, ok := val.(bool)
		if !ok {
			return fmt.Errorf("expected bool, got %T: %w", val, ErrUnsupportedBSONType)
		}
		field.Set(idx, &v)

	case data.FieldTypeNullableTime:
		v, err := toTime(val)
		if err != nil {
			return err
		}
		field.Set(idx, &v)

	case data.FieldTypeNullableString:
		v := toString(val)
		field.Set(idx, &v)

	default:
		v := toString(val)
		field.Set(idx, &v)
	}

	return nil
}

// toFloat64 converts numeric BSON types to float64.
func toFloat64(val interface{}) (float64, error) {
	switch v := val.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case int:
		return float64(v), nil
	case bson.Decimal128:
		// Parse Decimal128 string representation.
		f, _, err := v.BigInt()
		if err != nil {
			return 0, fmt.Errorf("failed to convert Decimal128: %w", err)
		}
		return float64(f.Int64()), nil
	default:
		return 0, fmt.Errorf("cannot convert %T to float64: %w", val, ErrUnsupportedBSONType)
	}
}

// toTime converts time-related BSON types to time.Time.
func toTime(val interface{}) (time.Time, error) {
	switch v := val.(type) {
	case time.Time:
		return v, nil
	case bson.DateTime:
		return v.Time().UTC(), nil
	default:
		return time.Time{}, fmt.Errorf("cannot convert %T to time.Time: %w", val, ErrUnsupportedBSONType)
	}
}

// toString converts any BSON value to its string representation.
// Complex types (arrays, documents) are serialized as JSON.
func toString(val interface{}) string {
	switch v := val.(type) {
	case string:
		return v
	case bson.ObjectID:
		return v.Hex()
	case bson.Decimal128:
		return v.String()
	case time.Time:
		return v.UTC().Format(time.RFC3339Nano)
	case bson.DateTime:
		return v.Time().UTC().Format(time.RFC3339Nano)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case nil:
		return ""
	default:
		// For arrays, embedded documents, etc., serialize to JSON.
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}
