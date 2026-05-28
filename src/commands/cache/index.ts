import { Command } from "commander";
import { withContext } from "../shared.js";

export function registerCache(program: Command): void {
  const cache = program.command("cache").description("inspect and manage the local cache");

  cache
    .command("status")
    .description("show cache provider and approximate size")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const provider = ctx.runtime.profile.cache?.provider ?? "memory";
        const size = ctx.cache.size ? await ctx.cache.size() : undefined;
        process.stdout.write(
          `provider: ${provider}\nworkspace: ${ctx.runtime.profile.server.workspace_slug}\nentries: ${size ?? "n/a"}\n`,
        );
      });
    });

  cache
    .command("clear")
    .description("clear cache entries (optionally by prefix)")
    .option("--prefix <prefix>", "only clear keys starting with this prefix")
    .action(async function (this: Command, opts: { prefix?: string }) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx }) => {
        await ctx.cache.clear(opts.prefix);
        process.stdout.write(`cleared${opts.prefix ? ` prefix=${opts.prefix}` : ""}\n`);
      });
    });

  cache
    .command("warm")
    .description("warm common caches (projects, users)")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        await ctx.projects.list();
        await ctx.users.list();
        process.stdout.write("warmed: projects, users\n");
      });
    });
}
