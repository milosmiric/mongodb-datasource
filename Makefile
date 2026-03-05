# MongoDB Datasource Plugin for Grafana — Development Commands
#
# Usage: make <target>
# Run `make help` to see all available targets.

PLUGIN_ID    := milosmiric-mongodb-datasource
GO_BINARY    := gpx_mongodb_datasource
GOOS         ?= $(shell go env GOOS)
GOARCH       ?= $(shell go env GOARCH)
DIST         := dist
MONGO_HOST   := localhost
MONGO_PORT   := 27105
GRAFANA_PORT := 3105

.DEFAULT_GOAL := help

# ─── Build ──────────────────────────────────────────────────────────

.PHONY: build
build: build-frontend build-backend ## Build both frontend and backend

.PHONY: build-frontend
build-frontend: ## Build the React frontend (production)
	npm run build

.PHONY: build-backend
build-backend: ## Build the Go backend for the current platform (with manifest)
	mage build:$(GOOS)

.PHONY: build-backend-debug
build-backend-debug: ## Build the Go backend with debug symbols
	go build -gcflags="all=-N -l" -o $(DIST)/$(GO_BINARY)_$(GOOS)_$(GOARCH) ./pkg

.PHONY: build-backend-all
build-backend-all: ## Cross-compile the Go backend for all platforms (with manifest)
	mage buildAll

.PHONY: dev
dev: ## Start frontend in watch mode (auto-rebuild on changes)
	npm run dev

# ─── Test ───────────────────────────────────────────────────────────

.PHONY: test
test: test-backend test-frontend ## Run all tests (Go + Jest)

.PHONY: test-backend
test-backend: ## Run Go unit tests with race detector
	go test ./pkg/... -v -race

.PHONY: test-backend-cover
test-backend-cover: ## Run Go tests with coverage report
	go test ./pkg/... -v -race -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

.PHONY: test-frontend
test-frontend: ## Run Jest frontend unit tests
	npm run test -- --ci

.PHONY: test-frontend-cover
test-frontend-cover: ## Run Jest tests with coverage
	npm run test -- --ci --coverage

.PHONY: e2e
e2e: ## Run Playwright E2E tests (requires Docker running)
	npm run e2e

.PHONY: e2e-ui
e2e-ui: ## Run Playwright E2E tests with interactive UI
	npm run e2e:ui

.PHONY: e2e-install
e2e-install: ## Install Playwright browsers
	npm run e2e:install

# ─── Lint & Check ──────────────────────────────────────────────────

.PHONY: lint
lint: lint-frontend lint-backend ## Run all linters

.PHONY: lint-frontend
lint-frontend: ## Run ESLint on frontend code
	npm run lint

.PHONY: lint-fix
lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

.PHONY: lint-backend
lint-backend: ## Run golangci-lint on Go code
	golangci-lint run ./pkg/...

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	npm run typecheck

.PHONY: check
check: lint typecheck test ## Run all linters, type checks, and tests

# ─── Docker / Dev Environment ──────────────────────────────────────

.PHONY: up
up: ## Start the development environment (Grafana + MongoDB)
	docker compose up -d
	@echo ""
	@echo "Grafana:  http://localhost:$(GRAFANA_PORT)  (admin/admin)"
	@echo "MongoDB:  mongodb://localhost:$(MONGO_PORT)"

.PHONY: down
down: ## Stop the development environment
	docker compose down

.PHONY: restart
restart: ## Restart all containers
	docker compose restart

.PHONY: restart-grafana
restart-grafana: ## Restart only Grafana (picks up new backend binary)
	docker compose restart grafana

.PHONY: logs
logs: ## Tail logs from all containers
	docker compose logs -f

.PHONY: logs-grafana
logs-grafana: ## Tail Grafana logs only
	docker compose logs -f grafana

.PHONY: logs-mongo
logs-mongo: ## Tail MongoDB logs only
	docker compose logs -f mongodb

# ─── Database ──────────────────────────────────────────────────────

.PHONY: db-seed
db-seed: ## Seed MongoDB with fresh demo data (drops existing collections)
	docker compose exec mongodb mongosh --quiet --file /seed/seed.js
	@echo "Database seeded."

