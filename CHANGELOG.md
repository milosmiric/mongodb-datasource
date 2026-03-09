# Changelog

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
