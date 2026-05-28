import type { Logger } from "pino";
import { loadConfig } from "./config/load-config.js";
import { selectProfile } from "./config/profiles.js";
import { resolveApiKey } from "./config/env.js";
import { AuthError } from "./utils/errors.js";
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
  close(): Promise<void>;
}

export async function buildContext(flags: GlobalFlags): Promise<AppContext> {
  const { config } = await loadConfig({ path: flags.config });
  const { name, profile } = selectProfile(config, flags.profile);
  const apiKey = resolveApiKey(profile);
  if (!apiKey) {
    throw new AuthError(`api key not found (expected env: ${profile.auth.api_key_env})`);
  }
  const logger = createLogger({ debug: flags.debug, pretty: process.stdout.isTTY });
  const cache = await createCacheStore({
    config: profile.cache,
    disabled: flags.noCache,
  });
  const api = new PlaneApiClient({ server: profile.server, apiKey });
  const projects = new ProjectsService(api, cache);
  const workItems = new WorkItemsService(api, cache);
  const issues = new IssuesService(projects, workItems);
  const states = new StatesService(api, cache);
  const labels = new LabelsService(api, cache);
  const users = new UsersService(api, cache);
  const cycles = new CyclesService(api, cache);
  const modules = new ModulesService(api, cache);
  const comments = new CommentsService(api);
  const runtime: RuntimeConfig = {
    profile_name: name,
    profile,
    no_cache: flags.noCache ?? false,
    debug: flags.debug ?? false,
  };
  return {
    runtime,
    logger,
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
    async close() {
      if (cache.close) await cache.close();
    },
  };
}

export function findView(profile: ProfileConfig, name: string) {
  return profile.views?.find((v) => v.name === name);
}
