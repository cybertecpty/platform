import { NormalizedNxProjectOptions, NxProjectOptions } from '@cybertecpty/nx-types';
import type { pluginGenerator } from '@nx/plugin/generators';
import { Except, SetRequired } from 'type-fest';

/** Options accepted by `@nx/plugin`'s `pluginGenerator`, in its installed version. */
type NxPluginGeneratorSchema = Parameters<typeof pluginGenerator>[1];

/**
 * Inputs to the workspace `nx-plugin` generator — a thin wrapper over
 * `@nx/plugin:plugin`.
 *
 * `scope` (`tools`) and `type` (`plugin`) are fixed by the generator, and
 * `domain` / `buildable` don't apply to a `tools/` project (ADR 0009), so all
 * four are dropped from `NxProjectOptions`. `directory` is derived from
 * `group` per the `tools/<group>/<type>` convention rather than supplied;
 * `rootProject` / `addPlugin` are internal Nx flags a tools plugin never sets;
 * and `setParserOptionsProject` is a deprecated alias for `enableTypedLinting`.
 * All four are dropped from the passthrough schema. `unitTestRunner` and
 * `linter` are re-narrowed to their `schema.json` enums — `unitTestRunner`
 * loses `vitest` (the workspace is Jest-only, ADR 0007; generating with Vitest
 * requires reopening that ADR), `linter` loses the deprecated `Linter` enum
 * members. Everything else is forwarded to `@nx/plugin:plugin` unchanged.
 */
export type NxPluginGeneratorOptions = SetRequired<
  Except<NxProjectOptions, 'scope' | 'type' | 'domain' | 'buildable'>,
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
    /** Test runner for unit tests. Jest-only per ADR 0007. */
    unitTestRunner?: 'jest' | 'none';
  };

/**
 * `NxPluginGeneratorOptions` after the generator has resolved `name`,
 * `directory`, and `tags` and pinned `scope` / `type`.
 *
 * `bundler` (and `domain`) are omitted from the shared `NormalizedNxProjectOptions`
 * shape: a plugin has no bundler — its build target is driven by `compiler` —
 * and a `tools/` project carries no `domain`.
 */
export type NormalizedNxPluginGeneratorOptions = NxPluginGeneratorOptions &
  Except<NormalizedNxProjectOptions<'tools', 'plugin'>, 'bundler' | 'domain'>;
