import { expectTypeOf } from 'expect-type';

import { MapPrimitivePropsToArrays, NonNullableProps } from './objects.types';

/* -------------------------------------------------------------------------- */
/*  MapPrimitivePropsToArrays                                                  */
/* -------------------------------------------------------------------------- */

interface Sample {
  tags: string;
  id: number | { external: true };
  meta: { a: 1 };
  optional?: string;
}

// Every key: primitives become read-only arrays, unions keep their
// non-primitive members, non-primitive properties are untouched, and the
// optional modifier is preserved.
expectTypeOf<MapPrimitivePropsToArrays<Sample>>().toEqualTypeOf<{
  tags: readonly string[];
  id: { external: true } | readonly number[];
  meta: { a: 1 };
  optional?: readonly (string | undefined)[];
}>();

// A property with no primitive members is passed through unchanged.
expectTypeOf<MapPrimitivePropsToArrays<Sample>['meta']>().toEqualTypeOf<{ a: 1 }>();

// Narrowing `U` transforms only those keys; the rest of `T` is passed through
// unchanged (before the `& Omit<T, U>` clause, siblings were dropped entirely).
expectTypeOf<MapPrimitivePropsToArrays<Sample, 'tags'>>().toEqualTypeOf<{
  tags: readonly string[];
  id: number | { external: true };
  meta: { a: 1 };
  optional?: string;
}>();

/* -------------------------------------------------------------------------- */
/*  NonNullableProps                                                           */
/* -------------------------------------------------------------------------- */

interface Nullable {
  id?: string | null;
  name: string | undefined;
  note?: string;
  readonly slug: string | null;
}

// Selected keys become non-nullable and required; every other property -
// including its `readonly`/optional modifiers - is passed through unchanged.
expectTypeOf<NonNullableProps<Nullable, 'id' | 'name'>>().toEqualTypeOf<{
  id: string;
  name: string;
  note?: string;
  readonly slug: string | null;
}>();

// Default `K` covers every key.
expectTypeOf<NonNullableProps<Nullable>>().toEqualTypeOf<{
  id: string;
  name: string;
  note: string;
  readonly slug: string;
}>();

// A key whose value is only nullish collapses to `never`.
expectTypeOf<NonNullableProps<{ x: null | undefined }>['x']>().toEqualTypeOf<never>();
