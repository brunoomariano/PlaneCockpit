import type { Logger } from "pino";
import { loadConfig } from "./config/load-config.js";
import { selectProfile } from "./config/profiles.js";
import { resolveApiKey } from "./config/env.js";
import { CredentialsStore } from "./config/credentials.js";
import { AuthError } from "./utils/errors.js";
import { FileLogger } from "./utils/file-logger.js";
import { resolveLogPath } from "./utils/log-paths.js";
import { createCacheStore } from "./cache/factory.js";
import { createLogger } from "./utils/logger.js";
import { PlaneApiClient } from "./plane/client.js";
import { ProjectsService } from "./plane/projects.js";
import { WorkItemsService } from "./plane/work-items.js";
import { IssuesService } from "./plane/issues.js";
import { StatesService } from "./plane/states.js";
import { LabelsService } from "./plane/labels.js";
import { UsersService } from "./plane/users.js";
import { CyclesService } from "./plane/cycles.js";
import { ModulesService } from "./plane/modules.js";
import { CommentsService } from "./plane/comments.js";
import { loadKeybindings, type ResolvedBinding } from "./keybindings/load.js";
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
  logger: Logger;
  fileLogger: FileLogger;
  cache: CacheStore;
  api: PlaneApiClient;
  projects: ProjectsService;
  workItems: WorkItemsService;
  issues: IssuesService;
  states: StatesService;
  labels: LabelsService;
  users: UsersService;
  cycles: CyclesService;
  modules: ModulesService;
  comments: CommentsService;
  keybindings: ResolvedBinding[];
  keybindingsSourcePath?: string;
  close(): Promise<void>;
}

export async function buildContext(flags: GlobalFlags): Promise<AppContext> {
  const { config } = await loadConfig({ path: flags.config });
  const { name, profile } = selectProfile(config, flags.profile);
  const credentials = new CredentialsStore();
  const apiKey = await resolveApiKey({ profileName: name, profile, credentials });
  if (!apiKey) {
    const hint = profile.auth?.api_key_env
      ? ` (try \`plane auth login\` or set $${profile.auth.api_key_env})`
      : " (try `plane auth login`)";
    throw new AuthError(`api key not found for profile ${name}${hint}`);
  }
  const logger = createLogger({ debug: flags.debug, pretty: process.stdout.isTTY });
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
  const issues = new IssuesService(projects, workItems);
  const states = new StatesService(api, cache);
  const labels = new LabelsService(api, cache);
  const users = new UsersService(api, cache);
  const cycles = new CyclesService(api, cache);
  const modules = new ModulesService(api, cache);
  const comments = new CommentsService(api);
  const { bindings: keybindings, sourcePath: keybindingsSourcePath } = await loadKeybindings();
  const runtime: RuntimeConfig = {
    profile_name: name,
    profile,
    no_cache: flags.noCache ?? false,
    debug: flags.debug ?? false,
  };
  return {
    runtime,
    logger,
    fileLogger,
    cache,
    api,
    projects,
    workItems,
    issues,
    states,
    labels,
    users,
    cycles,
    modules,
    comments,
    keybindings,
    keybindingsSourcePath,
    async close() {
      if (cache.close) await cache.close();
    },
  };
}

export function findView(profile: ProfileConfig, name: string) {
  return profile.views?.find((v) => v.name === name);
}
