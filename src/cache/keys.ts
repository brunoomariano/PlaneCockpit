// Cache keys are namespaced by workspace to avoid cross-profile leakage.

export function workspaceKey(workspace: string, ...parts: string[]): string {
  return ["plane", workspace, ...parts].join(":");
}

export const cacheKeys = {
  workspace: (slug: string) => workspaceKey(slug, "workspace"),
  projects: (slug: string) => workspaceKey(slug, "projects"),
  project: (slug: string, identifier: string) => workspaceKey(slug, "project", identifier),
  states: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "states"),
  labels: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "labels"),
  cycles: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "cycles"),
  modules: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "modules"),
  users: (slug: string) => workspaceKey(slug, "users"),
  issueLookup: (slug: string, key: string) => workspaceKey(slug, "lookup", key),
  views: (slug: string) => workspaceKey(slug, "views"),
  issuesPage: (slug: string, projectId: string, hash: string) =>
    workspaceKey(slug, "project", projectId, "issues", hash),
};
