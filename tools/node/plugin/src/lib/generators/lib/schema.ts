import { NormalizedNxProjectOptions, NxProjectOptions } from '@cybertecpty/nx-types';
import type { libraryGenerator } from '@nx/node';
import { Except, SetRequired } from 'type-fest';

/**
 * The `type:` values this generator may scaffold — today, only `infra`: the one
 * backend-only, non-Nest type left after ADR 0004's closed set (`api`/`services` are
 * Nest-only, `@nx/nest:library` territory; `testing`/`types`/`utils` are already owned
 * by `js-plugin:lib`'s `@nx/js:library` wrapper for `scope:backend`). Kept as an
 * explicit enum rather than folded into a hardcoded constant so the schema shape stays
 * uniform with `js-plugin:lib`'s, ready for a future ADR 0004 reopen without a
 * schema-shape change.
 */
export type NodeLibType = 'infra';

/** Options accepted by `@nx/node`'s `libraryGenerator`, in its installed version. */
type NxNodeLibraryGeneratorSchema = Parameters<typeof libraryGenerator>[1];

/**
 * Inputs to the `node-plugin` `lib` generator — a thin wrapper over `@nx/node:library`.
 *
 * `domain` is required: unlike a `tools/` project, a `libs/` project is never
 * domain-exempt (ADR 0009). `scope` is dropped entirely, unlike `js-plugin:lib` —
 * `type:infra` isn't one of ADR 0004's three scope-polymorphic types (`utils`/
 * `testing`/`types`), so its `scope:` is always `backend`, hardcoded by the generator
 * rather than accepted as input. `type` is narrowed to `NodeLibType`.
 *
 * `buildable` from `NxProjectOptions` is dropped in favor of forwarding
 * `@nx/node:library`'s own native `buildable` boolean unchanged — no bundler
 * translation is needed here, unlike `js-plugin:lib`'s `bundler` enum forwarding.
 * `directory`/`tags` are dropped from the native schema (derived, not accepted raw);
 * `js` is dropped (the workspace is TypeScript-only, ADR 0005); `setParserOptionsProject`
 * is dropped (deprecated alias of `enableTypedLinting`). `linter`/`unitTestRunner` are
 * re-narrowed to this workspace's supported values — `unitTestRunner` loses `vitest`
 * (Jest-only, ADR 0007), `linter` loses `oxlint`. `compiler` is re-declared optional —
 * unlike `@nx/plugin:plugin`'s schema, `@nx/node:library`'s native `compiler` is
 * required with no default encoded in its type, even though `schema.json` defaults it
 * to `tsc`; this generator does the same, defaulting it in `generator.ts`. `addPlugin`
 * is dropped — an internal Nx flag this wrapper never sets.
 */
export type LibGeneratorOptions = SetRequired<
  Except<NxProjectOptions, 'buildable' | 'scope' | 'type'>,
  'domain'
> &
  Except<
    NxNodeLibraryGeneratorSchema,
    | 'directory'
    | 'tags'
    | 'js'
    | 'setParserOptionsProject'
    | 'unitTestRunner'
    | 'linter'
    | 'compiler'
    | 'addPlugin'
  > & {
    /** The `type:` tag and final directory segment — restricted to the Node-only, non-Nest subset. */
    type: NodeLibType;
    /** Tool for running lint checks. */
    linter?: 'eslint' | 'none';
    /** Test runner for unit tests. Jest-only per ADR 0007. */
    unitTestRunner?: 'jest' | 'none';
    /** The compiler used by the build and test targets. Defaults to `tsc`. */
    compiler?: 'tsc' | 'swc';
  };

/**
 * `LibGeneratorOptions` after the generator has resolved `name`, `directory`, and
 * `tags`, and pinned `scope`.
 *
 * `bundler` is omitted from the shared `NormalizedNxProjectOptions` shape: this
 * generator has no bundler — buildability is driven by the native `buildable`/
 * `compiler` fields already present on `LibGeneratorOptions`.
 */
export type NormalizedLibGeneratorOptions = LibGeneratorOptions &
  Except<NormalizedNxProjectOptions<'backend', NodeLibType>, 'bundler'>;
