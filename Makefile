.DEFAULT_GOAL := help

.PHONY: android-e2e android-build android-image grant-reviewer content-extract content-validate content-tag content-import-rna help setup build test e2e test-all check vet fmt tidy up down status screenshots dev task-new task-done integrate

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-10s %s\n", $$1, $$2}'

setup: ## Install web and e2e dependencies and the test browser
	cd web && pnpm install --frozen-lockfile
	cd e2e && pnpm install --frozen-lockfile && pnpm exec playwright install $(if $(CI),--with-deps) chromium

build: ## Build the backend and the web app
	go build ./...
	cd web && pnpm build

# Every test target records its run in test-runs/ and needs a clean, committed tree.
test: ## Go tests (single test: make test RUN=TestName PKG=./pkg/skipperexam/server)
	GO_TEST_ARGS="$(if $(RUN),-run $(RUN)) $(or $(PKG),./...)" scripts/test-run.sh go

e2e: ## E2E tests against this worktree's stack, started if needed (filter: make e2e ARGS="tests/accounts" or ARGS="-g 'deep link'"; file filters match the whole path)
	E2E_ARGS="$(ARGS)" scripts/test-run.sh e2e

screenshots: ## Screenshots of every screen on both platforms, saved in the test run's folder
	E2E_ARGS="tests/screens" scripts/test-run.sh e2e
	@echo "screenshots: $$(ls -td test-runs/*/screenshots | head -1)"

check: ## Lint (gofmt check, vet, type checks) and Go tests
	scripts/test-run.sh lint go

test-all: ## Everything: lint, Go tests, e2e, Android e2e
	scripts/test-run.sh lint go e2e android

android-e2e: ## Build the Android app and run its flows on an emulator (in Docker; needs /dev/kvm)
	scripts/test-run.sh android

android-build: ## Build a debug APK (web/android/app/build/outputs/apk/debug/) for SERVER_URL (default: this worktree's stack)
	SERVER_URL="$(SERVER_URL)" scripts/android.sh build

android-image: ## Build the Android toolchain image (SDK, emulator, Maestro); done automatically on first use
	scripts/android.sh image

vet: ## Run go vet
	go vet ./...

fmt: ## Format Go code
	go fmt ./...

tidy: ## Tidy go.mod/go.sum
	go mod tidy

grant-reviewer: ## Give an account of this worktree's stack the reviewer role (EMAIL=...)
	docker exec $$(sed -n 's/^STACK_PROJECT=//p' .stack.env)-app-1 /server grant-role -email "$(EMAIL)" -role reviewer

content-extract: ## Extract the bibliography's text into content/bibliography/ (needs poppler-utils and Docker for OCR; SOURCE=id for one)
	docker build -q -t skipper-exam-ocr docker/ocr >/dev/null
	go run ./cli/content extract-text $(if $(SOURCE),-source $(SOURCE))

content-validate: ## Validate the content in content/
	go run ./cli/content validate

content-tag: ## Apply content/subject-ranges.json to the question pool
	go run ./cli/content tag

content-import-rna: ## Re-import an RNA question list: make content-import-rna BANK=C (after replacing its PDF)
	go run ./cli/content import-rna -bank $(BANK) -file sources/rna/Lista-intrebari-clasa-$(BANK)-CAA.pdf \
		-url https://portal.rna.ro/wp-content/uploads/2026/07/Lista-intrebari-clasa-$(BANK)-CAA.pdf $(if $(LAST_MODIFIED),-last-modified $(LAST_MODIFIED))

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

integrate: ## In a task worktree: squash, rebase on origin/main, test-all, push, PR, wait for CI, merge; repeats if main moves (TITLE="...")
	TITLE="$(TITLE)" scripts/task.sh integrate
