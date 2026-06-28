package plugin

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Bounds for schema inference. MongoDB is schemaless, so inference is a
// sample-and-infer operation: these caps keep it cheap and prevent a huge or
// deeply nested collection from producing an unbounded field list.
const (
	// Default $sample size used when the caller does not request one.
	defaultSampleSize = 200
	// Upper bound on how many documents $sample may read.
	maxSampleSize = 1000
	// Upper bound on how many field descriptors are returned.
	maxFields = 500
	// Maximum recursion depth into nested documents and arrays.
	maxSchemaDepth = 12
)

// FieldInfo describes a single inferred field path and the BSON type(s) observed
// for it. It is a hint for autocomplete — never authoritative validation.
type FieldInfo struct {
	// Path is the dotted field path (e.g. "meta.region").
	Path string `json:"path"`
	// Types lists the distinct BSON type names seen for the field, sorted.
	Types []string `json:"types"`
	// Frequency is the fraction of sampled documents containing the field
	// (1.0 for required fields when derived from a $jsonSchema validator).
	Frequency float64 `json:"frequency"`
	// Indexed reports whether the field participates in any index.
	Indexed bool `json:"indexed"`
}

// parseSampleSize clamps a caller-supplied sample size into [1, maxSampleSize],
// falling back to defaultSampleSize when unset or unparsable.
func parseSampleSize(raw string) int {
	if raw == "" {
		return defaultSampleSize
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return defaultSampleSize
	}
	if n > maxSampleSize {
		return maxSampleSize
	}
	return n
}

// InferFields returns the inferred field descriptors for a collection. It prefers
// the authoritative $jsonSchema validator when one is configured (no sampling);
// otherwise it runs a bounded $sample aggregation and walks the documents. Index
// membership is layered on as a ranking hint. All signals are best-effort: a
// failure to read the validator or indexes degrades gracefully, but a failed
// sample (the only data source in the common case) is returned as an error.
func InferFields(ctx context.Context, client MongoClient, database, collection string, sampleSize int) ([]FieldInfo, error) {
	if sampleSize <= 0 {
		sampleSize = defaultSampleSize
	}
	if sampleSize > maxSampleSize {
		sampleSize = maxSampleSize
	}

	indexed := map[string]struct{}{}
	if fields, err := client.IndexedFields(ctx, database, collection); err == nil {
		for _, f := range fields {
			indexed[f] = struct{}{}
		}
	}

	acc := newFieldAccumulator()

	// Fast-path: derive fields from a $jsonSchema validator without sampling.
	validator, _ := client.CollectionValidator(ctx, database, collection)
	if schema := jsonSchemaOf(validator); schema != nil {
		acc.fromValidator = true
		collectSchemaFields(schema, "", acc, 0)
	}

	// Sampling path: used when there is no usable validator schema.
	if !acc.fromValidator || len(acc.types) == 0 {
		acc = newFieldAccumulator()
		docs, err := client.Aggregate(ctx, database, collection, samplePipeline(sampleSize))
		if err != nil {
			return nil, fmt.Errorf("sampling collection %q: %w", collection, err)
		}
		for _, doc := range docs {
			acc.addDocument(doc)
		}
	}

	fields := acc.toFieldInfos(indexed)
	sortFieldInfos(fields)
	if len(fields) > maxFields {
		fields = fields[:maxFields]
	}
	return fields, nil
}

// samplePipeline builds a single-stage $sample pipeline. $sample is optimized by
// the server when reading a small fraction of a collection.
func samplePipeline(size int) bson.A {
	return bson.A{bson.D{{Key: "$sample", Value: bson.D{{Key: "size", Value: size}}}}}
}

// fieldAccumulator collects field paths, their observed types, and presence
// counts across a set of sampled documents (or a validator schema).
type fieldAccumulator struct {
	types  map[string]map[string]struct{} // path -> set of type names
	counts map[string]int                 // path -> #documents containing it
	// required marks validator-required paths so they report frequency 1.0.
	required      map[string]struct{}
	total         int
	fromValidator bool
}

