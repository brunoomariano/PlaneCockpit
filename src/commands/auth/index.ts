import { Command } from "commander";
import { password } from "@inquirer/prompts";
import { mergeGlobalFlags, withContext } from "../shared.js";
import { loadConfig } from "../../config/load-config.js";
import { selectProfile } from "../../config/profiles.js";
import { CredentialsStore, hostKey } from "../../config/credentials.js";
import { AuthError } from "../../utils/errors.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("manage authentication against Plane");

  auth
    .command("login")
    .description("store an API key for the active profile in ~/.config/plane-cli/hosts.yaml")
    .option("--with-token", "read the api key from stdin instead of prompting")
    .action(async function (this: Command, opts: { withToken?: boolean }) {
      const flags = mergeGlobalFlags(this);
      const { config } = await loadConfig({ path: flags.config });
      const { name, profile } = selectProfile(config, flags.profile);
      const token = opts.withToken ? await readAllStdin() : await promptForToken();
      if (!token) throw new AuthError("empty api key");
      const store = new CredentialsStore();
      const host = hostKey(profile.server.base_url, profile.server.workspace_slug);
      await store.set(host, name, { api_key: token });
      process.stdout.write(`saved api key for profile ${name} at ${store.filePath}\n`);
    });

  auth
    .command("logout")
    .description("remove the stored API key for the active profile")
    .action(async function (this: Command) {
      const flags = mergeGlobalFlags(this);
      const { config } = await loadConfig({ path: flags.config });
      const { name, profile } = selectProfile(config, flags.profile);
      const store = new CredentialsStore();
      const host = hostKey(profile.server.base_url, profile.server.workspace_slug);
      const removed = await store.delete(host, name);
      process.stdout.write(
        removed
          ? `removed api key for profile ${name}\n`
          : `no stored api key for profile ${name}\n`,
      );
    });

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
}

async function promptForToken(): Promise<string> {
  return password({ message: "Plane API key", mask: "*" });
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}
