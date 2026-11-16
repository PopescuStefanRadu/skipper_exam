.DEFAULT_GOAL := help

.PHONY: help setup build test e2e test-all check vet fmt tidy up down status dev task-new task-done integrate

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-10s %s\n", $$1, $$2}'

setup: ## Install web and e2e dependencies and the test browser
	cd web && pnpm install --frozen-lockfile
	cd e2e && pnpm install --frozen-lockfile && pnpm exec playwright install $(if $(CI),--with-deps) chromium

build: ## Build the backend and the web app
	go build ./...
	cd web && pnpm build

test: ## Run the Go tests (single test: make test RUN=TestName PKG=./pkg/skipperexam/server)
	go test $(if $(RUN),-run $(RUN)) $(or $(PKG),./...)

e2e: up ## Run the e2e tests against this worktree's stack (filter: make e2e ARGS="-g 'deep link'")
	cd e2e && pnpm exec tsc -p . && pnpm exec playwright test $(ARGS)

test-all: check e2e ## Everything: fmt, vet, Go tests, web type check, e2e

check: fmt vet test ## Format, vet, Go tests and web type check
	cd web && pnpm typecheck

vet: ## Run go vet
	go vet ./...

fmt: ## Format Go code
	go fmt ./...

tidy: ## Tidy go.mod/go.sum
	go mod tidy

up: ## Build and start this worktree's stack on free ports (writes .stack.env)
	scripts/stack.sh up

down: ## Stop this worktree's stack and delete its data
	scripts/stack.sh down

status: ## Show this worktree's stack
	scripts/stack.sh status

dev: up ## Run the web app with hot reload against this worktree's backend (Vite picks the next free port if 5173 is taken)
	. ./.stack.env && cd web && API_URL=$$APP_URL pnpm dev

task-new: ## Create a task worktree from the latest origin/main: make task-new NAME=<name>
	scripts/task.sh new $(NAME)

task-done: ## After the PR is merged: stop the stack, remove the worktree and branch: make task-done NAME=<name>
	scripts/task.sh done $(NAME)

integrate: ## In a task worktree: rebase on origin/main, test-all, push, PR, wait for CI, merge; repeats if main moves
	scripts/task.sh integrate
