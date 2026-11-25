/**
 * The single point in the workspace that reaches into Nx's internal, unversioned
 * modules for affected-project resolution. Nx does not re-export these from
 * `@nx/devkit`, and their paths are not covered by semver — if an upgrade moves
 * or renames them, fix them here rather than hunting through consumers.
 */
export { getAffectedGraphNodes } from 'nx/src/command-line/affected/affected.js';
export type { NxArgs } from 'nx/src/utils/command-line-utils.js';
export { findMatchingProjects } from 'nx/src/utils/find-matching-projects.js';
