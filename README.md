# MongoDB Datasource Plugin for Grafana

A production-quality, open-source MongoDB datasource plugin for Grafana. Query MongoDB collections using aggregation pipelines with full time-series and table support.

## Why This Plugin?

The official Grafana MongoDB plugin is **Enterprise-only**. The best community alternative is pre-release (v0.5.x). This plugin fills the gap with:

- Go backend for secure, high-performance MongoDB communication
- Raw aggregation pipeline queries with template variable support
- Time-series and table output formats
- Full BSON type conversion (ObjectID, Decimal128, Date, arrays, embedded docs, etc.)
- Docker Compose development environment with sample data out of the box

## Screenshots

<!-- TODO: Add screenshots -->
<!-- ![Config Editor](docs/screenshots/config-editor.png) -->
<!-- ![Query Editor](docs/screenshots/query-editor.png) -->
<!-- ![Sample Dashboard](docs/screenshots/sample-dashboard.png) -->

## Quick Start

```bash
docker compose up
```

Open [http://localhost:3105](http://localhost:3105) (admin/admin). The MongoDB datasource and a sample dashboard are pre-configured with demo data.

## Installation

### Grafana CLI

```bash
grafana-cli plugins install milosmiric-mongodb-datasource
```

### Manual

1. Download the latest release from [GitHub Releases](https://github.com/milosmiric/mongodb-datasource/releases)
2. Extract to your Grafana plugins directory (e.g., `/var/lib/grafana/plugins/`)
3. Restart Grafana

## Configuration

Point the datasource at your MongoDB instance using a connection URI:

```
mongodb://username:password@host:port/database
```

Supports SCRAM-SHA-256, SCRAM-SHA-1, X.509 authentication, TLS/SSL, and Atlas SRV connections.

See [docs/configuration.md](docs/configuration.md) for the full configuration guide including provisioning examples.

## Query Examples

Queries use MongoDB [aggregation pipelines](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/). Select a database and collection, then write a pipeline as a JSON array.

**Time series** — sensor readings scoped to the dashboard time range:

```json
[
  {"$match": {"sensor": "temperature", "timestamp": {"$gte": {"$date": "$__from"}, "$lte": {"$date": "$__to"}}}},
  {"$sort": {"timestamp": 1}},
  {"$project": {"_id": 0, "timestamp": 1, "value": 1, "location": 1}}
]
```

**Table** — recent documents:

```json
[
  {"$sort": {"timestamp": -1}},
  {"$limit": 100},
  {"$project": {"_id": 0, "name": 1, "email": 1, "role": 1}}
]
```

**Aggregation** — group and count:

```json
[
  {"$group": {"_id": "$type", "count": {"$sum": 1}}},
  {"$sort": {"count": -1}}
]
```

Template variables: `$__from`, `$__to`, `$__from_ms`, `$__to_ms`, `$__interval`, `$__interval_ms`, plus custom dashboard variables.

See [docs/queries.md](docs/queries.md) for the complete query guide with patterns for time bucketing, joins, variable dropdowns, and performance tips.

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Go](https://go.dev/) >= 1.23
- [Docker](https://www.docker.com/) and Docker Compose

### Build & Run

```bash
bun install                   # Install frontend dependencies
make build                    # Build frontend + backend
make up                       # Start Grafana + MongoDB
```

### Common Commands

All development tasks are available as `make` targets. Run `make help` for the full list.

| Command | Description |
|---------|-------------|
| `make build` | Build frontend and backend |
| `make dev` | Start frontend in watch mode |
| `make test` | Run all tests (Go + Jest) |
| `make lint` | Run all linters |
| `make up` / `make down` | Start / stop Docker environment |
| `make rebuild` | Build everything and restart Grafana |
| `make db-seed` | Seed MongoDB with demo data |
| `make db-reset` | Drop demo database and re-seed |
| `make db-random` | Insert 500 random sensor readings |
| `make health` | Check Grafana and datasource health |
| `make fresh` | Full clean rebuild from scratch |

See [docs/development.md](docs/development.md) for the full development guide covering architecture, debugging, CI/CD, and project structure.

## Architecture

```mermaid
graph LR
    A[Grafana Frontend] -->|gRPC| B[Go Backend Plugin]
    B -->|mongo-driver/v2| C[MongoDB]
    A -->|React Components| D[Query Editor]
    A -->|React Components| E[Config Editor]
    D -->|HTTP Resource| B
    E -->|HTTP Resource| B
```

- **Frontend** (`src/`): React/TypeScript — config editor, query editor, data fetching hooks
- **Backend** (`pkg/`): Go — MongoDB connections, aggregation pipeline execution, BSON→DataFrame conversion
- **Communication**: `DataSourceWithBackend` proxies queries to the Go backend via gRPC

## Roadmap

Future milestones:

- Visual query builder (drag-and-drop pipeline stages)
- Change streams / live streaming
- Schema introspection and field autocomplete
- Alerting-specific features
- Annotation queries
- Explore integration
- Connection string builder UI

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, PR process, code style, and test requirements.

## License

Apache License 2.0. See [LICENSE](LICENSE).
