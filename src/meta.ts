// Product metadata, kept in one place so the CLI and TUI agree on the name,
// version, and author. The version comes from package.json: tsup injects
// __VERSION__ at build time (see tsup.config.ts), so the bundle can never
// disagree with the published package. Outside the bundle (dev via tsx, tests)
// __VERSION__ is undefined and we fall back to a dev sentinel.
declare const __VERSION__: string | undefined;

export const PRODUCT_NAME = "Plane Cockpit";
export const BINARY_NAME = "plc";
export const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0-dev";
export const AUTHOR_HANDLE = "@brunoomariano";
