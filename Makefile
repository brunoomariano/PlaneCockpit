.DEFAULT_GOAL := help

PNPM ?= pnpm
NODE ?= node

# ----- setup -----

.PHONY: bootstrap
bootstrap: ## install dev toolchain (mise) and project dependencies
	mise install
	$(PNPM) install

.PHONY: install
install: ## install project dependencies only
	$(PNPM) install

# ----- code quality -----

.PHONY: fmt
fmt: ## format the codebase
	$(PNPM) run fmt

.PHONY: fmt-check
fmt-check: ## check formatting without writing
	$(PNPM) run fmt:check

.PHONY: lint
lint: ## run eslint
	$(PNPM) run lint

.PHONY: typecheck
typecheck: ## run typescript in no-emit mode
	$(PNPM) run typecheck

# ----- tests -----

.PHONY: test
test: ## run unit tests
	$(PNPM) run test

.PHONY: test-watch
test-watch: ## run unit tests in watch mode
	$(PNPM) run test:watch

.PHONY: test-cov
test-cov: ## run tests with coverage (min 95%)
	$(PNPM) run test:cov

.PHONY: cov
cov: test-cov ## alias for test-cov

# ----- build / run -----

.PHONY: build
build: ## build production bundle
	$(PNPM) run build

.PHONY: dev
dev: ## run the cli in dev mode (forwards ARGS, e.g. `make dev ARGS="issue list"`)
	$(PNPM) run dev -- $(ARGS)

.PHONY: run
run: build ## build and run the compiled cli (`make run ARGS="dash"`)
	$(NODE) dist/cli.js $(ARGS)

# ----- quality & security -----

.PHONY: audit
audit: ## fail on high+ severity vulnerabilities in production deps
	$(PNPM) run audit

.PHONY: deadcode
deadcode: ## report unused files and dependencies (knip)
	$(PNPM) run deadcode

.PHONY: quality
quality: ## deeper scan: lint + unused exports/files/deps (knip strict), non-blocking extras
	$(PNPM) run quality

# ----- ci aggregates -----

.PHONY: ci
ci: ## full ci: format, lint, typecheck, test-cov, deadcode, audit, build
	$(PNPM) run ci

.PHONY: check
check: fmt-check lint typecheck test ## quick local check before commit

# ----- local install (dogfooding) -----

.PHONY: install-local
install-local: build ## build and install `plc` globally from this checkout
	$(PNPM) add -g .

.PHONY: uninstall-local
uninstall-local: ## remove the global install of this checkout
	$(PNPM) rm -g plc-cli

# ----- maintenance -----

.PHONY: clean
clean: ## remove build and coverage artifacts
	rm -rf dist coverage

.PHONY: distclean
distclean: clean ## remove node_modules too
	rm -rf node_modules

# ----- runtime helpers (forward to the binary) -----

.PHONY: up
up: dev ## alias to start the cli in dev mode

.PHONY: down
down: ## placeholder for stopping background services (no-op)
	@echo "nothing to stop"

# ----- help -----

.PHONY: help
help: ## list available targets
	@awk 'BEGIN {FS = ":.*##"; printf "Available targets:\n"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
