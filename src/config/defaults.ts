export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_CACHE_TTL_SECONDS = 300;
// Per-project states and labels change rarely but must reappear in the pickers
// within minutes of being created in Plane. They use this short, explicit TTL
// rather than the profile-wide cache.ttl (which a user may set very high for the
// issues cache), so a long global TTL never strands a freshly-created one.
export const STATES_LABELS_TTL_SECONDS = 300;
// Single canonical config location. Kept as a list so loadConfig's search loop
// (and the --config override / test seam) stays uniform, but for now this is the
// only place the config is read from.
export const DEFAULT_CONFIG_PATHS = ["~/.config/plane-cli/config.yaml"] as const;
