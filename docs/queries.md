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
  { "$match": {
      "sensor": "temperature",
      "timestamp": {
        "$gte": { "$date": "$__from" },
        "$lte": { "$date": "$__to" }
      }
  }},
  { "$sort": { "timestamp": 1 } },
  { "$project": { "_id": 0, "timestamp": 1, "value": 1, "location": 1 } }
]
```

## Template Variables

The plugin replaces these variables before sending the pipeline to MongoDB:

### Time Range Variables

| Variable | Description | Replaced With |
|----------|-------------|---------------|
| `$__from` | Start of dashboard time range | `{"$date":"2024-01-01T00:00:00Z"}` (Extended JSON) |
| `$__to` | End of dashboard time range | `{"$date":"2024-01-02T00:00:00Z"}` (Extended JSON) |
| `$__from_ms` | Start as Unix milliseconds | `1704067200000` |
| `$__to_ms` | End as Unix milliseconds | `1704153600000` |
| `$__interval` | Suggested bucket interval | `60000ms` |
| `$__interval_ms` | Suggested interval in ms | `60000` |

All variables support both `$__var` and `${__var}` syntax.

### Using Time Range in `$match`

The most common pattern is filtering documents to the dashboard's selected time range:

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

Use `$__interval_ms` for grouping data into time buckets:

```json
[
  { "$match": { "timestamp": { "$gte": { "$date": "$__from" }, "$lte": { "$date": "$__to" } } } },
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

### Dashboard Variables

Grafana dashboard template variables (e.g., `$sensor`, `$location`) are replaced by the frontend before the query is sent to the backend:

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

Useful for populating dashboard variable dropdowns:

```json
[
  { "$group": { "_id": "$sensor" } },
  { "$sort": { "_id": 1 } },
  { "$project": { "_id": 0, "__text": "$_id", "__value": "$_id" } }
]
```

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
  { "$match": { "timestamp": { "$gte": { "$date": "$__from" }, "$lte": { "$date": "$__to" } } } },
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
5. **Prefer `$__from`/`$__to`** — always scope queries to the dashboard time range for time series data
