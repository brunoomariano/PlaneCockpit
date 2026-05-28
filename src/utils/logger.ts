import pino, { type Logger } from "pino";

const SECRET_KEYS = new Set([
  "api_key",
  "apikey",
  "token",
  "authorization",
  "x-api-key",
  "password",
]);

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.has(k.toLowerCase()) ? "***" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

export interface LoggerOptions {
  debug?: boolean;
  pretty?: boolean;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level = opts.debug ? "debug" : (process.env.PLANE_LOG_LEVEL ?? "info");
  const transport = opts.pretty
    ? { target: "pino-pretty", options: { colorize: true, singleLine: true } }
    : undefined;

  return pino({
    level,
    transport,
    redact: {
      paths: [
        "api_key",
        "token",
        "auth.api_key",
        "headers.authorization",
        "headers.Authorization",
        "headers['x-api-key']",
      ],
      censor: "***",
    },
    formatters: {
      log: (obj) => redactSecrets(obj) as Record<string, unknown>,
    },
  });
}
