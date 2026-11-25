import { readJsonFile, workspaceRoot, type NxJsonConfiguration } from '@nx/devkit';
import { join } from 'node:path';

/** Nx's own default tag pattern for independently released projects. */
export const DEFAULT_RELEASE_TAG_PATTERN = '{projectName}@{version}';

/**
 * Builds the release tag name for a project at a version by filling in the pattern's
 * `{projectName}` and `{version}` placeholders.
 *
 * @throws When the pattern has any other placeholder (such as `{releaseGroupName}`), which this
 * cannot fill in; a half-built tag would never match what Nx reads back.
 */
export function formatReleaseTag(pattern: string, project: string, version: string): string {
  const tag = pattern.replaceAll('{projectName}', project).replaceAll('{version}', version);
  const unsupported = /\{[^}]+\}/.exec(tag)?.[0];

  if (unsupported) {
    throw new Error(
      `Cannot build a release tag from pattern "${pattern}": ${unsupported} is not supported.`
    );
  }

  return tag;
}

/**
 * Reads `release.releaseTag.pattern` from the workspace's `nx.json`, falling back to Nx's default
 * when it is not set. Only the global pattern is read; one set on a single release group is ignored.
 *
 * @param root The workspace root holding `nx.json`. Defaults to the current workspace.
 */
export function readReleaseTagPattern(root: string = workspaceRoot): string {
  return (
    readJsonFile<NxJsonConfiguration>(join(root, 'nx.json')).release?.releaseTag?.pattern ??
    DEFAULT_RELEASE_TAG_PATTERN
  );
}

/**
 * Turns a release tag pattern into a glob matching the project's release tags: the project name
 * is filled in and every other placeholder (the version, the release group) matches anything.
 */
export function toReleaseTagGlob(pattern: string, project: string): string {
  return pattern.replaceAll('{projectName}', project).replaceAll(/\{[^}]+\}/g, '*');
}
