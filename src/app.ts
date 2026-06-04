import { loadConfig } from "./config/load-config.js";
import { selectProfile } from "./config/profiles.js";
import { resolveApiKey } from "./config/env.js";
import { CredentialsStore } from "./config/credentials.js";
import { AuthError } from "./utils/errors.js";
import { FileLogger } from "./utils/file-logger.js";
import { resolveLogPath } from "./utils/log-paths.js";
import { createCacheStore } from "./cache/factory.js";
import { PlaneApiClient } from "./plane/client.js";
import { ProjectsService } from "./plane/projects.js";
import { WorkItemsService } from "./plane/work-items.js";
import { IssuesService } from "./plane/issues.js";
import { UsersService } from "./plane/users.js";
import { StatesService } from "./plane/states.js";
import { loadKeybindings, type ResolvedBinding } from "./keybindings/load.js";
import { resolveTheme } from "./tui/theme/resolve.js";
import type { Theme } from "./tui/theme/tokens.js";
import type { CacheStore } from "./cache/types.js";
import type { ProfileConfig, RuntimeConfig } from "./types/config.js";

export interface GlobalFlags {
  profile?: string;
  config?: string;
  noCache?: boolean;
  debug?: boolean;
}

export interface AppContext {
  runtime: RuntimeConfig;
  fileLogger: FileLogger;
  cache: CacheStore;
  api: PlaneApiClient;
  projects: ProjectsService;
  workItems: WorkItemsService;
  issues: IssuesService;
  users: UsersService;
  states: StatesService;
  keybindings: ResolvedBinding[];
  keybindingsSourcePath?: string;
  // Resolved color theme (preset + overrides), shared by the TUI and the CLI
  // table so both render priority and accents consistently.
  theme: Theme;
  close(): Promise<void>;
}

export async function buildContext(flags: GlobalFlags): Promise<AppContext> {
  const { config } = await loadConfig({ path: flags.config });
  const { name, profile } = selectProfile(config, flags.profile);
  const credentials = new CredentialsStore();
  const apiKey = await resolveApiKey({ profileName: name, profile, credentials });
  if (!apiKey) {
    throw new AuthError(`api key not found for profile ${name} (try \`plc auth login\`)`);
  }
  const fileLogger = new FileLogger({
    path: resolveLogPath(),
    level: flags.debug ? "debug" : "info",
  });
  const cache = await createCacheStore({
    config: profile.cache,
    disabled: flags.noCache,
  });
  const api = new PlaneApiClient({
    server: profile.server,
    apiKey,
    onTrace: (event) => {
      const level = event.error || (event.status && event.status >= 400) ? "warn" : "debug";
      fileLogger[level]("plane api", { ...event });
    },
  });
  const projects = new ProjectsService(api, cache);
  const workItems = new WorkItemsService(api, cache);
  const users = new UsersService(api, cache);
  const states = new StatesService(api, cache);
  const issues = new IssuesService(projects, workItems, users);
  const { bindings: keybindings, sourcePath: keybindingsSourcePath } = await loadKeybindings();
  const runtime: RuntimeConfig = {
    profile_name: name,
    profile,
    no_cache: flags.noCache ?? false,
    debug: flags.debug ?? false,
  };
  return {
    runtime,
    fileLogger,
    cache,
    api,
    projects,
    workItems,
    issues,
    users,
    states,
    keybindings,
    keybindingsSourcePath,
    theme: resolveTheme(profile.theme),
    async close() {
      if (cache.close) await cache.close();
    },
  };
}

export function findView(profile: ProfileConfig, name: string) {
  return profile.views?.find((v) => v.name === name);
}
