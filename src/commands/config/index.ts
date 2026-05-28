import { Command } from "commander";
import YAML from "yaml";
import { loadConfig } from "../../config/load-config.js";
import { listProfiles, withActiveProfile } from "../../config/profiles.js";
import { writeFile } from "node:fs/promises";
import { ConfigError } from "../../utils/errors.js";
import { mergeGlobalFlags } from "../shared.js";

export function registerConfig(program: Command): void {
  const config = program.command("config").description("inspect configuration");

  config
    .command("show")
    .description("print the parsed configuration (secrets masked)")
    .action(async function (this: Command) {
      const flags = mergeGlobalFlags(this);
      const { config: cfg, sourcePath } = await loadConfig({ path: flags.config });
      const masked = JSON.parse(JSON.stringify(cfg));
      for (const profile of Object.values(masked.profiles)) {
        const p = profile as { auth?: { api_key?: string } };
        if (p.auth?.api_key) p.auth.api_key = "***";
      }
      process.stdout.write(`# source: ${sourcePath}\n${YAML.stringify(masked)}`);
    });

  config
    .command("validate")
    .description("validate the configuration file")
    .action(async function (this: Command) {
      const flags = mergeGlobalFlags(this);
      await loadConfig({ path: flags.config });
      process.stdout.write("config is valid\n");
    });

  const profile = program.command("profile").description("manage profiles");

  profile
    .command("list")
    .description("list profiles in the configuration")
    .action(async function (this: Command) {
      const flags = mergeGlobalFlags(this);
      const { config: cfg } = await loadConfig({ path: flags.config });
      for (const name of listProfiles(cfg)) {
        const marker = name === cfg.active_profile ? "*" : " ";
        process.stdout.write(`${marker} ${name}\n`);
      }
    });

  profile
    .command("use <name>")
    .description("set the active profile (writes the config file)")
    .action(async function (this: Command, name: string) {
      const flags = mergeGlobalFlags(this);
      const { config: cfg, sourcePath } = await loadConfig({ path: flags.config });
      const updated = withActiveProfile(cfg, name);
      try {
        await writeFile(sourcePath, YAML.stringify(updated), "utf8");
      } catch (err) {
        throw new ConfigError(`failed to write config: ${(err as Error).message}`);
      }
      process.stdout.write(`active profile set to ${name}\n`);
    });
}
