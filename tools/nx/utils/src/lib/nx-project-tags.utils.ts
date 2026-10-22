import { NxProjectOptions, type NxProjectType } from '@cybertecpty/nx-types';
import { wildcardToRegExp } from '@cybertecpty/shared-utils';
import type { ProjectConfiguration } from '@nx/devkit';
import { domainPathToName, normalizeDomainPath } from './nx-domain.utils';

/**
 * The separator between a tag's key and its value, as in `scope:backend`.
 */
export const PROJECT_TAG_SEPARATOR = ':';

/**
 * The separator between tags in a comma-separated tag string.
 */
export const PROJECT_TAGS_SEPARATOR = ',';

/**
 * Joins a key and a value into a tag, such as `type` and `api` into `type:api`.
 */
export function createProjectTag(key: string, value: string): string {
  return `${key}${PROJECT_TAG_SEPARATOR}${value}`;
}

/**
 * Formats tags as the comma-separated string Nx generators accept for `tags`.
 */
export function formatProjectTags(tags: readonly string[]): string {
  return tags.join(PROJECT_TAGS_SEPARATOR);
}

/**
 * Groups tags by key, so `['type:api', 'type:app']` becomes `{ type: ['api', 'app'] }`.
 * A tag with no valid separator is skipped.
 */
export function groupProjectTags(tags: readonly string[]): Record<string, string[]> {
  const record: Record<string, string[]> = {};

  for (const tag of tags) {
    const separatorIndex = tag.indexOf(PROJECT_TAG_SEPARATOR);

    if (isValidProjectTag(tag)) {
      const key = tag.slice(0, separatorIndex);
      const value = tag.slice(separatorIndex + 1);

      (record[key] ??= []).push(value);
    }
  }

  return record;
}

/**
 * Whether `tags` contain a tag matching `pattern`. The pattern is one of:
 * - `*`, which matches any project, even one with no tags;
 * - a regular expression between slashes, such as `/^type:(api|app)$/`, tested against each
 *   `key:value` tag;
 * - a tag containing `*`, such as `type:*`, where `*` stands for any characters;
 * - an exact tag, such as `type:api`.
 */
export function hasProjectTag(tags: readonly string[], pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    const regex = new RegExp(pattern.slice(1, -1));

    return tags.some(tag => regex.test(tag));
  }

  if (pattern.includes('*')) {
    const regex = wildcardToRegExp(pattern);

    return tags.some(tag => regex.test(tag));
  }

  return tags.includes(pattern);
}

/**
 * Whether `project` carries the `type:{type}` tag. A project with no tags is of no type.
 */
export function isProjectOfType(
  project: Pick<ProjectConfiguration, 'tags'>,
  type: NxProjectType
): boolean {
  return hasProjectTag(project.tags ?? [], createProjectTag('type', type));
}

/**
 * Whether `tag` has the `key:value` form, with a non-empty key and a non-empty value.
 */
export function isValidProjectTag(tag: string): boolean {
  const separatorIndex = tag.indexOf(PROJECT_TAG_SEPARATOR);

  return separatorIndex > 0 && separatorIndex < tag.length - 1;
}

/**
 * Normalizes tags: trims each one, drops anything that is not `key:value`, removes duplicates
 * and sorts alphabetically. A string is read as comma-separated tags.
 */
export function parseProjectTags(input: string | readonly string[]): string[] {
  const rawTags = typeof input === 'string' ? input.split(PROJECT_TAGS_SEPARATOR) : input;
  const tags = rawTags.map(tag => tag.trim()).filter(tag => isValidProjectTag(tag));

  return [...new Set(tags)].sort();
}

/**
 * Derives a project's tags from its generator options: the explicit `tags`, plus `scope`,
 * `type` and, when the project has one, `domain` (a subdomain path is joined with hyphens).
 */
export function projectTagsFromOptions(options: NxProjectOptions): string[] {
  const { scope, tags, type } = options;
  const domainPath = normalizeDomainPath(options);

  return parseProjectTags([
    ...(tags ? tags.split(PROJECT_TAGS_SEPARATOR) : []),
    createProjectTag('scope', scope),
    createProjectTag('type', type),
    ...(domainPath ? [createProjectTag('domain', domainPathToName(domainPath))] : [])
  ]);
}

/**
 * The values of every tag with the given key, such as `['api', 'app']` for `type`.
 */
export function projectTagValues(tags: readonly string[], key: string): string[] {
  const prefix = createProjectTag(key, '');

  return tags.filter(tag => tag.startsWith(prefix)).map(tag => tag.slice(prefix.length));
}
