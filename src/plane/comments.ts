import type { PlaneApiClient, PaginatedResponse } from "./client.js";

export interface Comment {
  id: string;
  comment_html: string;
  created_at: string;
  actor: { id: string; display_name: string };
}

export class CommentsService {
  constructor(private readonly api: PlaneApiClient) {}

  async list(projectId: string, issueId: string): Promise<Comment[]> {
    const res = await this.api.request<PaginatedResponse<Comment> | Comment[]>(
      this.api.workspacePath("projects", projectId, "issues", issueId, "comments"),
    );
    return Array.isArray(res) ? res : res.results;
  }

  async create(projectId: string, issueId: string, html: string): Promise<void> {
    await this.api.request(
      this.api.workspacePath("projects", projectId, "issues", issueId, "comments"),
      { method: "POST", body: { comment_html: html } },
    );
  }
}
