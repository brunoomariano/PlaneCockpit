import type { ProjectsService } from "../plane/projects.js";
import type { WorkItemsService } from "../plane/work-items.js";
import type { Project } from "../types/project.js";
import type { Issue } from "../types/issue.js";

export function stubProjects(projects: Project[]): ProjectsService {
  return {
    list: async () => projects,
    findByIdentifier: async (id: string) => {
      const p = projects.find((x) => x.identifier === id);
      if (!p) throw new Error(`not found: ${id}`);
      return p;
    },
  } as unknown as ProjectsService;
}

export function stubWorkItems(issues: Issue[]): WorkItemsService {
  return {
    list: async () => issues,
    retrieve: async (_p: Project, id: string) => {
      const i = issues.find((x) => x.id === id);
      if (!i) throw new Error(`not found: ${id}`);
      return i;
    },
    create: async () => issues[0] as Issue,
    update: async () => issues[0] as Issue,
    assign: async () => issues[0] as Issue,
    comment: async () => undefined,
  } as unknown as WorkItemsService;
}
