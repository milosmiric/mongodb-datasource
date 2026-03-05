package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// query executes a single data query against MongoDB and returns the result.
func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	if d.client == nil {
		response.Error = fmt.Errorf("MongoDB client not initialized: %w", ErrConnectionFailed)
		return response
	}

	model, err := ParseQueryModel(query)
	if err != nil {
		response.Error = err
		return response
	}

	pipeline, err := buildPipeline(model.Pipeline, query)
	if err != nil {
		response.Error = fmt.Errorf("building pipeline: %w", err)
		return response
	}

	log.DefaultLogger.Debug("executing aggregation",
		"database", model.Database,
		"collection", model.Collection,
		"pipeline_stages", len(pipeline),
	)

	docs, err := d.client.Aggregate(ctx, model.Database, model.Collection, pipeline)
	if err != nil {
		response.Error = fmt.Errorf("%w: %v", ErrQueryFailed, err)
		return response
	}

	frame, err := ConvertDocumentsToFrame(query.RefID, docs, model.TimeField)
	if err != nil {
		response.Error = fmt.Errorf("converting documents to frame: %w", err)
		return response
	}

	// Set frame metadata based on query format.
	if model.Format == QueryFormatTimeSeries {
		frame.Meta = &data.FrameMeta{
			Type: data.FrameTypeTimeSeriesMulti,
		}
	}

	response.Frames = append(response.Frames, frame)
	return response
}

// buildPipeline parses the JSON pipeline string and applies variable interpolation,
// macro expansion, and custom stage processing ($__match).
func buildPipeline(pipelineJSON string, query backend.DataQuery) ([]bson.D, error) {
	if strings.TrimSpace(pipelineJSON) == "" {
		return nil, ErrEmptyPipeline
	}

	// Interpolate Grafana template variables.
	interpolated := interpolateVariables(pipelineJSON, query)

	// Expand macros ($__timeFilter, $__timeGroup, etc.).
	expanded, err := expandMacros(interpolated, query.TimeRange)
	if err != nil {
		return nil, err
	}

	var rawPipeline []bson.D
	if err := bson.UnmarshalExtJSON([]byte(expanded), false, &rawPipeline); err != nil {
		// Fall back to standard JSON unmarshalling for simpler syntax.
		var jsonPipeline []map[string]interface{}
		if jsonErr := json.Unmarshal([]byte(expanded), &jsonPipeline); jsonErr != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidPipeline, err)
		}

		rawPipeline = make([]bson.D, len(jsonPipeline))
		for i, stage := range jsonPipeline {
			doc := bson.D{}
			for k, v := range stage {
				doc = append(doc, bson.E{Key: k, Value: convertToBSON(v)})
			}
			rawPipeline[i] = doc
		}
	}

	if len(rawPipeline) == 0 {
		return nil, ErrEmptyPipeline
	}

	// Process custom stages ($__match).
	rawPipeline = processCustomStages(rawPipeline)

	if len(rawPipeline) == 0 {
		return nil, ErrEmptyPipeline
	}

	return rawPipeline, nil
}

// computeIntervalUnit converts an interval in milliseconds to a MongoDB-compatible
// time unit and bin size for use with $dateTrunc.
func computeIntervalUnit(intervalMs int64) (unit string, binSize int64) {
	switch {
	case intervalMs < 60_000:
		return "second", max(1, (intervalMs+999)/1000)
	case intervalMs < 3_600_000:
		return "minute", max(1, (intervalMs+59_999)/60_000)
	case intervalMs < 86_400_000:
		return "hour", max(1, (intervalMs+3_599_999)/3_600_000)
	default:
		return "day", max(1, (intervalMs+86_399_999)/86_400_000)
	}
}

// GenerateObjectIDHex creates an ObjectId hex string from a timestamp.
// Padding is "00" for lower bound ($__from_oid) or "ff" for upper bound ($__to_oid).
func generateObjectIDHex(t time.Time, padding string) string {
	return fmt.Sprintf(`{"$oid":"%08x%s"}`, t.Unix(), strings.Repeat(padding, 8))
}

