import type { Command } from "commander";
import { buildContext, type AppContext, type GlobalFlags } from "../app.js";
import { isPlaneCliError } from "../utils/errors.js";
import { pickOutputFormat, type OutputFormat } from "../utils/formatting.js";

export interface CommonFlags extends GlobalFlags {
  json?: boolean;
  yaml?: boolean;
  limit?: string;
}

export interface CommandRuntime {
  ctx: AppContext;
  format: OutputFormat;
  limit?: number;
}

export function mergeGlobalFlags(cmd: Command): GlobalFlags {
  const root = cmd.parent?.parent ?? cmd.parent ?? cmd;
  const opts = root.optsWithGlobals?.() ?? root.opts();
  return {
    profile: opts.profile,
    config: opts.config,
    noCache: opts.noCache,
    debug: opts.debug,
  };
}

export async function withContext(
  cmd: Command,
  flags: CommonFlags,
  fn: (rt: CommandRuntime) => Promise<void>,
): Promise<void> {
  const merged = { ...mergeGlobalFlags(cmd), ...flags };
  const ctx = await buildContext(merged);
  const runtime: CommandRuntime = {
    ctx,
    format: pickOutputFormat({ json: flags.json, yaml: flags.yaml }),
    limit: flags.limit ? Number.parseInt(flags.limit, 10) : undefined,
  };
  try {
    await fn(runtime);
  } finally {
    await ctx.close();
  }
}

export function handleError(err: unknown, debug: boolean): never {
  if (isPlaneCliError(err)) {
    process.stderr.write(`error[${err.code}]: ${err.message}\n`);
    if (debug && err.details) process.stderr.write(`${JSON.stringify(err.details, null, 2)}\n`);
    process.exit(1);
  }
  const e = err as Error;
  process.stderr.write(`error: ${e.message}\n`);
  if (debug && e.stack) process.stderr.write(`${e.stack}\n`);
  process.exit(1);
}
