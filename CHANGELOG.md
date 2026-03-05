# Changelog

## v0.2.0 (2026-03-05)

### Features

- **Macros**: `$__timeFilter(field)`, `$__timeFilter_ms(field)`, `$__oidFilter(field)`, `$__timeGroup(field)` for concise pipeline expressions
- **Smart match** (`$__match`): Index-friendly template variable filtering with automatic All/single/multi-value handling
- **New variables**: `$__from_s`, `$__to_s`, `$__from_oid`, `$__to_oid`, `$__range_ms`, `$__range_s`, `$__interval_unit`, `$__interval_binSize`, `$__maxDataPoints`
- **Interval decomposition**: `$__interval_unit` and `$__interval_binSize` for `$dateTrunc` expressions
- **Multi-select support**: Dashboard variables with `$__match` handle multi-value selections via `$in`
- **Sample dashboard**: Rewritten with macros, `$__match`, and multi-select enabled template variables
- **Documentation**: Comprehensive template variables and macros reference guide

### Improvements

- Pipeline editor `Format` button handles macros with arguments correctly
- Extended JSON ObjectId format (`{"$oid":"..."}`) for proper BSON parsing
- `$__all` normalization for reliable handling of Grafana's allValue interpolation

### Testing

- 55 Go unit tests covering variables, macros, `$__match`, interval decomposition
- 35 frontend tests including PipelineEditor formatting with macros
- 48 E2E tests covering macros, template variable interactions, and dashboard panels

## v0.1.0 (2026-03-04)

### Initial Release

- MongoDB datasource plugin for Grafana with Go backend and React frontend
- Raw aggregation pipeline query support
- Table and time-series output formats
- Connection URI and individual field configuration
- Authentication support: None, SCRAM-SHA-256, SCRAM-SHA-1, X.509
- TLS/SSL configuration with CA certificate
- Atlas (SRV) connection support
- Template variable interpolation (`$__from`, `$__to`, `$__interval`, custom variables)
- BSON type conversions: ObjectID, Decimal128, Date, Boolean, Int32, Int64, Double, String, Array, embedded documents, null
- Database and collection dropdowns populated from backend
- Health check with server version and replica set info
- Provisioned sample dashboard with time-series, table, and stat panels
- Docker Compose development environment with MongoDB 8 and sample data
- CI/CD with GitHub Actions (lint, test, build, E2E, release)