func newFieldAccumulator() *fieldAccumulator {
	return &fieldAccumulator{
		types:    map[string]map[string]struct{}{},
		counts:   map[string]int{},
		required: map[string]struct{}{},
	}
}

// record notes that path was seen with the given type name.
func (a *fieldAccumulator) record(path, typeName string) {
	if path == "" {
		return
	}
	if a.types[path] == nil {
		a.types[path] = map[string]struct{}{}
	}
	if typeName != "" {
		a.types[path][typeName] = struct{}{}
	}
}

// addDocument walks one sampled document, recording every (dotted) field path and
// its type, then increments per-path presence counts (each path counted once per
// document).
func (a *fieldAccumulator) addDocument(doc bson.D) {
	a.total++
	seen := map[string]bool{}
	for _, e := range doc {
		a.add(e.Key, e.Value, seen, 0)
	}
	for path := range seen {
		a.counts[path]++
	}
}

// add records a value at path and recurses into nested documents and arrays.
// Array elements that are documents contribute their fields under the array's
// path (so "items.sku" surfaces for an array of objects).
func (a *fieldAccumulator) add(path string, value interface{}, seen map[string]bool, depth int) {
	if depth > maxSchemaDepth || path == "" {
		return
	}
	seen[path] = true
	a.record(path, bsonTypeName(value))

	switch v := value.(type) {
	case bson.D:
		for _, e := range v {
			a.add(joinPath(path, e.Key), e.Value, seen, depth+1)
		}
	case bson.M:
		for k, val := range v {
			a.add(joinPath(path, k), val, seen, depth+1)
		}
	case bson.A:
		for _, item := range v {
			if isContainer(item) {
				a.add(path, item, seen, depth+1)
			}
		}
	}
}

// isContainer reports whether v is a nested document or array worth recursing
// into. Array elements that are documents contribute their fields to the array's
// path; scalar elements do not extend the field set.
func isContainer(v interface{}) bool {
	switch v.(type) {
	case bson.D, bson.M, bson.A:
		return true
	default:
		return false
	}
}

// toFieldInfos materializes the accumulated state into FieldInfo descriptors.
func (a *fieldAccumulator) toFieldInfos(indexed map[string]struct{}) []FieldInfo {
	total := a.total
	if total <= 0 {
		total = 1
	}

	fields := make([]FieldInfo, 0, len(a.types))
	for path, typeSet := range a.types {
		types := make([]string, 0, len(typeSet))
		for t := range typeSet {
			types = append(types, t)
		}
		sort.Strings(types)

		freq := float64(a.counts[path]) / float64(total)
		if a.fromValidator {
			if _, ok := a.required[path]; ok {
				freq = 1.0
			} else {
				freq = 0.0
			}
		}

		_, isIndexed := indexed[path]
		fields = append(fields, FieldInfo{
			Path:      path,
			Types:     types,
			Frequency: freq,
			Indexed:   isIndexed,
		})
	}
	return fields
}

// sortFieldInfos orders fields for presentation: indexed first, then by
// descending frequency, then alphabetically by path for stability.
func sortFieldInfos(fields []FieldInfo) {
	sort.Slice(fields, func(i, j int) bool {
		a, b := fields[i], fields[j]
		if a.Indexed != b.Indexed {
			return a.Indexed
		}
		if a.Frequency != b.Frequency {
			return a.Frequency > b.Frequency
		}
		return a.Path < b.Path
	})
}

// joinPath joins a dotted path prefix with a child key.
func joinPath(prefix, key string) string {
	if prefix == "" {
		return key
	}
	return prefix + "." + key
}

// bsonTypeName maps a decoded BSON value to its MongoDB type name.
func bsonTypeName(value interface{}) string {
	switch value.(type) {
	case nil:
		return "null"
	case bool:
		return "bool"
	case int32:
		return "int"
	case int64, int:
		return "long"
	case float64, float32:
		return "double"
	case string:
		return "string"
	case bson.ObjectID:
		return "objectId"
	case bson.Decimal128:
		return "decimal"
	case bson.DateTime, time.Time:
		return "date"
	case bson.D, bson.M:
		return "object"
	case bson.A:
		return "array"
	case bson.Binary:
		return "binData"
	case bson.Timestamp:
		return "timestamp"
	case bson.Regex:
		return "regex"
	default:
		return "unknown"
	}
}

