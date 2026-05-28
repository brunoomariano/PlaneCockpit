import { z } from "zod";

const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);
const stateGroupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);
const sortEnum = z.enum(["priority", "updated_at", "created_at", "name"]);

const viewFiltersSchema = z.strictObject({
  assignee: z.union([z.string(), z.array(z.string())]).optional(),
  state_group: z.array(stateGroupEnum).optional(),
  labels: z.array(z.string()).optional(),
  priority: z.array(priorityEnum).optional(),
  cycle: z.string().optional(),
  module: z.string().optional(),
});

const viewSchema = z.strictObject({
  name: z.string().min(1),
  project: z.string().min(1),
  filters: viewFiltersSchema.optional(),
  sort: sortEnum.optional(),
  limit: z.number().int().positive().optional(),
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

const authSchema = z.strictObject({
  api_key_env: z.string().min(1),
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
  auth: authSchema,
  defaults: z
    .strictObject({
      project: z.string().optional(),
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

export type PlaneConfigSchema = z.infer<typeof planeConfigSchema>;