// interpolateVariables replaces Grafana template variables in the pipeline string.
// Replacements are applied in order from longest to shortest key to prevent
// partial matches (e.g., $__from matching before $__from_ms).
func interpolateVariables(pipeline string, query backend.DataQuery) string {
	timeRange := query.TimeRange
	fromDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.From.UTC().Format(time.RFC3339Nano))
	toDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.To.UTC().Format(time.RFC3339Nano))
	fromMs := fmt.Sprintf("%d", timeRange.From.UnixMilli())
	toMs := fmt.Sprintf("%d", timeRange.To.UnixMilli())
	fromS := fmt.Sprintf("%d", timeRange.From.Unix())
	toS := fmt.Sprintf("%d", timeRange.To.Unix())
	fromOid := generateObjectIDHex(timeRange.From, "00")
	toOid := generateObjectIDHex(timeRange.To, "ff")

	// Calculate duration and interval.
	duration := timeRange.To.Sub(timeRange.From)
	rangeMs := fmt.Sprintf("%d", duration.Milliseconds())
	rangeS := fmt.Sprintf("%d", int64(duration.Seconds()))

	// Use Grafana-provided interval when available, else approximate.
	maxDP := query.MaxDataPoints
	if maxDP <= 0 {
		maxDP = 100
	}
	intervalMs := duration.Milliseconds() / int64(maxDP)
	if query.Interval.Milliseconds() > 0 {
		intervalMs = query.Interval.Milliseconds()
	}
	if intervalMs < 1 {
		intervalMs = 1
	}

	intervalMsStr := fmt.Sprintf("%d", intervalMs)
	intervalStr := fmt.Sprintf("%dms", intervalMs)

	unit, binSize := computeIntervalUnit(intervalMs)
	intervalUnitStr := fmt.Sprintf(`"%s"`, unit)
	intervalBinSizeStr := fmt.Sprintf("%d", binSize)
	maxDataPointsStr := fmt.Sprintf("%d", maxDP)

	// Order matters: replace longer keys first to avoid partial matches.
	replacements := []struct{ key, val string }{
		// Braced syntax — longest first.
		{"${__interval_binSize}", intervalBinSizeStr},
		{"${__interval_unit}", intervalUnitStr},
		{"${__interval_ms}", intervalMsStr},
		{"${__interval}", intervalStr},
		{"${__maxDataPoints}", maxDataPointsStr},
		{"${__from_oid}", fromOid},
		{"${__from_ms}", fromMs},
		{"${__from_s}", fromS},
		{"${__from}", fromDate},
		{"${__to_oid}", toOid},
		{"${__to_ms}", toMs},
		{"${__to_s}", toS},
		{"${__to}", toDate},
		{"${__range_ms}", rangeMs},
		{"${__range_s}", rangeS},
		// Bare syntax — longest first.
		{"$__interval_binSize", intervalBinSizeStr},
		{"$__interval_unit", intervalUnitStr},
		{"$__interval_ms", intervalMsStr},
		{"$__interval", intervalStr},
		{"$__maxDataPoints", maxDataPointsStr},
		{"$__from_oid", fromOid},
		{"$__from_ms", fromMs},
		{"$__from_s", fromS},
		{"$__from", fromDate},
		{"$__to_oid", toOid},
		{"$__to_ms", toMs},
		{"$__to_s", toS},
		{"$__to", toDate},
		{"$__range_ms", rangeMs},
		{"$__range_s", rangeS},
	}

	result := pipeline
	for _, r := range replacements {
		result = strings.ReplaceAll(result, r.key, r.val)
	}

	// Normalize $__all sentinel: Grafana outputs bare $__all (unquoted) when
	// allValue is "$__all", even with :json format. Ensure it's always a valid
	// JSON string so the pipeline can be parsed.
	result = strings.ReplaceAll(result, `"$__all"`, "$__all")
	result = strings.ReplaceAll(result, "$__all", `"$__all"`)

	return result
}

// macroPattern matches macro calls like $__timeFilter(field), $__timeGroup(field).
var macroPattern = regexp.MustCompile(`\$__(timeFilter|timeFilter_ms|oidFilter|timeGroup)\(([^)]*)\)`)

