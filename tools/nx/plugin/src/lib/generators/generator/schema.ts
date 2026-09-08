import type { generatorGenerator } from '@nx/plugin/generators';
import { Except } from 'type-fest';

/** Options accepted by `@nx/plugin`'s `generatorGenerator`, in its installed version. */
type NxPluginGeneratorGeneratorSchema = Parameters<typeof generatorGenerator>[1];

/**
 * Inputs to the workspace `nx-gen` generator — a thin wrapper over
 * `@nx/plugin:generator`.
 *
 * The raw `path` is replaced by `project` + `directory`: the wrapper resolves
 * the target plugin's root and always writes to
 * `src/lib/generators/<directory>/generator.ts`, so a caller can't point the
 * generator at an arbitrary location. `name` stays (the collection key) but is
 * additionally constrained to a single kebab path segment. `unitTestRunner` is
 * re-narrowed to its `schema.json` enum — it loses `vitest`, since the
 * workspace is Jest-only (ADR 0007). Everything else (`description`,
 * `skipLintChecks`, `skipFormat`) is forwarded to `@nx/plugin:generator`
 * unchanged.
 */
export type NxGenGeneratorOptions = Except<
  NxPluginGeneratorGeneratorSchema,
  'path' | 'name' | 'unitTestRunner'
> & {
  /**
   * The generator name: its key in the target plugin's generators collection
   * and, unless `directory` overrides it, its folder under
   * `src/lib/generators/`. A single kebab-case path segment.
   */
  name: string;
  /** The plugin project to add the generator to. Must be tagged `type:plugin`. */
  project: string;
  /**
   * Folder segment under the plugin's `src/lib/generators/`. Defaults to
   * `name`; set it when the folder should differ from the collection key (as
   * `nx-gen` itself does, living in `generators/generator/`). A single
   * kebab-case path segment.
   */
  directory?: string;
  /** Test runner for the generated generator's spec. Jest-only per ADR 0007. */
  unitTestRunner?: 'jest' | 'none';
};
