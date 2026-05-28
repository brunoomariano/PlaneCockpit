import { homedir } from "node:os";
import { join } from "node:path";

// resolveLogPath follows XDG Base Directory: $XDG_STATE_HOME/plane-cli/log.jsonl,
// falling back to ~/.local/state/plane-cli/log.jsonl. Logs are *state*, not config,
// because they are regenerated on each run.
export function resolveLogPath(env: NodeJS.ProcessEnv = process.env): string {
  const xdgState = env.XDG_STATE_HOME;
  const base = xdgState && xdgState.length > 0 ? xdgState : join(homedir(), ".local", "state");
  return join(base, "plane-cli", "log.jsonl");
}
