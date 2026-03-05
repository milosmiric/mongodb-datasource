# Template Variables & Macros

This guide covers all built-in variables, macros, and the smart `$__match` stage available in the MongoDB datasource plugin.

## Built-in Variables

The plugin replaces these variables before sending the pipeline to MongoDB. All variables support both `$__var` and `${__var}` syntax.

### Time Range Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$__from` | Start of time range (Extended JSON Date) | `{"$date":"2024-01-01T00:00:00Z"}` |
| `$__to` | End of time range (Extended JSON Date) | `{"$date":"2024-01-02T00:00:00Z"}` |
| `$__from_ms` | Start as Unix milliseconds | `1704067200000` |
| `$__to_ms` | End as Unix milliseconds | `1704153600000` |
| `$__from_s` | Start as Unix seconds | `1704067200` |
| `$__to_s` | End as Unix seconds | `1704153600` |

### ObjectId Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$__from_oid` | Start as ObjectId (lower bound) | `{"$oid":"659200800000000000000000"}` |
| `$__to_oid` | End as ObjectId (upper bound) | `{"$oid":"65935200ffffffffffffffff"}` |

### Duration Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$__range_ms` | Time range duration in milliseconds | `86400000` |
| `$__range_s` | Time range duration in seconds | `86400` |

### Interval Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$__interval` | Suggested bucket interval | `864000ms` |
| `$__interval_ms` | Interval in milliseconds | `864000` |
| `$__interval_unit` | MongoDB time unit for `$dateTrunc` | `"minute"` |
| `$__interval_binSize` | Bin size for `$dateTrunc` | `15` |

The interval is calculated from the Grafana-provided query interval when available, or approximated as `range / maxDataPoints`.

`$__interval_unit` and `$__interval_binSize` decompose the interval into MongoDB-compatible values:

| Interval Range | Unit | Example binSize |
|---------------|------|-----------------|
| < 1 minute | `second` | 1–59 |
| < 1 hour | `minute` | 1–59 |
| < 1 day | `hour` | 1–23 |
| ≥ 1 day | `day` | 1+ |

