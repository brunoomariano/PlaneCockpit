// FileLogger appends JSON Lines to a file. It is used by the TUI, which owns the
// terminal and cannot afford pino writing to stderr. Rotation is size-based: when
// the file grows past `maxBytes`, it is moved to `.1` and a fresh file is started.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface FileLoggerOptions {
  path: string;
  level?: LogLevel;
  maxBytes?: number;
  now?: () => Date;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

const SECRET_KEYS = new Set([
  "api_key",
  "apikey",
  "token",
  "authorization",
  "x-api-key",
  "password",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.has(k.toLowerCase()) ? "***" : redact(v);
    }
    return out;
  }
  return value;
}

export class FileLogger {
  private readonly path: string;
  private readonly level: LogLevel;
  private readonly maxBytes: number;
  private readonly now: () => Date;

  constructor(opts: FileLoggerOptions) {
    this.path = opts.path;
    this.level = opts.level ?? "info";
    this.maxBytes = opts.maxBytes ?? 1_000_000;
    this.now = opts.now ?? (() => new Date());
    mkdirSync(dirname(this.path), { recursive: true });
    if (!existsSync(this.path)) writeFileSync(this.path, "", { mode: 0o600 });
  }

  get filePath(): string {
    return this.path;
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.write("debug", msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.write("info", msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.write("warn", msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.write("error", msg, fields);
  }

  private write(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    this.rotateIfNeeded();
    const entry: LogEntry = {
      ts: this.now().toISOString(),
      level,
      msg,
      ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
    };
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }

  private rotateIfNeeded(): void {
    try {
      const size = statSync(this.path).size;
      if (size < this.maxBytes) return;
      renameSync(this.path, `${this.path}.1`);
      writeFileSync(this.path, "", { mode: 0o600 });
    } catch {
      // path may not exist yet; constructor already creates it, but be defensive.
    }
  }
}
