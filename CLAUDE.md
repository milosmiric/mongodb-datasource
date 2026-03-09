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
- Template variable interpolation: `$__from`, `$__to`, `$__from_ms`, `$__to_ms`, `$__from_s`, `$__to_s`, `$__from_oid`, `$__to_oid`, `$__range_ms`, `$__range_s`, `$__interval`, `$__interval_ms`, `$__interval_unit`, `$__interval_binSize`, `$__maxDataPoints`
- Macros: `$__timeFilter(field)`, `$__timeFilter_ms(field)`, `$__oidFilter(field)`, `$__timeGroup(field)`
- Smart match: `$__match` stage handles All/single/multi-value with index-friendly operators

## Package Manager

**npm only.** No bun, yarn, or pnpm. All commands use `npm` or `npx`.

## Ports

- Grafana: **3105** (not 3000)
- MongoDB: **27105** (not 27017)
- Delve debugger: **2345** (disabled by default — uncomment in `.config/docker-compose-base.yaml`)

## Commands

**Prefer `make` targets** over raw commands. Run `make help` to see all targets.

```bash
# Build
make build              # Build frontend + backend
make build-frontend     # Frontend only (npm run build)
make build-backend      # Go backend for current platform
make dev                # Frontend watch mode (npm run dev)

# Test
make test               # All tests (Go + Jest)
make test-backend       # Go tests with race detector
make test-frontend      # Jest frontend tests
make e2e                # Playwright E2E tests (requires Docker)
make e2e-install        # Install Playwright browsers

# Lint & Check
make lint               # All linters (ESLint + golangci-lint)
make typecheck          # TypeScript type checking
make check              # lint + typecheck + test

# Docker
make up                 # Start Grafana + MongoDB
make down               # Stop containers
make restart-grafana    # Restart Grafana (picks up new backend binary)
make rebuild            # Build everything + restart Grafana
make logs               # Tail all container logs

# Database
make db-seed            # Seed demo data
make db-reset           # Drop + re-seed
make db-shell           # Interactive MongoDB shell
make db-random          # Insert 500 random sensor readings

# Utilities
make health             # Check Grafana + datasource health
make clean              # Remove build artifacts
make fresh              # Full clean rebuild from scratch
```

## File Structure

- `pkg/plugin/datasource.go` — Main datasource implementation + MongoClient interface
- `pkg/plugin/query.go` — Query parsing, pipeline building, variable interpolation
- `pkg/plugin/converters.go` — BSON → DataFrame conversion
- `pkg/plugin/models.go` — Query and settings type definitions
- `pkg/plugin/errors.go` — Sentinel errors (ErrInvalidMacro, etc.)
- `src/components/ConfigEditor/` — Datasource settings form
- `src/components/QueryEditor/` — Query editor with sub-components (PipelineEditor has formatPipeline)
- `src/hooks/` — Data fetching hooks (useDatabases, useCollections)
- `src/types.ts` — TypeScript type definitions
- `provisioning/` — Grafana provisioning (datasource + dashboards)
- `docker/mongo-seed/` — MongoDB seed data
- `docs/template-variables.md` — Complete reference for variables, macros, and $__match
- `docs/queries.md` — Query guide with pipeline patterns and examples
- `docs/e2e-testing.md` — @grafana/plugin-e2e patterns, fixtures, and gotchas

## Dependencies

- Go: `grafana-plugin-sdk-go` v0.290.0, `mongo-driver/v2` v2.5.0
- Frontend: `@grafana/data`, `@grafana/runtime`, `@grafana/ui` v12.4.x
- Target: Grafana >= 12.3

## Testing

- Go: Table-driven tests with `testify`, mock `MongoClient` interface
- Frontend: Jest + React Testing Library
- E2E: Playwright targeting `http://localhost:3105`

### E2E Testing Reference

Tests use `@grafana/plugin-e2e` — Grafana's official E2E framework. See [docs/e2e-testing.md](docs/e2e-testing.md) for patterns and gotchas including:
- Use `panelEditPage`, `gotoDashboardPage`, `gotoDataSourceConfigPage` fixtures (not manual navigation)
- Use `panelEditPage.setVisualization()` and `panelEditPage.refreshPanel()` (not manual DOM clicks)
- Use `panel.getErrorIcon()` for dashboard panel assertions (`panel.data` only works in edit mode)
- Monaco editor default values require explicit blur to commit to query model
- Template variable names must not collide with MongoDB field references (`$field`)
- `$__from`/`$__to` are replaced by Grafana frontend with epoch ms before backend processing
