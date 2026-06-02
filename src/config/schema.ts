import { z } from "zod";

const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);
const stateGroupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);

// Multi-level sort. A view's `sort` is an ordered list of single-key maps
// `{ <field>: "asc" | "desc" }`; the first key is primary, each following one
// breaks ties of the ones above. `name` is intentionally not a sort field.
const sortKeyEnum = z.enum(["project", "priority", "state", "created_at", "updated_at", "assign"]);
const sortDirectionEnum = z.enum(["asc", "desc"]);

// Default direction per field when the legacy scalar form omits it. Mirrors the
// "natural direction" table in docs/TODOs/multi-level-sort.md.
const DEFAULT_DIRECTION: Record<z.infer<typeof sortKeyEnum>, z.infer<typeof sortDirectionEnum>> = {
  project: "asc",
  priority: "desc",
  state: "asc",
  created_at: "desc",
  updated_at: "desc",
  assign: "asc",
};

// One list item: a record with EXACTLY one key (a sort field) whose value is a
// direction. The refine rejects `{}` and multi-key maps like
// `{ priority: "desc", state: "asc" }`.
const sortItemSchema = z
  .partialRecord(sortKeyEnum, sortDirectionEnum)
  .refine((item) => Object.keys(item).length === 1, {
    message: "each sort item must have exactly one field",
  });

// Normalised internal shape consumed by the comparator/resolver.
type NormalizedSortItem = {
  field: z.infer<typeof sortKeyEnum>;
  direction: z.infer<typeof sortDirectionEnum>;
};

function normalizeSortItem(item: Record<string, string>): NormalizedSortItem {
  const [field, direction] = Object.entries(item)[0] as [
    NormalizedSortItem["field"],
    NormalizedSortItem["direction"],
  ];
  return { field, direction };
}

// `sort` accepts either the ordered list of single-key maps or the legacy scalar
// (`sort: priority`), normalising both to a SortKey[]. The legacy scalar uses the
// field's default direction. `name` is rejected in both forms.
const sortSpecSchema = z.union([
  z.array(sortItemSchema).transform((items) => items.map(normalizeSortItem)),
  sortKeyEnum.transform((field) => [{ field, direction: DEFAULT_DIRECTION[field] }]),
]);

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
    sort: sortSpecSchema.optional(),
    // Caps the API fetch per project AND the final aggregate result (after
    // merge + client-side refinement + sort). Refinement may leave fewer.
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
      // TUI auto-refresh interval in seconds, applied to every view. Omitted ⇒
      // DEFAULT_AUTO_REFRESH_SECONDS (15). 0 disables auto-refresh; manual
      // refresh still works.
      auto_refresh_seconds: z.number().int().nonnegative().optional(),
      // Profile-wide default sort, inherited by any view that does not declare
      // its own `sort`. Same shape as a view's sort.
      sort: sortSpecSchema.optional(),
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
