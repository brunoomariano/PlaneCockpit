import { Command } from "commander";
import { withContext } from "../shared.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("manage authentication against Plane");

  auth
    .command("status")
    .description("show current auth status for the active profile")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const me = await ctx.users.me();
        process.stdout.write(
          `profile: ${ctx.runtime.profile_name}\nworkspace: ${ctx.runtime.profile.server.workspace_slug}\nuser: ${me.display_name}${me.email ? ` <${me.email}>` : ""}\n`,
        );
      });
    });

  auth
    .command("login")
    .description("print instructions to authenticate (api key based)")
    .action(function () {
      const env = "PLANE_API_KEY";
      process.stdout.write(
        `plane uses api key authentication.\nset the env var declared in your profile (default: ${env}) and re-run.\nexample:\n  export ${env}=plane_xxx\n`,
      );
    });

  auth
    .command("logout")
    .description("clear cached credentials (no-op when using env vars)")
    .action(function () {
      process.stdout.write("nothing to clear: api key lives in your environment.\n");
    });
}
