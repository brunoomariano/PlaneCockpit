// Credentials live in a separate file from the main config so users can safely commit
// config.yaml. Modeled after gh's hosts.yml: keyed by host (workspace+base_url) and account
// (profile name). Stored at 0600 so other users on the box cannot read it.

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";

export interface HostEntry {
  api_key: string;
  user?: string;
}

export interface HostsFile {
  hosts: Record<string, Record<string, HostEntry>>;
}

const hostEntrySchema = z.strictObject({
  api_key: z.string().min(1),
  user: z.string().optional(),
});

const hostsFileSchema = z.strictObject({
  hosts: z.record(z.string(), z.record(z.string(), hostEntrySchema)),
});

export const DEFAULT_CREDENTIALS_PATH = "~/.config/plane-cli/hosts.yaml";

export function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

// hostKey identifies a Plane deployment. Two profiles pointing at the same base_url and
// workspace share the same credential entry — that matches how a user thinks about it.
export function hostKey(baseUrl: string, workspaceSlug: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return `${normalized}#${workspaceSlug}`;
}

export interface CredentialsStoreOptions {
  path?: string;
}

export class CredentialsStore {
  private readonly path: string;
  private cache?: HostsFile;

  constructor(opts: CredentialsStoreOptions = {}) {
    this.path = expandHome(opts.path ?? DEFAULT_CREDENTIALS_PATH);
  }

  get filePath(): string {
    return this.path;
  }

  async load(): Promise<HostsFile> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = YAML.parse(raw);
      const result = hostsFileSchema.safeParse(parsed);
      if (!result.success) {
        throw new ConfigError("invalid hosts file", { issues: result.error.issues });
      }
      this.cache = result.data;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.cache = { hosts: {} };
      } else {
        throw err;
      }
    }
    return this.cache;
  }

  async get(host: string, account: string): Promise<HostEntry | undefined> {
    const data = await this.load();
    return data.hosts[host]?.[account];
  }

  async set(host: string, account: string, entry: HostEntry): Promise<void> {
    const data = await this.load();
    const accounts = data.hosts[host] ?? {};
    accounts[account] = entry;
    data.hosts[host] = accounts;
    await this.persist();
  }

  async delete(host: string, account: string): Promise<boolean> {
    const data = await this.load();
    const accounts = data.hosts[host];
    if (!accounts || !accounts[account]) return false;
    delete accounts[account];
    if (Object.keys(accounts).length === 0) delete data.hosts[host];
    await this.persist();
    return true;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.path), { recursive: true });
    const yaml = YAML.stringify(this.cache);
    await writeFile(this.path, yaml, { encoding: "utf8", mode: 0o600 });
    // writeFile honors mode only on file creation; force 0600 on overwrite too.
    await chmod(this.path, 0o600);
  }
}
