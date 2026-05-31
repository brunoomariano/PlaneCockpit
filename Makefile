.DEFAULT_GOAL := help

PNPM ?= pnpm
NODE ?= node

CONFIG_DIR ?= $(HOME)/.config/plane-cli
CONFIG_FILE ?= $(CONFIG_DIR)/config.yaml

# ----- setup -----

.PHONY: bootstrap
bootstrap: ## install dev toolchain (mise) and project dependencies
	mise install
	$(PNPM) install

# ----- code quality -----

.PHONY: fmt
fmt: ## format the codebase (CHECK=1 to verify without writing)
ifeq ($(CHECK),1)
	$(PNPM) run fmt:check
else
	$(PNPM) run fmt
endif

.PHONY: check
check: ## quality gates (KIND=lint|typecheck|audit|deadcode|quality|schema; default runs lint+typecheck+test)
ifeq ($(KIND),lint)
	$(PNPM) run lint
else ifeq ($(KIND),typecheck)
	$(PNPM) run typecheck
else ifeq ($(KIND),audit)
	$(PNPM) run audit
else ifeq ($(KIND),deadcode)
	$(PNPM) run deadcode
else ifeq ($(KIND),quality)
	$(PNPM) run quality
else ifeq ($(KIND),schema)
	$(PNPM) run schema:check
else
	$(PNPM) run lint
	$(PNPM) run typecheck
	$(PNPM) run test
endif

# ----- tests -----

.PHONY: test
test: ## run unit tests (MODE=watch for watch mode, MODE=cov for coverage min 95%)
ifeq ($(MODE),watch)
	$(PNPM) run test:watch
else ifeq ($(MODE),cov)
	$(PNPM) run test:cov
else
	$(PNPM) run test
endif

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

# ----- ci -----

.PHONY: ci
ci: ## full ci: format, lint, typecheck, test-cov, deadcode, audit, build
	$(PNPM) run ci

# ----- local install (dogfooding) -----

.PHONY: install
install: build ## build, install `plc` globally, and seed config.yaml if absent
	$(PNPM) add -g .
	@if [ -f "$(CONFIG_FILE)" ]; then \
		echo "config exists, leaving it untouched: $(CONFIG_FILE)"; \
	else \
		mkdir -p "$(CONFIG_DIR)"; \
		cp examples/config.yaml "$(CONFIG_FILE)"; \
		echo "seeded example config: $(CONFIG_FILE)"; \
	fi

.PHONY: uninstall
uninstall: ## remove the global install of this checkout
	$(PNPM) rm -g plc-cli

# ----- maintenance -----

.PHONY: clean
clean: ## remove build and coverage artifacts (DIST=1 to also drop node_modules)
	rm -rf dist coverage
ifeq ($(DIST),1)
	rm -rf node_modules
endif

# ----- help -----

.PHONY: help
help: ## list available targets grouped by section
	@awk ' \
		/^# ----- .* -----$$/ { \
			section = $$0; \
			gsub(/^# ----- | -----$$/, "", section); \
			printf "\n\033[1m%s\033[0m\n", section; \
			next; \
		} \
		/^[a-zA-Z_-]+:.*##/ { \
			split($$0, parts, ":.*## *"); \
			printf "  \033[36m%-12s\033[0m %s\n", parts[1], parts[2]; \
		} \
	' $(MAKEFILE_LIST)
