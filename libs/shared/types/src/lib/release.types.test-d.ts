import { expectTypeOf } from 'expect-type';

import { ReleaseManifest } from './release.types';

/* -------------------------------------------------------------------------- */
/*  ReleaseManifest                                                            */
/* -------------------------------------------------------------------------- */

// A fully readonly record of strings; `author` is the only optional key. The
// literal mirror guards against accidental widening of a value type.
expectTypeOf<ReleaseManifest>().toEqualTypeOf<{
  readonly author?: string;
  readonly project: string;
  readonly releaseCommit: string;
  readonly releaseDate: string;
  readonly version: string;
}>();

// A plain object without `author` is assignable to the manifest.
expectTypeOf<{
  project: string;
  releaseCommit: string;
  releaseDate: string;
  version: string;
}>().toExtend<ReleaseManifest>();
