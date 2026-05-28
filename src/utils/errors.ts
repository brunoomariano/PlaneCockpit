export class PlaneCliError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PlaneCliError";
    this.code = code;
    this.details = details;
  }
}

export class ConfigError extends PlaneCliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFIG", message, details);
    this.name = "ConfigError";
  }
}

export class AuthError extends PlaneCliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("AUTH", message, details);
    this.name = "AuthError";
  }
}

export class ApiError extends PlaneCliError {
  readonly status?: number;

  constructor(message: string, status?: number, details?: Record<string, unknown>) {
    super("API", message, details);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NotFoundError extends PlaneCliError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("NOT_FOUND", message, details);
    this.name = "NotFoundError";
  }
}

export function isPlaneCliError(err: unknown): err is PlaneCliError {
  return err instanceof PlaneCliError;
}
