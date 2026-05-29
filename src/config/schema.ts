import { z } from "zod";

const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);
const stateGroupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);
const sortEnum = z.enum(["priority", "updated_at", "created_at", "name"]);

const projectStateSearchSchema = z.strictObject({
  name: z.string().min(1),
  state_search: z.array(z.string().min(1)),
});

const viewFiltersSchema = z.strictObject({
  assignee: z.union([z.string(), z.array(z.string())]).optional(),
  state_group: z.array(stateGroupEnum).optional(),
  labels: z.array(z.string()).optional(),
  priority: z.array(priorityEnum).optional(),
  cycle: z.string().optional(),
  module: z.string().optional(),
  // Client-side state-name refinement; combine by union. Allowed on
  // multi-project views (unlike cycle/module) because matching is by name.
  state_search: z.array(z.string().min(1)).optional(),
  project_state_search: z.array(projectStateSearchSchema).optional(),
});

const viewSchema = z
  .strictObject({
    name: z.string().min(1),
    // Always a list of strings. Optional: when absent, the view inherits the
    // profile universe (defaults.projects).
    projects: z.array(z.string().min(1)).optional(),
    filters: viewFiltersSchema.optional(),
    sort: sortEnum.optional(),
    // Caps the API fetch per project, not the client-side state_search refinement.
    query_limit: z.number().int().positive().optional(),
  })
  // cycle and module identify a specific project, so they make no sense when the
  // view resolves to more than one project.
  .superRefine((view, ctx) => {
    if ((view.projects?.length ?? 0) <= 1) return;
    if (view.filters?.cycle !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["filters", "cycle"],
        message: "cycle cannot be used in a view with multiple projects (it is per-project)",
      });
    }
    if (view.filters?.module !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["filters", "module"],
        message: "module cannot be used in a view with multiple projects (it is per-project)",
      });
    }
  });

const serverSchema = z.strictObject({
  base_url: z.url(),
  workspace_slug: z.string().min(1),
  timeout_ms: z.number().int().positive().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tls: z
    .strictObject({
      reject_unauthorized: z.boolean().optional(),
    })
    .optional(),
});

// auth is optional: the recommended path is `plc auth login`, which writes the
// key to a separate hosts.yaml. api_key can be set inline for cases where a
// committed-but-private config file holds the key directly.
const authSchema = z.strictObject({
  api_key: z.string().min(1).optional(),
});

const cacheSchema = z.strictObject({
  provider: z.enum(["memory", "sqlite", "redis", "noop"]),
  ttl: z.number().int().nonnegative().optional(),
  sqlite_path: z.string().optional(),
  redis: z
    .strictObject({
      url: z.string().min(1),
      key_prefix: z.string().optional(),
    })
    .optional(),
});

export const profileSchema = z.strictObject({
  server: serverSchema,
  auth: authSchema.optional(),
  defaults: z
    .strictObject({
      // The profile's project universe, always a list of strings.
      projects: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  cache: cacheSchema.optional(),
  views: z.array(viewSchema).optional(),
});

export const planeConfigSchema = z
  .strictObject({
    active_profile: z.string().min(1),
    profiles: z.record(z.string(), profileSchema),
  })
  .refine((cfg) => cfg.profiles[cfg.active_profile] !== undefined, {
    message: "active_profile must reference an existing profile",
    path: ["active_profile"],
  });
