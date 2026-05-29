export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_CACHE_TTL_SECONDS = 300;
// Single canonical config location. Kept as a list so loadConfig's search loop
// (and the --config override / test seam) stays uniform, but for now this is the
// only place the config is read from.
export const DEFAULT_CONFIG_PATHS = ["~/.config/plane-cli/config.yaml"] as const;
