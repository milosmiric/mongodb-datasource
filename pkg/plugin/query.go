package plugin

import (
	"context"
	"encoding/json"
	"fmt"
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

	pipeline, err := buildPipeline(model.Pipeline, query.TimeRange)
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
			Type: data.FrameTypeTimeSeriesMany,
		}
	}

	response.Frames = append(response.Frames, frame)
	return response
}

// buildPipeline parses the JSON pipeline string and applies variable interpolation.
func buildPipeline(pipelineJSON string, timeRange backend.TimeRange) ([]bson.D, error) {
	if strings.TrimSpace(pipelineJSON) == "" {
		return nil, ErrEmptyPipeline
	}

	// Interpolate Grafana template variables.
	interpolated := interpolateVariables(pipelineJSON, timeRange)

	var rawPipeline []bson.D
	if err := bson.UnmarshalExtJSON([]byte(interpolated), false, &rawPipeline); err != nil {
		// Fall back to standard JSON unmarshalling for simpler syntax.
		var jsonPipeline []map[string]interface{}
		if jsonErr := json.Unmarshal([]byte(interpolated), &jsonPipeline); jsonErr != nil {
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

	return rawPipeline, nil
}

// interpolateVariables replaces Grafana template variables in the pipeline string.
// Replacements are applied in order from longest to shortest key to prevent
// partial matches (e.g., $__from matching before $__from_ms).
func interpolateVariables(pipeline string, timeRange backend.TimeRange) string {
	fromDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.From.UTC().Format(time.RFC3339Nano))
	toDate := fmt.Sprintf(`{"$date":"%s"}`, timeRange.To.UTC().Format(time.RFC3339Nano))
	fromMs := fmt.Sprintf("%d", timeRange.From.UnixMilli())
	toMs := fmt.Sprintf("%d", timeRange.To.UnixMilli())

	// Calculate interval.
	duration := timeRange.To.Sub(timeRange.From)
	intervalMs := duration.Milliseconds() / 100 // Approximate: 100 data points.
	if intervalMs < 1 {
		intervalMs = 1
	}
	intervalMsStr := fmt.Sprintf("%d", intervalMs)
	intervalStr := fmt.Sprintf("%dms", intervalMs)

	// Order matters: replace longer keys first to avoid partial matches.
	replacements := []struct{ key, val string }{
		{"${__from_ms}", fromMs},
		{"${__to_ms}", toMs},
		{"${__interval_ms}", intervalMsStr},
		{"${__interval}", intervalStr},
		{"${__from}", fromDate},
		{"${__to}", toDate},
		{"$__from_ms", fromMs},
		{"$__to_ms", toMs},
		{"$__interval_ms", intervalMsStr},
		{"$__interval", intervalStr},
		{"$__from", fromDate},
		{"$__to", toDate},
	}

	result := pipeline
	for _, r := range replacements {
		result = strings.ReplaceAll(result, r.key, r.val)
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
