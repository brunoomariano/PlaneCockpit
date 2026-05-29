# AGENTS.md

Guide for humans and LLM agents working in the **Plane Cockpit** repository.

## Functional source of truth

- The documentation under `docs/` is the functional source of truth for Plane Cockpit (distributed as the `plc` CLI/TUI binary) while the project is being built.
- Domain language, command surface, configuration shape, and architectural decisions must follow what is documented in `docs/`.
- The configuration surface (profiles, server, auth, defaults, cache, and views with their filters and sort) is documented in [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md), mirroring the Zod schema in `src/config/schema.ts`. Keep the two in sync when either changes.
- Transport details, payloads, and technical contracts that are not yet closed in the docs must not be invented as definitive. Record the decision or update the corresponding documentation first.
- When code and documentation diverge, treat it as an inconsistency to resolve; do not silently change behavior.

## Project structure

The project should be organized around the following top-level areas:

- `src/` — TypeScript source code for the Plane Cockpit CLI and TUI (`plc` binary).
- `infra/` — infrastructure, containers, automations, and operational support.
- `docs/` — functional documentation, glossary, decisions, and technical plans.

Inside `src/`, follow the layout suggested by the project prompt:

```text
src/
  cli.ts
  app.ts
  config/
  plane/
  cache/
  commands/
  tui/
  utils/
  types/
  tests/
```

Respect the boundaries of existing modules. When a boundary does not yet exist, prefer a simple and explicit separation between domain, application, and adapters.

## Stack and architecture

- The CLI and TUI must be built in TypeScript on Node.js.
- Use the official Node SDK `@makeplane/plane-node-sdk` for Plane API access.
- CLI framework: `commander` or `clipanion`. TUI: `ink`. YAML: `yaml`. Validation: `zod`. Build: `tsup`. Tests: `vitest`. Browser open: `open`. Logging: `pino`. Tables: `cli-table3`. Prompt/input: `inquirer`. Distribution: npm package with a `bin` field.
- The product must support both Plane Cloud and Plane self-hosted, including reverse proxy, trailing slash normalization, configurable timeout, custom TLS, custom headers, multiple environments, and custom URLs.
- Prefer an architecture with an isolated domain and adapters for input/output, such as HTTP, the Plane SDK, cache backends, filesystem, and browser.
- The Plane SDK must be isolated behind a thin adapter layer (e.g. `plane/work-items.ts`, `plane/issues.ts`, `plane/client.ts`). Commands must never depend directly on the SDK.
- The domain must not depend directly on the SDK, HTTP framework, cache driver, terminal renderer, or real clock.
- Cache must be optional and pluggable behind a `CacheStore` interface, with at least `MemoryCacheStore`, `SqliteCacheStore`, `RedisCacheStore`, and `NoopCacheStore`. The CLI must work fully without Redis.
- Configuration is YAML-first at `~/.config/plc/config.yaml` (and `~/.plc/config.yaml`), with environment variable overrides (`PLANE_BASE_URL`, `PLANE_WORKSPACE_SLUG`, `PLANE_API_KEY`, `PLANE_TIMEOUT_MS`, `PLANE_PROFILE`).
- Long-running flows, timers, cancellations, and concurrent flows must use `AbortController`/`AbortSignal` explicitly; do not rely on implicit cancellation.

## Code conventions

