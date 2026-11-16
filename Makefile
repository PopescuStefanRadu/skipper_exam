.DEFAULT_GOAL := help

.PHONY: help build run test vet fmt tidy check db-up db-down db-logs

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-10s %s\n", $$1, $$2}'

build: ## Build all packages
	go build ./...

run: ## Run the server
	go run ./cli/server

test: ## Run tests (single test: make test RUN=TestName PKG=./pkg/skipperexam/game)
	go test $(if $(RUN),-run $(RUN)) $(or $(PKG),./...)

vet: ## Run go vet
	go vet ./...

fmt: ## Format code
	go fmt ./...

tidy: ## Tidy go.mod/go.sum
	go mod tidy

check: fmt vet test ## Format, vet and test

db-up: ## Start Postgres
	docker compose up -d db

db-down: ## Stop Postgres
	docker compose down

db-logs: ## Follow Postgres logs
	docker compose logs -f db
