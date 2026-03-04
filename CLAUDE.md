# MongoDB Datasource Plugin for Grafana

## Project Overview

Open-source Grafana datasource plugin for MongoDB. Plugin ID: `milosmiric-mongodb-datasource`.

## Architecture

- **Go backend** (`pkg/`): Handles MongoDB connections, query execution, BSON-to-DataFrame conversion
- **React/TypeScript frontend** (`src/`): Config and query editor components
- **Entry point**: `pkg/main.go` → `datasource.Manage()` starts gRPC server
- **Frontend entry**: `src/module.ts` → registers `DataSourcePlugin`

## Key Patterns

- Dependency injection via `MongoClient` interface for testability
- One `*mongo.Client` per datasource instance, disposed on settings change
- Structured logging with `log.DefaultLogger`
- Context propagation through all query/connection methods
- Error wrapping with `fmt.Errorf("context: %w", err)`
- Template variable interpolation: `$__from`, `$__to`, `$__interval`, `$__from_ms`, `$__to_ms`

## Package Manager

**Bun only.** No npm, yarn, or pnpm. All commands use `bun` or `bunx`.

## Ports

- Grafana: **3105** (not 3000)
- MongoDB: **27020** (not 27017)
- Delve debugger: **2345**

## Commands

```bash
# Frontend
bun install          # Install dependencies
bun run dev          # Watch mode build
bun run build        # Production build
bun run test         # Jest unit tests
bun run typecheck    # TypeScript check
bun run lint         # ESLint

# Backend
go test ./pkg/... -v -race   # Go tests
go build -o dist/gpx_mongodb-datasource_$(go env GOOS)_$(go env GOARCH) ./pkg

# Docker
docker compose up -d   # Start dev environment
docker compose down    # Stop dev environment

# E2E
bun run e2e:install   # Install Playwright
bun run e2e           # Run E2E tests
```

## File Structure

- `pkg/plugin/datasource.go` — Main datasource implementation + MongoClient interface
- `pkg/plugin/query.go` — Query parsing, pipeline building, variable interpolation
- `pkg/plugin/converters.go` — BSON → DataFrame conversion
- `pkg/plugin/models.go` — Query and settings type definitions
- `pkg/plugin/errors.go` — Sentinel errors
- `src/components/ConfigEditor/` — Datasource settings form
- `src/components/QueryEditor/` — Query editor with sub-components
- `src/hooks/` — Data fetching hooks (useDatabases, useCollections)
- `src/types.ts` — TypeScript type definitions
- `provisioning/` — Grafana provisioning (datasource + dashboards)
- `docker/mongo-seed/` — MongoDB seed data

## Dependencies

- Go: `grafana-plugin-sdk-go` v0.290.0, `mongo-driver/v2` v2.5.0
- Frontend: `@grafana/data`, `@grafana/runtime`, `@grafana/ui` v11.4.x
- Target: Grafana >= 11.0

## Testing

- Go: Table-driven tests with `testify`, mock `MongoClient` interface
- Frontend: Jest + React Testing Library
- E2E: Playwright targeting `http://localhost:3105`
