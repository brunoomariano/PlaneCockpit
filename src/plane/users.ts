import type { IssueUser } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { NotFoundError } from "../utils/errors.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

interface RawMember {
  member: { id: string; display_name: string; email?: string };
}

export class UsersService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(): Promise<IssueUser[]> {
    const key = cacheKeys.users(this.api.workspace);
    const cached = await this.cache.get<IssueUser[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<RawMember> | RawMember[]>(
      this.api.workspacePath("members"),
    );
    const list = Array.isArray(res) ? res : res.results;
    const users = list.map((m) => m.member);
    await this.cache.set(key, users);
    return users;
  }

  async me(): Promise<IssueUser> {
    const res = await this.api.request<IssueUser>("/users/me");
    return res;
  }

  async resolveAssignee(spec: string): Promise<IssueUser> {
    if (spec === "me") return this.me();
    const users = await this.list();
    const match = users.find((u) => u.display_name === spec || u.email === spec || u.id === spec);
    if (!match) throw new NotFoundError(`user not found: ${spec}`);
    return match;
  }
}
