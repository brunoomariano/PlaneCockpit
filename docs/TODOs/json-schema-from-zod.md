# Publish a JSON Schema generated from the Zod config schema

## Motivation

The config is already schematised in `src/config/schema.ts` (Zod) and documented
in [`docs/CONFIGURATION.md`](../CONFIGURATION.md). `AGENTS.md` requires the two
stay in sync. What's missing is the third leg `gh-dash` ships: a **JSON Schema**
that editors consume for autocomplete and inline validation while the user edits
`config.yaml`. gh-dash maintains `pr.json` and a `schema.mdx` page for exactly
this (see issue #847 — they actively fix schema drift).

A generated schema means users get red squiggles for typos / wrong enums in their
YAML before ever running `plc`, and the schema can never drift from the Zod source
because it's derived from it.

## Design

Zod v4 (this repo uses `zod@^4`) has **native** JSON Schema export — no extra
dependency:

```ts
import { z } from "zod";
import { planeConfigSchema } from "../config/schema.js";

const jsonSchema = z.toJSONSchema(planeConfigSchema, {
  target: "draft-2020-12",
  // surface $id so editors can reference it
});
```

### Where it lives

- Generate `schema/config.schema.json` at build time (committed, so it's
  available without a build).
- A tiny script `scripts/gen-schema.ts` writes the file; wire it into `make build`
  and add a CI check that fails if the committed schema is stale (regenerate +
  `git diff --exit-code`), mirroring gh-dash's approach to schema drift.

### How users opt in

Document both editor hooks in `CONFIGURATION.md`:

- YAML inline directive at the top of `config.yaml`:
  ```yaml
  # yaml-language-server: $schema=https://<published-url>/config.schema.json
  ```
- VS Code `settings.json` (`yaml.schemas`) mapping for
  `~/.config/plane-cli/config.yaml`.

Publishing URL: either the repo raw URL on a tag, or the docs site if/when one
exists. Until then, the local path works for `yaml-language-server`.

## Implementation sketch

- `scripts/gen-schema.ts`: import `planeConfigSchema`, `z.toJSONSchema(...)`,
  write pretty JSON to `schema/config.schema.json`.
- `package.json` script `gen:schema`; call it from the build and from a new
  `make` gate (`check KIND=schema`).
- CI: regenerate and assert no diff (catches schema drift on every PR).
- Add a "Schema / editor autocomplete" section to `CONFIGURATION.md`.

## Acceptance checklist

- [ ] `scripts/gen-schema.ts` emits `schema/config.schema.json` from the Zod schema.
- [ ] Schema generation runs in `make build` and the file is committed.
- [ ] A CI gate fails when the committed schema is out of date.
- [ ] `CONFIGURATION.md` documents the `yaml-language-server` directive and the
      VS Code `yaml.schemas` mapping.
- [ ] Enums (priority, state_group, cache provider, …) and required fields appear
      correctly in the generated schema (spot-checked with a deliberately invalid
      config in an editor).

## References

- Zod v4 `z.toJSONSchema()` (built-in, draft-2020-12).
- gh-dash: `configuration/schema.mdx` + `pr.json`; issue #847 (invalid
  `properties: null` in the published schema) shows the maintenance cost a CI
  drift-check prevents.