.PHONY: db-reseed
db-reseed: ## Re-seed by running the seed container
	docker compose run --rm mongo-seed
	@echo "Database re-seeded."

.PHONY: db-reset
db-reset: ## Drop the demo database entirely, then re-seed
	docker compose exec mongodb mongosh --quiet --eval 'db.getSiblingDB("demo").dropDatabase(); print("demo database dropped.");'
	docker compose run --rm mongo-seed
	@echo "Database reset and re-seeded."

.PHONY: db-shell
db-shell: ## Open an interactive MongoDB shell
	docker compose exec mongodb mongosh

.PHONY: db-stats
db-stats: ## Show collection stats for the demo database
	docker compose exec mongodb mongosh --quiet --eval ' \
		const db = db.getSiblingDB("demo"); \
		db.getCollectionNames().forEach(function(c) { \
			const stats = db[c].stats(); \
			print(c + ": " + stats.count + " docs, " + (stats.size / 1024).toFixed(1) + " KB"); \
		}); \
	'

.PHONY: db-random
db-random: ## Generate and insert random sensor data (500 readings, last hour)
	docker compose exec mongodb mongosh --quiet --eval ' \
		const db = db.getSiblingDB("demo"); \
		const sensors = ["temperature", "humidity", "pressure", "wind_speed"]; \
		const locations = ["building_a", "building_b", "outdoor", "warehouse", "rooftop"]; \
		const units = {"temperature": "°C", "humidity": "%", "pressure": "hPa", "wind_speed": "m/s"}; \
		const now = new Date(); \
		const docs = []; \
		for (let i = 0; i < 500; i++) { \
			const sensor = sensors[Math.floor(Math.random() * sensors.length)]; \
			const location = locations[Math.floor(Math.random() * locations.length)]; \
			const ts = new Date(now.getTime() - Math.random() * 3600000); \
			let value; \
			switch(sensor) { \
				case "temperature": value = 15 + Math.random() * 20; break; \
				case "humidity":    value = 30 + Math.random() * 50; break; \
				case "pressure":    value = 1000 + Math.random() * 30; break; \
				case "wind_speed":  value = Math.random() * 25; break; \
			} \
			docs.push({ \
				timestamp: ts, \
				sensor: sensor, \
				location: location, \
				value: Math.round(value * 100) / 100, \
				unit: units[sensor], \
				quality: Math.random() > 0.05 ? "good" : "suspect" \
			}); \
		} \
		db.sensors.insertMany(docs); \
		print("Inserted 500 random sensor readings spanning the last hour."); \
	'

# ─── Plugin Lifecycle ─────────────────────────────────────────────

.PHONY: rebuild
rebuild: build restart-grafana ## Rebuild everything and restart Grafana
	@echo ""
	@echo "Plugin rebuilt. Grafana restarting at http://localhost:$(GRAFANA_PORT)"

.PHONY: health
PRETTY_JSON := node -e 'let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>console.log(JSON.stringify(JSON.parse(d),null,2)))'

health: ## Check Grafana and datasource health
	@echo "Grafana health:"
	@curl -sf http://localhost:$(GRAFANA_PORT)/api/health | $(PRETTY_JSON) 2>/dev/null || echo "  Grafana not reachable on port $(GRAFANA_PORT)"
	@echo ""
	@echo "Datasource health:"
	@curl -sf -u admin:admin http://localhost:$(GRAFANA_PORT)/api/datasources/uid/mongodb-demo/health | $(PRETTY_JSON) 2>/dev/null || echo "  Datasource not reachable"

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf $(DIST) coverage/ coverage.out coverage.html test-results/ playwright-report/

.PHONY: clean-all
clean-all: clean ## Remove build artifacts + Docker volumes
	docker compose down -v
	@echo "Docker volumes removed."

.PHONY: fresh
fresh: clean-all build up ## Full clean rebuild: wipe everything, build, start fresh
	@echo ""
	@echo "Fresh environment ready at http://localhost:$(GRAFANA_PORT)"

# ─── Help ──────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@echo "MongoDB Datasource Plugin — Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Ports: Grafana=$(GRAFANA_PORT)  MongoDB=$(MONGO_PORT)"
