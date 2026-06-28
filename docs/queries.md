# Query Guide

This guide covers how to write MongoDB aggregation pipeline queries in Grafana.

## Query Editor Overview

The query editor has the following fields:

- **Database** — Select from available databases (fetched from the backend)
- **Collection** — Select from collections in the chosen database
- **Pipeline** — JSON aggregation pipeline array
- **Format** — `Table` or `Time Series` output mode
- **Time Field** — (Time series only) Which document field contains timestamps
- **Legend** — (Time series only) Legend format template, e.g. `{{sensor}}`

## Field-Name Autocomplete

Once you select a database and collection, the pipeline editor suggests field
names as you type. Press `Ctrl+Space` (or just start typing a field reference) to
open the suggestion list. Indexed fields are ranked first, and each suggestion
shows its inferred BSON type(s) — with an `· indexed` marker for indexed fields.

The same suggestions back the **Field** input when building a [Query
variable](#creating-variables-query-type).

**How fields are inferred.** MongoDB is schemaless, so the plugin infers the
field list per collection:

- If the collection has a [`$jsonSchema`
  validator](https://www.mongodb.com/docs/manual/core/schema-validation/), its
  declared fields and types are used directly (no sampling).
- Otherwise the backend runs a bounded
  [`$sample`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sample/)
  over the collection and walks the returned documents, collecting the union of
  field paths (including nested, dotted paths like `meta.region` and fields inside
  arrays of objects) and their observed types.

Because sampling is partial, suggestions are **hints only** — they never validate
or block a query. A field that isn't suggested (e.g. it only appears in rarely
sampled documents) can still be used normally. Sample size and the number of
returned fields are bounded so inference stays cheap on large collections.

## Aggregation Pipeline Basics

Queries are written as MongoDB [aggregation pipelines](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) — a JSON array of stage objects. Each stage transforms the data flowing through the pipeline.

```json
[
  { "$match": { "status": "active" } },
  { "$group": { "_id": "$category", "total": { "$sum": "$amount" } } },
  { "$sort": { "total": -1 } },
  { "$limit": 10 }
]
```

## Output Formats

### Table Mode

Table mode returns documents as rows and fields as columns. Best for:

- Lists of documents
- Aggregation results (counts, sums, averages)
- Data that doesn't have a time axis

Example — top 5 users by login count:

```json
[
  { "$sort": { "loginCount": -1 } },
  { "$limit": 5 },
  { "$project": { "_id": 0, "name": 1, "email": 1, "loginCount": 1, "role": 1 } }
]
```

### Time Series Mode

Time series mode expects a time field in each document. Best for:

- Metrics over time
- Sensor data
- Event timelines

You must:
1. Set **Format** to `Time Series`
2. Set **Time Field** to the name of the timestamp field in your documents
3. Ensure the pipeline returns documents sorted by the time field

Example — temperature readings over time:

```json
[
  { "$match": { "sensor": "temperature" } },
  { "$match": { $__timeFilter(timestamp) } },
  { "$sort": { "timestamp": 1 } },
  { "$project": { "_id": 0, "timestamp": 1, "value": 1, "location": 1 } }
]
```

## Template Variables

> **See [Template Variables & Macros](template-variables.md) for the complete reference**, including macros (`$__timeFilter`, `$__timeGroup`, `$__oidFilter`), smart match (`$__match`), and all available variables.

The plugin replaces these variables before sending the pipeline to MongoDB:

### Time Range Variables

| Variable | Description | Replaced With |
|----------|-------------|---------------|
| `$__from` | Start of dashboard time range | `{"$date":"2024-01-01T00:00:00Z"}` (Extended JSON) |
| `$__to` | End of dashboard time range | `{"$date":"2024-01-02T00:00:00Z"}` (Extended JSON) |
| `$__from_ms` | Start as Unix milliseconds | `1704067200000` |
| `$__to_ms` | End as Unix milliseconds | `1704153600000` |
| `$__from_s` | Start as Unix seconds | `1704067200` |
| `$__to_s` | End as Unix seconds | `1704153600` |
| `$__from_oid` | Start as ObjectId (lower bound) | `{"$oid":"659200800000000000000000"}` |
| `$__to_oid` | End as ObjectId (upper bound) | `{"$oid":"65935200ffffffffffffffff"}` |
| `$__range_ms` | Time range duration in milliseconds | `86400000` |
| `$__range_s` | Time range duration in seconds | `86400` |
| `$__interval` | Suggested bucket interval | `60000ms` |
| `$__interval_ms` | Suggested interval in ms | `60000` |
| `$__interval_unit` | MongoDB time unit for `$dateTrunc` | `"minute"` |
| `$__interval_binSize` | Bin size for `$dateTrunc` | `15` |
| `$__maxDataPoints` | Panel's max data points | `500` |

All variables support both `$__var` and `${__var}` syntax.

### Using Time Range in `$match`

The recommended approach is to use the `$__timeFilter` macro:

```json
[
  { "$match": { $__timeFilter(timestamp) } }
]
```

This expands to a `$gte`/`$lte` range using Extended JSON dates. You can also write it manually:

```json
[
  { "$match": {
      "timestamp": {
        "$gte": { "$date": "$__from" },
        "$lte": { "$date": "$__to" }
      }
  }}
]
```

If your timestamps are stored as Unix milliseconds instead of BSON dates:

```json
[
  { "$match": {
      "timestamp_ms": {
        "$gte": $__from_ms,
        "$lte": $__to_ms
      }
  }}
]
```

### Time-Based Bucketing

The recommended approach is to use the `$__timeGroup` macro, which automatically selects the right unit and bin size:

```json
[
  { "$match": { $__timeFilter(timestamp) } },
  { "$group": {
      "_id": $__timeGroup(timestamp),
      "avg_value": { "$avg": "$value" }
  }},
  { "$project": { "_id": 0, "timestamp": "$_id", "avg_value": 1 } },
  { "$sort": { "timestamp": 1 } }
]
```

You can also use `$__interval_ms` directly for manual bucketing, or `$__interval_unit` / `$__interval_binSize` with `$dateTrunc`:

```json
[
  { "$match": { $__timeFilter(timestamp) } },
  { "$group": {
      "_id": {
        "$subtract": [
          { "$toLong": "$timestamp" },
          { "$mod": [{ "$toLong": "$timestamp" }, $__interval_ms] }
        ]
      },
      "avg_value": { "$avg": "$value" }
  }},
  { "$addFields": { "timestamp": { "$toDate": "$_id" } } },
  { "$sort": { "timestamp": 1 } },
  { "$project": { "_id": 0, "timestamp": 1, "avg_value": 1 } }
]
```

### Creating Variables (Query type)

The datasource supports native **Query**-type dashboard variables. In **Dashboard
settings → Variables → New variable → Query**, select this datasource and choose a mode:

- **Builder** — pick a database, collection, and a field. The variable is populated with the
  distinct values of that field (sorted). No pipeline required. The **Field** input
  autocompletes from the collection's [inferred fields](#field-name-autocomplete).
- **Raw pipeline** — write an aggregation pipeline for full control. Return either a single
  column, or `__text`/`__value` columns to use different labels and values (see
  [Distinct Values](#distinct-values)).

Variable queries run through the normal query path, so time-range macros
(`$__timeFilter`, `$__from`/`$__to`) and other dashboard variables are interpolated inside
them. Pair the resulting variable with `$__match` (below) to filter panels.

### Dashboard Variables

Grafana dashboard template variables (e.g., `$sensor`, `$location`) are replaced by the frontend before the query is sent to the backend.

For multi-select variables with an "All" option, use the `$__match` stage instead of a regular `$match`:

```json
[
  { "$__match": { "sensor": ${sensor_type:json}, "location": ${loc:json} } },
  { "$match": { $__timeFilter(timestamp) } },
  { "$sort": { "timestamp": 1 } }
]
```

`$__match` automatically handles single values (exact match), arrays (`$in`), and `"$__all"` (drops the field/stage). See [Template Variables & Macros](template-variables.md) for details.

For simple string matching without multi-select:

```json
[
  { "$match": { "sensor": "$sensor", "location": "$location" } },
  { "$sort": { "timestamp": 1 } }
]
```

## Common Query Patterns

### Count Documents

```json
[{ "$count": "total" }]
```

### Group and Count

```json
[
  { "$group": { "_id": "$status", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
]
```

### Distinct Values

Useful for populating dashboard variable dropdowns. The **Builder** mode of a Query variable
(see [Creating Variables](#creating-variables-query-type)) generates this for you; use the raw
form when you need a custom label/value or extra filtering:

```json
[
  { "$group": { "_id": "$sensor" } },
  { "$sort": { "_id": 1 } },
  { "$project": { "_id": 0, "__text": "$_id", "__value": "$_id" } }
]
```

`__text` is the label shown in the dropdown and `__value` is the value substituted into
queries. Project them to different fields when they should differ; a single column is used
for both.

### Joining Collections with `$lookup`

```json
[
  { "$lookup": {
      "from": "users",
      "localField": "userId",
      "foreignField": "_id",
      "as": "user"
  }},
  { "$unwind": "$user" },
  { "$project": { "_id": 0, "timestamp": 1, "event": 1, "user.name": 1 } }
]
```

### Multiple Series

To display multiple lines on a time series panel (e.g., one per sensor), include a grouping field in your `$project`:

```json
[
  { "$match": { $__timeFilter(timestamp) } },
  { "$sort": { "timestamp": 1 } },
  { "$project": { "_id": 0, "timestamp": 1, "value": 1, "sensor": 1 } }
]
```

Then set the **Legend** field to `{{sensor}}` to label each series by the sensor name.

## BSON Type Handling

The plugin automatically converts BSON types to Grafana DataFrame types:

| BSON Type | DataFrame Type | Notes |
|-----------|---------------|-------|
| String | String | Direct mapping |
| Int32 | Float64 | Widened for consistency |
| Int64 | Float64 | Widened for consistency |
| Double | Float64 | Direct mapping |
| Decimal128 | Float64 | Parsed from string representation |
| Boolean | Bool | Direct mapping |
| Date | Time | Used for time series axis |
| DateTime | Time | Converted to UTC |
| ObjectID | String | Displayed as 24-char hex |
| Null | Null | Nullable field |
| Array | String | JSON-serialized |
| Embedded Document | String | JSON-serialized |
| Binary | String | JSON-serialized |
| Regex | String | JSON-serialized |

## Performance Tips

1. **Always filter with `$match` first** — reduce the working set before other stages
2. **Use `$project` to limit fields** — avoid transferring unnecessary data
3. **Set a `$limit`** — prevent accidentally loading millions of documents
4. **Use indexes** — ensure your `$match` and `$sort` stages use indexed fields
5. **Use `$__timeFilter(field)`** — always scope queries to the dashboard time range for time series data
6. **Use `$__match` instead of `$regex`** — `$__match` uses exact match and `$in`, which leverage indexes; `$regex` forces collection scans
