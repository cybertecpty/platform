import type { NormalizedNxProjectOptions, NxProjectOptions } from '@cybertecpty/nx-types';
import type { pluginGenerator } from '@nx/plugin/generators';
import type { Except, SetRequired } from 'type-fest';

/**
 * `NxPluginGeneratorOptions` after the generator has resolved `name`,
 * `directory`, and `tags` and pinned `platform` / `type`.
 *
 * `domain` is omitted from the shared `NormalizedNxProjectOptions` shape: a `tools/`
 * project carries no `domain`.
 */
export type NormalizedNxPluginGeneratorOptions = NxPluginGeneratorOptions &
  Except<NormalizedNxProjectOptions<'tools', 'plugin'>, 'domain'>;

/**
 * Inputs to the workspace `nx-plugin` generator — a thin wrapper over
 * `@nx/plugin:plugin`.
 *
 * `platform` (`tools`) and `type` (`plugin`) are fixed by the generator, and
 * `domain` doesn't apply to a `tools/` project (ADR 0009), so all
 * three are dropped from `NxProjectOptions`. `directory` is derived from
 * `group` per the `tools/<group>/<type>` convention rather than supplied;
 * `rootProject` / `addPlugin` are internal Nx flags a tools plugin never sets;
 * and `setParserOptionsProject` is a deprecated alias for `enableTypedLinting`.
 * All four are dropped from the passthrough schema. `unitTestRunner` and
 * `linter` are re-narrowed to their `schema.json` enums — `unitTestRunner`
 * loses `jest` (the workspace is Vitest-only, ADR 0018), `linter` loses the deprecated `Linter` enum
 * members. Everything else is forwarded to `@nx/plugin:plugin` unchanged.
 */
export type NxPluginGeneratorOptions = SetRequired<
  Except<NxProjectOptions, 'platform' | 'type' | 'domain'>,
  'group'
> &
  Except<
    NxPluginGeneratorSchema,
    | 'directory'
    | 'rootProject'
    | 'addPlugin'
    | 'setParserOptionsProject'
    | 'unitTestRunner'
    | 'linter'
  > & {
    /** Tool for running lint checks. */
    linter?: 'eslint' | 'none';
    /** Test runner for unit tests. Vitest-only per ADR 0018. */
    unitTestRunner?: 'vitest' | 'none';
  };

/** Options accepted by `@nx/plugin`'s `pluginGenerator`, in its installed version. */
type NxPluginGeneratorSchema = Parameters<typeof pluginGenerator>[1];
