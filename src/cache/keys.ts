// Cache keys are namespaced by workspace to avoid cross-profile leakage.

export function workspaceKey(workspace: string, ...parts: string[]): string {
  return ["plane", workspace, ...parts].join(":");
}

export const cacheKeys = {
  projects: (slug: string) => workspaceKey(slug, "projects"),
  project: (slug: string, identifier: string) => workspaceKey(slug, "project", identifier),
  users: (slug: string) => workspaceKey(slug, "users"),
  issuesPage: (slug: string, projectId: string, hash: string) =>
    workspaceKey(slug, "project", projectId, "issues", hash),
};
