import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import YAML from "yaml";
import { ConfigError } from "../utils/errors.js";
import { planeConfigSchema } from "./schema.js";
import type { PlaneConfig } from "../types/config.js";
import { applyEnvOverrides } from "./env.js";
import { DEFAULT_CONFIG_PATHS } from "./defaults.js";

export function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

export interface LoadConfigOptions {
  path?: string;
  env?: NodeJS.ProcessEnv;
  searchPaths?: readonly string[];
}

export interface LoadedConfig {
  config: PlaneConfig;
  sourcePath: string;
}

export async function loadConfig(opts: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const env = opts.env ?? process.env;
  const candidates = opts.path ? [opts.path] : (opts.searchPaths ?? DEFAULT_CONFIG_PATHS);
  let lastErr: unknown;
  for (const candidate of candidates) {
    const full = expandHome(candidate);
    try {
      const raw = await readFile(full, "utf8");
      const parsed = parseConfig(raw);
      const overridden = applyEnvOverrides(parsed, env as Parameters<typeof applyEnvOverrides>[1]);
      return { config: overridden, sourcePath: full };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw new ConfigError("no config file found", {
    searched: candidates.map(expandHome),
    cause: lastErr,
  });
}

export function parseConfig(raw: string): PlaneConfig {
  let doc: unknown;
  try {
    doc = YAML.parse(raw);
  } catch (err) {
    throw new ConfigError(`invalid yaml: ${(err as Error).message}`);
  }
  const result = planeConfigSchema.safeParse(doc);
  if (!result.success) {
    throw new ConfigError("config validation failed", {
      issues: result.error.issues,
    });
  }
  return result.data;
}
