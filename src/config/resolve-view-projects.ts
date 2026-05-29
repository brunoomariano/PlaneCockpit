import type { ViewDefinition } from "../types/views.js";
import { ConfigError } from "../utils/errors.js";

/**
 * Resolves the list of project identifiers a view queries.
 *
 * - View without `projects`: inherits the profile universe (`defaultProjects`).
 * - View with `projects`: uses that subset, which must be entirely contained in
 *   the profile universe. Items outside the universe are a config error.
 */
export function resolveViewProjects(
  view: Pick<ViewDefinition, "name" | "projects">,
  defaultProjects: string[] | undefined,
): string[] {
  const universe = defaultProjects ?? [];

  if (view.projects === undefined) {
    return [...universe];
  }

  const outside = view.projects.filter((p) => !universe.includes(p));
  if (outside.length > 0) {
    throw new ConfigError(
      `view "${view.name}" references projects outside defaults.projects: ${outside.join(", ")}`,
      { view: view.name, outside, universe },
    );
  }

  return [...view.projects];
}

/**
 * Result of the lenient resolution: the valid projects actually used, and the
 * declared projects that fell outside the profile universe.
 */
export interface ResolvedViewProjects {
  // Valid projects the view actually queries. May be empty when every declared
  // project is outside the universe.
  projects: string[];
  // Projects declared by the view that do not exist in defaults.projects.
  invalid: string[];
  // True when the view declares its own subset (restricts the globals).
  restricted: boolean;
}

/**
 * Lenient variant of {@link resolveViewProjects} for the TUI: instead of
 * throwing when the view references projects outside the universe, it ignores
 * the invalid ones, uses the valid ones, and returns the invalid ones so the UI
 * can flag the config error (without crashing the dashboard).
 */
export function resolveViewProjectsLenient(
  view: Pick<ViewDefinition, "name" | "projects">,
  defaultProjects: string[] | undefined,
): ResolvedViewProjects {
  const universe = defaultProjects ?? [];

  if (view.projects === undefined) {
    return { projects: [...universe], invalid: [], restricted: false };
  }

  const projects = view.projects.filter((p) => universe.includes(p));
  const invalid = view.projects.filter((p) => !universe.includes(p));
  return { projects, invalid, restricted: true };
}

/**
 * View metadata for the TUI navbar: whether it restricts projects ('#') and
 * whether its config has errors ('*').
 */
export interface ViewEntryMeta {
  name: string;
  restricted: boolean;
  hasErrors: boolean;
}

/**
 * Derives each view's marker metadata from the lenient resolution. Kept as a
 * pure function (no JSX) so it can be tested without rendering the TUI.
 */
export function buildViewEntries(
  views: Pick<ViewDefinition, "name" | "projects">[],
  defaultProjects: string[] | undefined,
): ViewEntryMeta[] {
  return views.map((view) => {
    const resolved = resolveViewProjectsLenient(view, defaultProjects);
    return {
      name: view.name,
      restricted: resolved.restricted,
      hasErrors: resolved.invalid.length > 0,
    };
  });
}

/**
 * Project the CLI uses when no `--project` is passed: the first of
 * `defaults.projects`. Returns undefined when no projects are configured.
 */
export function firstDefaultProject(defaultProjects: string[] | undefined): string | undefined {
  return defaultProjects?.[0];
}
