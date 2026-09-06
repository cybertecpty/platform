import { SetRequired } from 'type-fest';
import { NxProjectLibType } from './nx-libs.types';

/**
 * Bundlers accepted by the underlying `@nx/*:library` generators. `none` means
 * the library is not buildable.
 */
export type NxProjectBundler = 'esbuild' | 'none' | 'rollup' | 'swc' | 'tsc' | 'vite';

/**
 * The fully-resolved project options the generators consume: `name`,
 * `directory`, and `tags` are always present, and the ergonomic `buildable`
 * flag has been replaced by the concrete `bundler` the generator expects.
 */
export type NormalizedNxProjectOptions<
  S extends NxProjectScope = NxProjectScope,
  T extends NxProjectType = NxProjectType
> = Omit<SetRequired<NxProjectOptions<S, T>, 'name' | 'tags'>, 'buildable'> & {
  bundler: NxProjectBundler;
  directory: string;
};

/**
 * Common options for all Nx project generators.
 */
export interface NxProjectOptions<
  S extends NxProjectScope = NxProjectScope,
  T extends NxProjectType = NxProjectType
> {
  /**
   * Whether the library should be buildable. Normalized to a `bundler` value
   * before it reaches the underlying generator (`true` → `tsc`, omitted or
   * `false` → `none`). Defaults to non-buildable. The `testing` type is always
   * forced non-buildable regardless of this flag.
   */
  buildable?: boolean;
  /**
   * The product domain and optional subdomains this project belongs to.
   * Subdomains are separated by a forward slash (e.g. `atlas/identity`). Each
   * segment must be lowercase alphanumeric words joined by single hyphens
   * (e.g. `game-collector`) — no leading, trailing, or doubled slashes.
   * Omit for tools projects.
   */
  domain?: string;
  /**
   * An optional label distinguishing this project from siblings of the same
   * type within its domain. Added to the project name and directory between
   * the domain and the type (e.g. `<domain>/<group>/<type>`). Must be a
   * single segment — lowercase alphanumeric words joined by single hyphens,
   * no slashes.
   *
   * Cosmetic only — unlike a subdomain, it carries no tag and isn't enforced
   * by module boundaries. Omittable for domain-singleton types (`infra`,
   * `models`, `core`); expected from the first lib for types that are
   * typically many-per-domain (`feature`, `ui`, `data-access`, `api`,
   * `services`, `utils`, `testing`) to avoid a rename once a second one
   * shows up.
   *
   * No effect for `app` projects — apps live in a flat `apps/<name>`
   * directory (ADR 0010) with no group segment to occupy.
   */
  group?: string;
  /**
   * Overrides the derived project name outright, bypassing the
   * domain/group/type naming formula for naming purposes only.
   *
   * Does not change where the project lives — its directory is still
   * derived from `domain`/`group`/`type` exactly as it would be without
   * `name`. Use it to register a project under an arbitrary name (e.g.
   * preserving an existing project's name while relocating it into this
   * convention).
   *
   * Required for `app` projects — an app's name consists exclusively of
   * this value; `domain`/`group` are never used to derive it.
   */
  name?: string;
  /**
   * Additional freeform tags to append to the generated `scope:`/`type:`/
   * `domain:` tags, comma-separated as accepted by the underlying
   * `@nx/*:library` generator's `--tags` flag.
   */
  tags?: string;
  /**
   * The project's `scope:` tag (ADR 0004's three-axis tag system) — one of
   * `backend`, `frontend`, `shared`, or `tools`. Implied by `type` for most
   * values; must be set explicitly for the three scope-polymorphic types
   * (`utils`, `testing`, `types`), since the type alone doesn't determine it.
   */
  scope: S;
  /**
   * The project's `type:` tag (ADR 0004) and the final segment of its
   * directory path (ADR 0009): `libs/<domain>[/<subdomain>...]/[<group>/]<type>`
   * or `tools/[<group>/]<type>`.
   */
  type: T;
}

/**
 * Union of all valid Nx project scopes.
 */
export type NxProjectScope = 'backend' | 'frontend' | 'shared' | 'tools';

/**
 * Union of all valid Nx project types.
 */
export type NxProjectType = 'app' | NxProjectLibType;
