import type { IssueUser } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { NotFoundError } from "../utils/errors.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

// Plane releases disagree on the members payload: some wrap each row as
// `{ member: {...} }`, others return the user fields flattened on the row, and
// some include null/partial rows (a pending invite with no user yet). RawMember
// covers both shapes; normalizeMember reconciles them and drops unusable rows.
interface RawUser {
  id?: string;
  display_name?: string;
  email?: string;
}
type RawMember = ({ member?: RawUser | null } & RawUser) | null | undefined;

// normalizeMember pulls the user out of either shape and returns undefined for a
// row that carries no id (so the caller can filter it out). It reads the nested
// `member` first, falling back to the fields on the row itself.
function normalizeMember(raw: RawMember): IssueUser | undefined {
  if (!raw) return undefined;
  const user = raw.member ?? raw;
  if (!user.id) return undefined;
  return { id: user.id, display_name: user.display_name ?? user.id, email: user.email };
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
    const users = list.map(normalizeMember).filter((u): u is IssueUser => u !== undefined);
    // Do not cache an empty result: an unexpected payload shape (or a transient
    // empty response) would otherwise serve an empty assignee picker for the
    // whole TTL. Caching only non-empty lists lets the next open retry instead.
    if (users.length > 0) await this.cache.set(key, users);
    return users;
  }

  async me(): Promise<IssueUser> {
    const res = await this.api.request<RawMember>("/users/me");
    // /users/me has the same shape variance as the members list, so it goes
    // through the same normalizer. A payload without a usable id fails loudly
    // with workspace context — returning an id-less user here would let an
    // assignment PATCH nothing while reporting success.
    const me = normalizeMember(res);
    if (!me) {
      throw new NotFoundError(
        `current user could not be resolved from /users/me (workspace ${this.api.workspace})`,
      );
    }
    return me;
  }

  async resolveAssignee(spec: string): Promise<IssueUser> {
    if (spec === "me") return this.me();
    const users = await this.list();
    const match = users.find((u) => u.display_name === spec || u.email === spec || u.id === spec);
    if (!match) throw new NotFoundError(`user not found: ${spec}`);
    return match;
  }
}