### Resolution Variable

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$__maxDataPoints` | Panel's maximum data points setting | `500` |

Useful with `$bucketAuto`:

```json
[
  {"$match": {$__timeFilter(timestamp)}},
  {"$bucketAuto": {
    "groupBy": "$timestamp",
    "buckets": $__maxDataPoints,
    "output": {"avg_value": {"$avg": "$value"}}
  }}
]
```

---

## Macros

Macros are function-like constructs that expand into JSON fragments. They are processed after variable interpolation.

### `$__timeFilter(field)`

Expands to a date range filter for BSON Date fields.

**Syntax:** `$__timeFilter(fieldName)`

**Example:**
```json
[{"$match": {$__timeFilter(timestamp)}}]
```

**Expands to:**
```json
[{"$match": {"timestamp": {"$gte": {"$date":"2024-01-01T00:00:00Z"}, "$lte": {"$date":"2024-01-02T00:00:00Z"}}}}]
```

### `$__timeFilter_ms(field)`

Same as `$__timeFilter` but for fields storing epoch milliseconds.

**Example:**
```json
[{"$match": {$__timeFilter_ms(created_at_ms)}}]
```

**Expands to:**
```json
[{"$match": {"created_at_ms": {"$gte": 1704067200000, "$lte": 1704153600000}}}]
```

### `$__oidFilter(field)`

Expands to an ObjectId range filter, useful for collections using `_id` as the time axis.

**Example:**
```json
[{"$match": {$__oidFilter(_id)}}]
```

**Expands to:**
```json
[{"$match": {"_id": {"$gte": {"$oid":"659200800000000000000000"}, "$lte": {"$oid":"65935200ffffffffffffffff"}}}}]
```

### `$__timeGroup(field)`

Expands to a `$dateTrunc` expression for adaptive time bucketing. The unit and bin size are automatically calculated from the panel's interval.

**Example:**
```json
[
  {"$match": {$__timeFilter(timestamp)}},
  {"$group": {
    "_id": $__timeGroup(timestamp),
    "avg_value": {"$avg": "$value"}
  }},
  {"$project": {"_id": 0, "timestamp": "$_id", "avg_value": 1}},
  {"$sort": {"timestamp": 1}}
]
```

**Expands to (for a 7-day range with ~100 data points):**
```json
{"$dateTrunc": {"date": "$timestamp", "unit": "hour", "binSize": 2}}
```

---

## Smart Match (`$__match`)

`$__match` is a custom pipeline stage that intelligently handles Grafana template variables, including "All" selections and multi-value selections. Unlike `$regex`, it uses index-friendly operators.

### How It Works

Use `$__match` as a pipeline stage key, with field-value pairs as its value:

```json
[{"$__match": {"sensor": ${sensor_type:json}, "location": ${loc:json}}}]
```

The behavior depends on the interpolated value:

| Grafana Selection | Interpolated Value | Result |
|-------------------|-------------------|--------|
| All | `"$__all"` | Field removed from filter |
| Single value | `"temperature"` | Exact match: `{"sensor": "temperature"}` |
| Multiple values | `["temperature","humidity"]` | `$in`: `{"sensor": {"$in": ["temperature","humidity"]}}` |

If **all** fields resolve to `"$__all"`, the entire stage is dropped from the pipeline.

### Dashboard Variable Setup

For `$__match` to work correctly, configure your dashboard variables:

1. Set **All value** to `$__all` (not `.*`)
2. Enable **Multi-value** if you want multi-select
3. Use the `:json` format specifier in your pipeline: `${varName:json}`

The `:json` format is critical — it ensures:
- Single value → `"temperature"` (quoted string)
- Multiple values → `["temperature","humidity"]` (JSON array)
- All → `"$__all"` (the custom allValue string)

### Example: Multi-field Filtering

```json
[
  {"$__match": {"sensor": ${sensor_type:json}, "location": ${loc:json}}},
  {"$match": {$__timeFilter(timestamp)}},
  {"$sort": {"timestamp": 1}},
  {"$project": {"_id": 0, "timestamp": 1, "value": 1, "sensor": 1, "location": 1}}
]
```

| sensor_type | loc | Resulting pipeline |
|-------------|-----|--------------------|
| All | All | `$__match` stage dropped; only time filter + sort + project |
| temperature | All | `{"$match": {"sensor": "temperature"}}` |
| temperature | building_a | `{"$match": {"sensor": "temperature", "location": "building_a"}}` |
| [temperature, humidity] | All | `{"$match": {"sensor": {"$in": ["temperature","humidity"]}}}` |

### Migration from `$regex`

Before (collection scan, no index usage):
```json
[{"$match": {"sensor": {"$regex": "^${sensor_type}$"}}}]
```

After (exact match or `$in`, uses indexes):
```json
[{"$__match": {"sensor": ${sensor_type:json}}}]
```

Variable config change:
- `"allValue": ".*"` → `"allValue": "$__all"`
- `"multi": false` → `"multi": true` (optional)

---

## Dashboard Variables

### Variable Naming

Avoid naming variables with a leading `$` that collides with MongoDB field references. For example, don't name a variable `field` if your documents have a field called `field` — the `$field` in an aggregation expression would be ambiguous.

### Format Specifiers

When using dashboard variables in MongoDB pipelines, the format specifier matters:

| Specifier | Single Value | Multi Value | Use Case |
|-----------|-------------|-------------|----------|
| `:json` | `"temperature"` | `["temperature","humidity"]` | `$__match`, `$in` |
| (none) | `temperature` | `temperature,humidity` | Simple string match |
| `:csv` | `temperature` | `temperature,humidity` | Comma-separated lists |
| `:pipe` | `temperature` | `temperature\|humidity` | Regex alternation |

**Recommendation:** Always use `:json` with `$__match` for reliable type handling.

---

## Common Patterns

### Adaptive Time-Series Chart

```json
[
  {"$__match": {"sensor": ${sensor_type:json}}},
  {"$match": {$__timeFilter(timestamp)}},
  {"$group": {
    "_id": $__timeGroup(timestamp),
    "avg_value": {"$avg": "$value"}
  }},
  {"$project": {"_id": 0, "timestamp": "$_id", "avg_value": 1}},
  {"$sort": {"timestamp": 1}}
]
```

### Multi-Select Filter with "All" Option

```json
[
  {"$__match": {"category": ${category:json}, "region": ${region:json}}},
  {"$group": {"_id": "$status", "count": {"$sum": 1}}},
  {"$project": {"_id": 0, "status": "$_id", "count": 1}}
]
```

### ObjectId-Based Time Filtering

For collections using ObjectId as the primary time reference:

```json
[
  {"$match": {$__oidFilter(_id)}},
  {"$sort": {"_id": 1}},
  {"$limit": 1000}
]
```

### Period-Over-Period Comparison

Use `$__range_ms` to look back one full period:

```json
[
  {"$match": {
    "timestamp": {
      "$gte": {"$date": {"$numberLong": "${__from_ms}"}},
      "$lte": {"$date": {"$numberLong": "${__to_ms}"}}
    }
  }},
  {"$addFields": {
    "period": {
      "$cond": {
        "if": {"$gte": ["$timestamp", {"$date": {"$numberLong": "${__from_ms}"}}]},
        "then": "current",
        "else": "previous"
      }
    }
  }}
]
```

### `$bucketAuto` with Panel Resolution

```json
[
  {"$match": {$__timeFilter(timestamp)}},
  {"$bucketAuto": {
    "groupBy": "$timestamp",
    "buckets": $__maxDataPoints,
    "output": {
      "avg_value": {"$avg": "$value"},
      "count": {"$sum": 1}
    }
  }},
  {"$project": {
    "_id": 0,
    "timestamp": "$_id.min",
    "avg_value": {"$round": ["$avg_value", 2]},
    "count": 1
  }},
  {"$sort": {"timestamp": 1}}
]
```