- Code must always follow SRP (one responsibility per unit), OCP (open for extension, closed for modification through interfaces), DIP (depend on abstractions, not on concrete implementations), KISS (the simplest solution that works), and DRY (do not duplicate logic; extract when the third occurrence shows up).
- **English is mandatory across the entire repository — no exceptions.** This covers code, identifiers (variables, functions, types, methods, modules), comments, docstrings/TSDoc, log and error messages, test names and descriptions, commit messages, documentation, and example config files. This rule overrides any default language convention of a tool, skill, or generator (e.g. a scaffolding skill that defaults to Portuguese): translate its output to English before committing.
- Code, names of variables, functions, types, methods, and modules must be in English.
- Comments, internal documentation, and team-facing messages must be in English.
- Business terms must preserve the meaning defined in the glossary. When the English identifier could be ambiguous, document the mapping in the domain itself.
- Use explicit types for domain concepts. Avoid `any` or unconstrained `unknown` when a specific type can better express the rule. Validate external input with `zod` at the boundary.
- Model states and transitions clearly; do not represent issue/work item states as loose strings spread across the code.
- Prefer small functions with a single responsibility and descriptive names. A function body should fit on one screen: prefer up to 20 lines. Above 30 lines is a sign of mixed responsibility and an extraction point.
- Constructors or factories with many independent validations should extract each validation group into private functions named after the invariant they protect.
- Domain types should declare only fields; construction, validation, and transition logic must live in separate functions.
- Files should group a single concept: a main type and its direct methods. When a file exceeds ~150 lines, evaluate whether there is a separable concept that deserves its own file.
- Avoid generic names like `data`, `manager`, `processor`, `handler`, or `service` when there is a more specific domain name.
- Prefer early returns over deeply nested blocks.
- Errors must carry enough context to diagnose the problem, especially operational identifiers (issue key, project, profile), the invalid value, and the expected format.
- Infrastructure errors (Plane SDK, cache backend, external command) should be wrapped with a small contextual message: `throw new Error(\`createIssue: save issue: \${cause.message}\`, { cause })`. Domain errors that already carry rich context do not need an extra prefix.
- Every exported type, function, class, and method should have a short TSDoc comment starting with the symbol name (`// IssueResolver resolves...`). Private functions do not need one unless the logic is non-obvious.
- Interfaces are declared in the package that consumes them, not in the one that implements them. Prefer small interfaces with 1 to 4 methods; an interface with many methods is almost always a concrete type in disguise.
- Prefer behavior-named transition functions over generic setters (`assignIssue`, not `setIssueAssignee`).
- Do not replicate business rules in adapters. Rules such as ID resolution, view filtering, and cache invalidation belong to the domain/application.

## Comments

- Preserve existing comments when they explain intent, an external restriction, or a business rule.
- Write comments to explain the why, invariants, and operational decisions; avoid narrating the obvious.
- TSDoc on exported identifiers should be used when it helps understand contract, responsibility, or rule.
- Use short comments above central types and functions when they reveal a domain role, architectural boundary, invariant, or operational pitfall; treat them as navigation hints, not name repetition.
- Reference an issue number or commit SHA when a line exists because of a specific bug or external constraint.

## Tests

- The default test framework is `vitest`.
- Prefer table-driven tests for domain rules.
- Domain tests must cover state transitions, filter normalization, ID resolution (`ENG-123 -> UUID`), URL builders, and pagination helpers.
- Tests should live close to the package under test, using `*.test.ts` files (or under `src/tests/` when integration scope is needed).
- Whenever possible, write a short comment above non-trivial tests describing the scenario tested and the expected behavior; this preserves intent across rewrites and avoids silent regressions.
- Simulate external I/O with named local fakes/stubs, especially for the Plane SDK, cache backends (sqlite/redis), filesystem, and clock.
- A bug fix must include a regression test when there is a testable surface.
- The `test-cov` target requires a minimum coverage of 95% when there is testable TypeScript code.

## Dependencies

- Use injection through constructor, parameter, or dependency object.
- Avoid global singletons for the Plane SDK client, cache backend, logger, configuration, or clock.
- Encapsulate third-party libraries in small adapters.
- Prefer predictable and idiomatic dependencies of the Node/TypeScript stack before introducing large frameworks.

## Logs and observability

- Use structured logs (`pino`) for debug and observability.
- Use plain text only in human-facing CLI output.
- Process logs must carry relevant operational context, such as profile, workspace, project, issue key, and command.
- Never log API keys, tokens, or other secrets. Mask secrets in logs and only emit stack traces under `--debug`.

## Makefile and mise interface

- The project uses `mise` to declare, install, and use development dependencies.
- The Makefile is the main control interface of the project.
- Before assuming a target, consult the existing Makefile.
- Targets should use direct names, without language-specific prefixes such as `ts_` or `node_`.
- Main targets: `bootstrap`, `up`, `down`, `fmt`, `lint`, `build`, `test`, `test-cov`, `cov`, `ci`.
- If an applicable check does not exist yet, state that in the delivery instead of inventing a command.

## Commits

- Specific guidelines live in `docs/CONTRIBUTING.md` (Commit Guidelines). Use that file as the reference when writing commits.
- Commits must follow Conventional Commits, in English, with an objective description of the delivered result.
- Do not include prompt, LLM session, tool co-authorship, or operational notes in the commit text.

## Git Tag

- Specific guidelines live in `docs/CONTRIBUTING.md` (Git Tag Guidelines). Use that file as the reference when creating tags.

## Pull Requests

- The PR template and rules live in `docs/CONTRIBUTING.md` (Pull Request Guidelines). Use that file when opening a PR.

## Delivery checklist

- Verify that the change respects the documented domain, configuration shape, and command surface in `docs/`.
- Run the tests and checks available for the changed scope.
- Update documentation when changing a business rule, contract, payload, configuration key, state, or architectural decision.
- Do not run `git push` or edit the remote without an explicit request.
