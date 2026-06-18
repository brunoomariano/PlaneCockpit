// Cache keys are namespaced by workspace to avoid cross-profile leakage.

export function workspaceKey(workspace: string, ...parts: string[]): string {
  return ["plane", workspace, ...parts].join(":");
}

export const cacheKeys = {
  projects: (slug: string) => workspaceKey(slug, "projects"),
  project: (slug: string, identifier: string) => workspaceKey(slug, "project", identifier),
  users: (slug: string) => workspaceKey(slug, "users"),
  // States are project-scoped in Plane, so they are cached per project id.
  states: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "states"),
  // Labels are project-scoped too, cached per project id.
  labels: (slug: string, projectId: string) => workspaceKey(slug, "project", projectId, "labels"),
  issuesPage: (slug: string, projectId: string, hash: string) =>
    workspaceKey(slug, "project", projectId, "issues", hash),
  // The activity log is per work item, so it is cached per project + issue id.
  issueActivities: (slug: string, projectId: string, issueId: string) =>
    workspaceKey(slug, "project", projectId, "issue", issueId, "activities"),
  // Relations are per work item too, cached per project + issue id.
  issueRelations: (slug: string, projectId: string, issueId: string) =>
    workspaceKey(slug, "project", projectId, "issue", issueId, "relations"),
};
