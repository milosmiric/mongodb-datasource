# Changelog

## v0.1.0 (2026-03-04)

### Initial Release

- MongoDB datasource plugin for Grafana with Go backend and React frontend
- Raw aggregation pipeline query support
- Table and time-series output formats
- Connection URI and individual field configuration
- Authentication support: None, SCRAM-SHA-256, SCRAM-SHA-1, X.509
- TLS/SSL configuration with CA certificate
- Atlas (SRV) connection support
- Template variable interpolation ($__from, $__to, $__interval, custom variables)
- BSON type conversions: ObjectID, Decimal128, Date, Boolean, Int32, Int64, Double, String, Array, embedded documents, null
- Database and collection dropdowns populated from backend
- Health check with server version and replica set info
- Provisioned sample dashboard with time-series, table, and stat panels
- Docker Compose development environment with MongoDB 8 and sample data
- Comprehensive Go unit tests with mock MongoDB client
- React component tests with Jest and React Testing Library
- Playwright E2E test suite
- CI/CD with GitHub Actions (lint, test, build, E2E, release)