// expandMacros replaces macro calls in the pipeline string with their expanded JSON fragments.
func expandMacros(pipeline string, timeRange backend.TimeRange) (string, error) {
	var expandErr error

	result := macroPattern.ReplaceAllStringFunc(pipeline, func(match string) string {
		if expandErr != nil {
			return match
		}

		parts := macroPattern.FindStringSubmatch(match)
		if len(parts) != 3 {
			expandErr = fmt.Errorf("%w: could not parse %q", ErrInvalidMacro, match)
			return match
		}

		macroName := parts[1]
		fieldName := strings.TrimSpace(parts[2])
		if fieldName == "" {
			expandErr = fmt.Errorf("%w: empty field name in %q", ErrInvalidMacro, match)
			return match
		}

		fromDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.From.UTC().Format(time.RFC3339Nano))
		toDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.To.UTC().Format(time.RFC3339Nano))

		switch macroName {
		case "timeFilter":
			return fmt.Sprintf(`"%s": {"$gte": %s, "$lte": %s}`, fieldName, fromDate, toDate)

		case "timeFilter_ms":
			fromMs := timeRange.From.UnixMilli()
			toMs := timeRange.To.UnixMilli()
			return fmt.Sprintf(`"%s": {"$gte": %d, "$lte": %d}`, fieldName, fromMs, toMs)

		case "oidFilter":
			fromOid := generateObjectIDHex(timeRange.From, "00")
			toOid := generateObjectIDHex(timeRange.To, "ff")
			return fmt.Sprintf(`"%s": {"$gte": %s, "$lte": %s}`, fieldName, fromOid, toOid)

		case "timeGroup":
			duration := timeRange.To.Sub(timeRange.From)
			intervalMs := duration.Milliseconds() / 100
			if intervalMs < 1 {
				intervalMs = 1
			}
			unit, binSize := computeIntervalUnit(intervalMs)
			return fmt.Sprintf(`{"$dateTrunc": {"date": "$%s", "unit": "%s", "binSize": %d}}`, fieldName, unit, binSize)

		default:
			expandErr = fmt.Errorf("%w: unknown macro %q", ErrInvalidMacro, macroName)
			return match
		}
	})

	if expandErr != nil {
		return "", expandErr
	}

	return result, nil
}

// processCustomStages transforms custom pipeline stages like $__match into standard MongoDB stages.
// $__match handles All/single/multi-value template variables:
//   - "$__all" string → field removed (no filter)
//   - bson.A (array) → converted to $in
//   - anything else → exact match
//
// If all fields in a $__match stage are "$__all", the entire stage is dropped.
func processCustomStages(pipeline []bson.D) []bson.D {
	result := make([]bson.D, 0, len(pipeline))

	for _, stage := range pipeline {
		if len(stage) == 0 {
			result = append(result, stage)
			continue
		}

		if stage[0].Key != "$__match" {
			result = append(result, stage)
			continue
		}

		// Extract the match document.
		matchDoc, ok := stage[0].Value.(bson.D)
		if !ok {
			// Not a valid $__match stage; keep it as-is.
			result = append(result, stage)
			continue
		}

		// Process each field in the match document.
		var filteredFields bson.D
		for _, field := range matchDoc {
			// Check for "$__all" — remove this field (no filter).
			if strVal, ok := field.Value.(string); ok && strVal == "$__all" {
				continue
			}

			// Check for array → convert to $in.
			if arr, ok := field.Value.(bson.A); ok {
				filteredFields = append(filteredFields, bson.E{
					Key:   field.Key,
					Value: bson.D{{Key: "$in", Value: arr}},
				})
				continue
			}

			// Anything else → exact match.
			filteredFields = append(filteredFields, field)
		}

		// If no fields remain, drop the entire stage.
		if len(filteredFields) == 0 {
			continue
		}

		// Replace with standard $match.
		result = append(result, bson.D{{Key: "$match", Value: filteredFields}})
	}

	return result
}

// convertToBSON recursively converts a generic JSON-decoded value to BSON-compatible types.
func convertToBSON(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		doc := bson.D{}
		for k, v := range val {
			doc = append(doc, bson.E{Key: k, Value: convertToBSON(v)})
		}
		return doc
	case []interface{}:
		arr := make(bson.A, len(val))
		for i, item := range val {
			arr[i] = convertToBSON(item)
		}
		return arr
	default:
		return val
	}
}