// jsonSchemaOf extracts the $jsonSchema document from a collection validator, or
// returns nil when the validator is absent or does not use $jsonSchema.
func jsonSchemaOf(validator bson.M) bson.M {
	if validator == nil {
		return nil
	}
	schema, ok := validator["$jsonSchema"].(bson.M)
	if !ok {
		return nil
	}
	return schema
}

// collectSchemaFields walks a $jsonSchema "object" node, recording each property
// as a dotted path with its declared BSON type(s). Required properties are marked
// so they report a frequency of 1.0.
func collectSchemaFields(schema bson.M, prefix string, acc *fieldAccumulator, depth int) {
	if depth > maxSchemaDepth {
		return
	}

	required := stringSet(schema["required"])
	props, ok := schema["properties"].(bson.M)
	if !ok {
		return
	}

	for name, raw := range props {
		sub, _ := raw.(bson.M)
		path := joinPath(prefix, name)

		for _, t := range schemaTypes(sub) {
			acc.record(path, t)
		}
		// Ensure the path is registered even when no type is declared.
		if acc.types[path] == nil {
			acc.types[path] = map[string]struct{}{}
		}
		if _, isReq := required[name]; isReq {
			acc.required[path] = struct{}{}
		}

		if sub != nil {
			// Nested object.
			collectSchemaFields(sub, path, acc, depth+1)
			// Array of objects: items may be a single schema or a list of schemas.
			switch items := sub["items"].(type) {
			case bson.M:
				collectSchemaFields(items, path, acc, depth+1)
			case bson.A:
				for _, it := range items {
					if m, ok := it.(bson.M); ok {
						collectSchemaFields(m, path, acc, depth+1)
					}
				}
			}
		}
	}
}

// schemaTypes returns the declared type name(s) for a $jsonSchema property,
// reading "bsonType" (preferred) or the JSON-Schema "type" keyword, each of which
// may be a single string or an array of strings.
func schemaTypes(sub bson.M) []string {
	if sub == nil {
		return nil
	}
	if bt, ok := sub["bsonType"]; ok {
		return normalizeTypeList(bt, false)
	}
	if t, ok := sub["type"]; ok {
		return normalizeTypeList(t, true)
	}
	return nil
}

// normalizeTypeList coerces a bsonType/type value (string or array) into a sorted
// list of MongoDB type names. When jsonSchema is true, JSON-Schema type keywords
// are mapped to their BSON equivalents.
func normalizeTypeList(value interface{}, jsonSchema bool) []string {
	var raw []string
	switch v := value.(type) {
	case string:
		raw = []string{v}
	case bson.A:
		for _, item := range v {
			if s, ok := item.(string); ok {
				raw = append(raw, s)
			}
		}
	}

	seen := map[string]struct{}{}
	var out []string
	for _, t := range raw {
		name := t
		if jsonSchema {
			name = jsonSchemaTypeToBSON(t)
		}
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// jsonSchemaTypeToBSON maps a JSON-Schema "type" keyword to a BSON type name.
func jsonSchemaTypeToBSON(t string) string {
	switch strings.ToLower(t) {
	case "number":
		return "double"
	case "integer":
		return "int"
	case "boolean":
		return "bool"
	case "object":
		return "object"
	case "array":
		return "array"
	case "string":
		return "string"
	case "null":
		return "null"
	default:
		return t
	}
}

// stringSet coerces a value that may be a list of strings into a set.
func stringSet(value interface{}) map[string]struct{} {
	out := map[string]struct{}{}
	if arr, ok := value.(bson.A); ok {
		for _, item := range arr {
			if s, ok := item.(string); ok {
				out[s] = struct{}{}
			}
		}
	}
	return out
}
