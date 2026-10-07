import {
  NormalizedNxProjectOptions,
  NxProjectOptions,
  NxProjectScope
} from '@cybertecpty/nx-types';
import type { libraryGenerator } from '@nx/js';
import { Except, SetRequired } from 'type-fest';

/** Options accepted by `@nx/js`'s `libraryGenerator`, in its installed version. */
type NxJsLibraryGeneratorSchema = Parameters<typeof libraryGenerator>[1];

/**
 * The `type:` values this generator may scaffold — the framework-agnostic subset of
 * the ADR 0004 closed type set. `core`/`feature`/`ui`/`data-access` are Angular-only
 * (`@nx/angular:library`); `api`/`services` are Nest-only (`@nx/nest:library`); `app`/
 * `plugin` don't apply to a library generator. `infra` is backend-only and non-Nest —
 * `@nx/node:library` was considered for it but produces output functionally identical
 * to `@nx/js:library` for a plain library (same `tsconfig.lib.json`, same default
 * `testEnvironment: 'node'`), so it's scaffolded here too rather than through a second
 * generator (see issue #64).
 */
export type JsLibType = 'infra' | 'models' | 'testing' | 'types' | 'utils';

/**
 * Inputs to the `js-plugin` `lib` generator — a thin wrapper over `@nx/js:library`.
 *
 * `domain` is required: unlike a `tools/` project, a `libs/` project is never
 * domain-exempt (ADR 0009). `scope` excludes `tools` — this generator always places
 * projects under `libs/`, never `tools/`. It's optional here even though the
 * generator requires it at runtime for every type except `infra`: four of the five
 * allowed types are scope-polymorphic (ADR 0009 "Scope on the polymorphic types") and
 * need it as an explicit input, but `infra` is not — its `scope:` is always `backend`,
 * applied by the generator regardless of input; a conflicting explicit `--scope` for
 * `type:infra` is a thrown error, not a silent override (see `generator.ts`). `type`
 * is narrowed to `JsLibType`.
 *
 * `buildable` is dropped in favor of forwarding `@nx/js:library`'s native `bundler`
 * enum unchanged — unlike a plugin, a JS library's buildability isn't a simple
 * on/off. `directory`/`tags` are dropped from the native schema (derived, not
 * accepted raw); `js` is dropped (the workspace is TypeScript-only, ADR 0005);
 * `buildable`/`compiler`/`setParserOptionsProject`/`config` are dropped (deprecated
 * or legacy on the native schema already). `linter`/`unitTestRunner` are re-narrowed
 * to this workspace's supported values — `unitTestRunner` loses `vitest` (Jest-only,
 * ADR 0007), `linter` loses the deprecated `Linter` enum members.
 */
export type LibGeneratorOptions = SetRequired<
  Except<NxProjectOptions, 'buildable' | 'scope' | 'type'>,
  'domain'
> &
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
     * The project's `scope:` tag — always a `libs/` project, so never `tools`.
     * Required for every `type` except `infra`, which is always `scope:backend`
     * (enforced at runtime in `generator.ts`, not by this type — see the doc comment
     * above).
     */
    scope?: Exclude<NxProjectScope, 'tools'>;
    /** The `type:` tag and final directory segment — restricted to `JsLibType`. */
    type: JsLibType;
    /** Tool for running lint checks. */
    linter?: 'eslint' | 'none';
    /** Test runner for unit tests. Jest-only per ADR 0007. */
    unitTestRunner?: 'jest' | 'none';
  };

/**
 * `LibGeneratorOptions` after the generator has resolved `name`, `directory`, and
 * `tags`, and forwarded `bundler` to `@nx/js:library` unchanged.
 */
export type NormalizedLibGeneratorOptions = LibGeneratorOptions &
  Except<NormalizedNxProjectOptions<NxProjectScope, JsLibType>, 'bundler'>;
