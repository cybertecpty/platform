import type {
  BackendLibType,
  NormalizedNxProjectOptions,
  NxProjectOptions,
  NxProjectPlatform
} from '@cybertecpty/nx-types';
import type { libraryGenerator } from '@nx/js';
import type { Except } from 'type-fest';

/**
 * The `type:` values this generator may scaffold — the framework-agnostic subset of
 * the ADR 0004 closed type set. `core`/`feature`/`ui`/`data-access` are Angular-only
 * (`@nx/angular:library`); `app`/`plugin` don't apply to a library generator.
 */
export type JsLibType = 'models' | 'testing' | 'types' | 'utils';

/**
 * Inputs to the `js-plugin` `lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * `domain` is required at runtime for every `platform` except `tools`: a `libs/` project
 * is never domain-exempt, while a `platform:tools` project lives under `tools/` and is
 * domain-exempt (ADR 0009), so a `domain` with `platform:tools` is a thrown error.
 *
 * `platform` is optional here even though the generator requires it at runtime: every
 * allowed type is platform-polymorphic (ADR 0009 "Scope on the polymorphic types") and
 * needs it as an explicit input (see `generator.ts`). `type` is `JsLibType` plus
 * `BackendLibType`, which the generator rejects.
 *
 * `buildable` is dropped in favor of forwarding `@nx/js:library`'s native `bundler`
 * enum unchanged — unlike a plugin, a JS library's buildability isn't a simple
 * on/off. `directory`/`tags` are dropped from the native schema (derived, not
 * accepted raw); `js` is dropped (the workspace is TypeScript-only, ADR 0005);
 * `buildable`/`compiler`/`setParserOptionsProject`/`config` are dropped (deprecated
 * or legacy on the native schema already). `linter`/`unitTestRunner` are re-narrowed
 * to this workspace's supported values — `unitTestRunner` loses `jest` (Vitest-only,
 * ADR 0018), `linter` loses the deprecated `Linter` enum members.
 */
export type LibGeneratorOptions = Except<NxProjectOptions, 'buildable' | 'platform' | 'type'> &
  Except<
    NxJsLibraryGeneratorSchema,
    | 'directory'
    | 'tags'
    | 'js'
    | 'buildable'
    | 'compiler'
    | 'setParserOptionsProject'
    | 'config'
    | 'unitTestRunner'
    | 'linter'
  > & {
    /**
     * The project's `platform:` tag; `tools` places the project under `tools/`.
     * Required (enforced at runtime in `generator.ts`, not by this type — see the doc
     * comment above).
     */
    platform?: NxProjectPlatform;
    /** The `type:` tag and final directory segment; a `BackendLibType` is rejected at runtime. */
    type: JsLibType | BackendLibType;
    /** Tool for running lint checks. */
    linter?: 'eslint' | 'none';
    /**
     * Test runner for unit tests. Vitest-only per ADR 0018; `jest` is rejected at runtime.
     * `none` is rejected for `platform:shared`.
     */
    unitTestRunner?: 'vitest' | 'none';
  };

/**
 * `LibGeneratorOptions` after the generator has resolved `name`, `directory`, and
 * `tags`, and forwarded `bundler` to `@nx/js:library` unchanged.
 */
export type NormalizedLibGeneratorOptions = LibGeneratorOptions &
  Except<NormalizedNxProjectOptions<NxProjectPlatform, JsLibType>, 'bundler'>;

/** Options accepted by `@nx/js`'s `libraryGenerator`, in its installed version. */
type NxJsLibraryGeneratorSchema = Parameters<typeof libraryGenerator>[1];
