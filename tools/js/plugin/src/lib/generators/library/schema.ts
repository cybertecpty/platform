import type {
  NormalizedNxProjectOptions,
  NxProjectOptions,
  NxProjectPlatform,
  SharedLibType
} from '@cybertecpty/nx-types';
import type { libraryGenerator } from '@nx/js';
import type { Except } from 'type-fest';

/**
 * Inputs to the `js-plugin` `ts-lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * `platform` is required and excludes `backend` (the backend is .NET). A `frontend` `utils` or
 * `testing` library is rejected at runtime in favor of the `angular-plugin` `ng-lib` generator.
 * `domain` is required for every platform except `tools` (ADR 0009).
 */
export type JsLibGeneratorOptions = NxProjectOptions<JsLibPlatform, JsLibType> &
  Except<NxJsLibraryGeneratorSchema, 'directory' | 'js' | 'linter' | 'unitTestRunner'> & {
    /**
     * The type from the `@nx/js:library` schema is busted, so redeclare it here.
     */
    linter?: 'eslint' | 'none';
    /**
     * Test runner for unit tests. Vitest-only per ADR 0018; `jest` is rejected at runtime.
     * `none` is rejected for `platform:shared`.
     */
    unitTestRunner?: 'vitest' | 'none';
  };

/**
 * The platform types allowed for JS libraries, which is everything except `backend` for .NET projects.
 */
export type JsLibPlatform = Exclude<NxProjectPlatform, 'backend'>;

/**
 * The `type:` values this generator may scaffold — the framework-agnostic subset of
 * the ADR 0004 closed type set.
 */
export type JsLibType = SharedLibType | 'types';

/**
 * `JsLibGeneratorOptions` after the generator has resolved `name`, `directory`,
 * and `tags`.
 */
export type NormalizedJsLibGeneratorOptions = JsLibGeneratorOptions &
  NormalizedNxProjectOptions<JsLibPlatform, JsLibType>;

/** Options accepted by `@nx/js`'s `libraryGenerator`, in its installed version. */
type NxJsLibraryGeneratorSchema = Parameters<typeof libraryGenerator>[1];
