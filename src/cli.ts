import { Command } from "commander";
import { registerAuth } from "./commands/auth/index.js";
import { registerProject } from "./commands/project/index.js";
import { registerIssue } from "./commands/issue/index.js";
import { registerCache } from "./commands/cache/index.js";
import { registerConfig } from "./commands/config/index.js";
import { registerDash } from "./commands/dash/index.js";
import { handleError } from "./commands/shared.js";

const program = new Command();

program
  .name("plane")
  .description("CLI and TUI for Plane (Cloud and self-hosted)")
  .version("0.1.0-beta.1")
  .enablePositionalOptions()
  .option("--profile <name>", "profile to use (overrides PLANE_PROFILE and active_profile)")
  .option("--config <path>", "path to a config file (overrides default search)")
  .option("--no-cache", "disable cache for this invocation")
  .option("--debug", "enable debug output");

registerAuth(program);
registerProject(program);
registerIssue(program);
registerCache(program);
registerConfig(program);
registerDash(program);

program.parseAsync(process.argv).catch((err) => {
  const debug = program.opts().debug === true;
  handleError(err, debug);
});
