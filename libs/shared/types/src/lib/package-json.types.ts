import type { PackageJson } from 'type-fest';

export type PackageJsonDependencies = Pick<PackageJson, 'dependencies' | 'devDependencies'>;
