// gen-schema generates the JSON Schema for the YAML config from the Zod schema
// (`src/config/schema.ts`), so editors can autocomplete and validate
// `config.yaml`. The output is committed at `schema/config.schema.json`; a CI
// gate regenerates it and fails on drift, so the schema can never diverge from
// the Zod source of truth. Run with `pnpm run gen:schema`.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { planeConfigSchema } from "../src/config/schema.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(repoRoot, "schema", "config.schema.json");

const jsonSchema = z.toJSONSchema(planeConfigSchema, { target: "draft-2020-12" });
const document = {
  $id: "https://github.com/dlvhdr/plane-cockpit/schema/config.schema.json",
  title: "Plane Cockpit config",
  description: "Configuration for the Plane Cockpit CLI/TUI (~/.config/plane-cli/config.yaml).",
  ...jsonSchema,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
process.stdout.write(`wrote ${outPath}\n`);
