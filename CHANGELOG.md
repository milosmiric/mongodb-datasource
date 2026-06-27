# Changelog

## v0.2.0 (2026-06-27)

### Fixed

- Datasource now reconnects to MongoDB on demand instead of failing permanently. Previously, if MongoDB was briefly unavailable when the datasource instance was created (e.g. a replica set still electing a primary, or a transient restart), the client was left uninitialized and every query/panel reported "MongoDB client not initialized" until the datasource was re-saved. Connections are now retried lazily on each query, health check, and resource call.

### Maintenance & Compatibility

- Grafana 13 support: bumped `@grafana/*` frontend packages from 12.4 to 13.1.0 (`grafanaDependency` floor kept at `>=12.3.0`, so Grafana 12 remains supported)
- Updated `@grafana/create-plugin` scaffold from 7.0.3 to 7.8.0
- Backend: bumped `grafana-plugin-sdk-go` from 0.290.0 to 0.292.1
- Dev tooling: jest 29 → 30, prettier 3.8.3, sass 1.98.0, terser-webpack-plugin 5.4.0, plugin-e2e 3.9.1
- CI: bumped GitHub Actions (mage-action v4, e2e-version v2.0.0, wait-for-grafana v1.0.3, is-compatible v1.0.3, create-plugin-update v2.0.2)
- E2E: updated query-editor selectors for Grafana 13 DOM changes (renamed `query-editor-row` test id, `InlineField` label rendering, `RadioButtonGroup` markup)

## v0.1.0 (2026-03-06)

### Initial Release

- MongoDB datasource plugin for Grafana with Go backend and React frontend
- Raw aggregation pipeline query support
- Table and time-series output formats
- Connection URI and individual field configuration
- Authentication support: None, SCRAM-SHA-256, SCRAM-SHA-1, X.509
- TLS/SSL configuration with CA certificate
- Atlas (SRV) connection support
- BSON type conversions: ObjectID, Decimal128, Date, Boolean, Int32, Int64, Double, String, Array, embedded documents, null
- Database and collection dropdowns populated from backend
- Health check with server version and replica set info

### Macros & Variables

- **Macros**: `$__timeFilter(field)`, `$__timeFilter_ms(field)`, `$__oidFilter(field)`, `$__timeGroup(field)` for concise pipeline expressions
- **Smart match** (`$__match`): Index-friendly template variable filtering with automatic All/single/multi-value handling
- **Template variables**: `$__from`, `$__to`, `$__from_s`, `$__to_s`, `$__from_oid`, `$__to_oid`, `$__range_ms`, `$__range_s`, `$__interval`, `$__interval_ms`, `$__interval_unit`, `$__interval_binSize`, `$__maxDataPoints`
- **Multi-select support**: Dashboard variables with `$__match` handle multi-value selections via `$in`
- Extended JSON ObjectId format (`{"$oid":"..."}`) for proper BSON parsing
- `$__all` normalization for reliable handling of Grafana's allValue interpolation

### Dashboard & Tooling

- Provisioned sample dashboard with time-series, table, stat, gauge, pie, bar chart, and bar gauge panels
- Docker Compose development environment with MongoDB 8, TLS, and sample data
- CI/CD with GitHub Actions (lint, test, build, E2E, release)
- E2E tests using `@grafana/plugin-e2e` — verified across Grafana 12.3, 12.4, and 13.0
- 55 Go unit tests, 24 frontend tests, 49 E2E tests
