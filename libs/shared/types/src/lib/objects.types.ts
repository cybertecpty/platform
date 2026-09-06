import { Primitive, Simplify } from 'type-fest';

/**
 * Maps the primitive-valued members of the properties `U` of `T` to read-only
 * arrays of that primitive, leaving non-primitive members untouched. Keys of `T`
 * outside `U` are passed through unchanged.
 *
 * @template T - The object type to transform.
 * @template U - The keys to transform; defaults to every key of `T`.
 *
 * @example
 * type In = { tags: string; id: number | { external: true }; meta: { a: 1 } };
 * type Out = MapPrimitivePropsToArrays<In>;
 * //   ^? { tags: readonly string[];
 * //        id: { external: true } | readonly number[];
 * //        meta: { a: 1 } }
 *
 * @remarks
 * An optional property carries `undefined` in its type, and `undefined` is a
 * {@link Primitive}, so `foo?: string` becomes `foo?: readonly (string | undefined)[]`.
 */
export type MapPrimitivePropsToArrays<T, U extends keyof T = keyof T> = Simplify<
  {
    [Key in U]: [Extract<T[Key], Primitive>] extends [never]
      ? // No primitive members: leave the property untouched.
        T[Key]
      : // Keep the non-primitive members; collapse the primitive ones into a
        // read-only array.
        Exclude<T[Key], Primitive> | readonly Extract<T[Key], Primitive>[];
  } & Omit<T, U>
>;

/**
 * Makes the values of the properties `K` of `T` non-nullable and required,
 * leaving every other property of `T` unchanged. `K` defaults to every key
 * of `T`.
 *
 * @template T - The object type to transform.
 * @template K - The keys to make non-nullable and required.
 *
 * @example
 * type In = { id?: string | null; name: string | undefined; note?: string };
 * type Out = NonNullableProps<In, 'id' | 'name'>;
 * //   ^? { id: string; name: string; note?: string }
 */
export type NonNullableProps<T, K extends keyof T = keyof T> = Simplify<
  Omit<T, K> & {
    [P in K]-?: NonNullable<T[P]>;
  }
>;
