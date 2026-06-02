// gen-schema generates the JSON Schema for the YAML config from the Zod schema
// (`src/config/schema.ts`), so editors can autocomplete and validate
// `config.yaml`. The output is committed at `schema/config.schema.json`; the CI
// gate (`--check`) regenerates it in memory and compares against the committed
// file, so the schema can never diverge from the Zod source of truth. Run with
// `pnpm run gen:schema` (write) or `pnpm run schema:check` (verify).
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { planeConfigSchema } from "../src/config/schema.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(repoRoot, "schema", "config.schema.json");

function renderSchema(): string {
  // `io: "input"` documents what users WRITE in YAML (the pre-transform shape).
  // The `sort` field normalises a legacy scalar / list of single-key maps into
  // the internal SortKey[]; the input view is the union users actually type,
  // which is what editor autocomplete should see.
  const jsonSchema = z.toJSONSchema(planeConfigSchema, { target: "draft-2020-12", io: "input" });
  const document = {
    $id: "https://github.com/dlvhdr/plane-cockpit/schema/config.schema.json",
    title: "Plane Cockpit config",
    description: "Configuration for the Plane Cockpit CLI/TUI (~/.config/plane-cli/config.yaml).",
    ...jsonSchema,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

const rendered = renderSchema();

// --check verifies the committed file matches the freshly rendered schema by
// comparing CONTENT, not git state — so it is correct whether the working tree
// is clean or carries other uncommitted changes. It never writes.
if (process.argv.includes("--check")) {
  const current = await readFile(outPath, "utf8").catch(() => null);
  if (current === rendered) {
    process.stdout.write(`schema up to date: ${outPath}\n`);
  } else {
    process.stderr.write(
      `schema drift: ${outPath} is out of date with src/config/schema.ts.\n` +
        `Run \`pnpm run gen:schema\` and commit the result.\n`,
    );
    process.exit(1);
  }
} else {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered, "utf8");
  process.stdout.write(`wrote ${outPath}\n`);
}
