# Contributing

Thank you for your interest in contributing to the MongoDB Datasource Plugin for Grafana!

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0 (package manager)
- [Go](https://go.dev/) >= 1.23
- [Docker](https://www.docker.com/) and Docker Compose

### Getting Started

```bash
# Clone the repository
git clone https://github.com/milosmiric/mongodb-datasource.git
cd mongodb-datasource

# Install frontend dependencies
bun install

# Start the development environment
docker compose up -d

# Build frontend (watch mode)
bun run dev

# Build backend
go build -o dist/gpx_mongodb-datasource_$(go env GOOS)_$(go env GOARCH) ./pkg
```

## Branch Naming

- `feature/<description>` — new features
- `fix/<description>` — bug fixes
- `refactor/<description>` — code refactoring
- `docs/<description>` — documentation changes
- `test/<description>` — test additions or fixes

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes following the code style guidelines below
3. Add or update tests for your changes
4. Ensure all tests pass:
   ```bash
   go test ./pkg/... -v -race
   bun run test
   bun run typecheck
   bun run lint
   ```
5. Update documentation if needed
6. Submit a pull request with a clear description of the changes

## Code Style

### Go

- Follow standard Go conventions and `gofmt`
- All exported types, functions, and methods must have GoDoc comments
- Use table-driven tests
- Use `testify/assert` and `testify/require` for assertions
- Use structured logging with `log.DefaultLogger`
- Wrap errors with `fmt.Errorf("context: %w", err)`
- Run `golangci-lint run` before submitting

### TypeScript/React

- No `any` types — define proper interfaces
- Functional components only with hooks
- Use `@grafana/ui` components
- All components must have accessibility labels
- JSDoc comments on all exported items
- Run `bun run lint` and `bun run typecheck` before submitting

## Running the Full Test Suite

```bash
# Backend
go test ./pkg/... -v -race

# Frontend unit tests
bun run test

# Type checking
bun run typecheck

# Linting
bun run lint
go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run

# E2E tests (requires Docker Compose)
docker compose up -d
bun run e2e:install
bun run e2e
docker compose down
```

## Package Manager

**Bun is the only package manager for this project.** Do not use npm, yarn, or pnpm. All commands should use `bun` or `bunx`.

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0.
