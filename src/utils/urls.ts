import type { Issue } from "../types/issue.js";
import type { Cycle, Project } from "../types/project.js";
import type { ServerConfig } from "../types/config.js";
import { ConfigError } from "./errors.js";

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ConfigError("base_url is empty");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConfigError(`invalid base_url: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError(`base_url must be http(s): ${raw}`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

function workspaceRoot(server: ServerConfig): string {
  if (!server.workspace_slug) throw new ConfigError("workspace_slug is required");
  return `${normalizeBaseUrl(server.base_url)}/${server.workspace_slug}`;
}

export function buildProjectUrl(server: ServerConfig, project: Pick<Project, "id">): string {
  return `${workspaceRoot(server)}/projects/${project.id}/issues`;
}

export function buildIssueUrl(
  server: ServerConfig,
  issue: Pick<Issue, "id"> & { project_id?: string },
  projectId?: string,
): string {
  const pid = projectId ?? issue.project_id;
  if (!pid) throw new ConfigError("project id is required to build issue url");
  return `${workspaceRoot(server)}/projects/${pid}/issues/${issue.id}`;
}

export function buildCycleUrl(server: ServerConfig, cycle: Pick<Cycle, "id" | "project_id">): string {
  return `${workspaceRoot(server)}/projects/${cycle.project_id}/cycles/${cycle.id}`;
}
