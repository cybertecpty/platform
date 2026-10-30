/**
 * Options for the workspace `nx-exec` generator.
 */
export interface NxExecGeneratorOptions {
  /**
   * The executor name — its key in the target plugin's executors collection and, unless
   * `directory` overrides it, its folder under `src/lib/executors/`.
   */
  name: string;

  /** The `type:plugin` project to add the executor to. */
  project: string;

  /** Folder segment under the plugin's `src/lib/executors/`. Defaults to `name`. */
  directory?: string;

  /** Executor description, recorded in `executors.json`, `schema.json` and the README. */
  description?: string;

  /** Test runner for the generated executor's spec. Defaults to `jest` (ADR 0007). */
  unitTestRunner?: 'jest' | 'none';

  /** Do not add an eslint configuration for the plugin's json files. */
  skipLintChecks?: boolean;

  /** Skip formatting files. */
  skipFormat?: boolean;
}
