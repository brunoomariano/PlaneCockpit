import { defineConfig } from "tsup";
import { createRequire } from "node:module";

// Single source of truth for the version: package.json, injected at build time
// so the shipped bundle can never disagree with the published package.
const { version } = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
  define: { __VERSION__: JSON.stringify(version) },
});
