import { expectTypeOf } from 'expect-type';
import type { PackageJson } from 'type-fest';
import type { PackageJsonDependencies } from './package-json';

/* -------------------------------------------------------------------------- */
/*  PackageJsonDependencies                                                    */
/* -------------------------------------------------------------------------- */

// Only the two dependency maps are picked from `PackageJson`, nothing else.
expectTypeOf<keyof PackageJsonDependencies>().toEqualTypeOf<'dependencies' | 'devDependencies'>();

// Each map keeps the type `PackageJson` gives it.
expectTypeOf<PackageJsonDependencies['dependencies']>().toEqualTypeOf<
  PackageJson['dependencies']
>();
expectTypeOf<PackageJsonDependencies['devDependencies']>().toEqualTypeOf<
  PackageJson['devDependencies']
>();

// Both maps are optional, so a `package.json` with neither still fits.
expectTypeOf<Record<never, never>>().toExtend<PackageJsonDependencies>();

// A dependency maps a package name to a version range.
expectTypeOf<NonNullable<PackageJsonDependencies['dependencies']>[string]>().toEqualTypeOf<
  string | undefined
>();

// `Required` makes both maps always present.
expectTypeOf<Required<PackageJsonDependencies>['dependencies']>().not.toBeUndefined();
expectTypeOf<Required<PackageJsonDependencies>['devDependencies']>().not.toBeUndefined();
