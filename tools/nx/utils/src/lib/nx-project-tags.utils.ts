import { NxProjectOptions } from '@cybertecpty/nx-types';
import { MapPrimitivePropsToArrays, NonNullableProps } from '@cybertecpty/shared-types';
import { UniqMultiMap } from '@cybertecpty/shared-utils';
import { ArrayElement, Simplify } from 'type-fest';
import { NX_PROJECT_SCOPES, NX_PROJECT_TYPES } from './nx-projects.utils';

/**
 * A collection of all the predefined tags for Nx projects,
 * derived from the project options.
 *
 * `domain` is intentionally excluded: unlike `scope` and `type`, it is a free-form string set by
 * consumer workspaces (see `NxProjectDomain`), not a closed set `addPredefinedTag` can validate
 * against. Use `createProjectTags`/`addTagsRecord` for domain instead.
 */
export type NxProjectPredefinedTags = Simplify<
  Partial<MapPrimitivePropsToArrays<NonNullableProps<NxProjectTagOpts>>>
>;

/**
 * These are the Nx project options that are used to create predefined project tags.
 */
export type NxProjectTagOpts = Pick<NxProjectOptions, 'scope' | 'type'>;

/**
 * Creates project tags based on the provided options.
 * Tools projects (`scope:tools`) are domain-exempt — they never receive a `domain:*` tag,
 * matching their directory/name handling. For other library projects, domain defaults to `shared`
 * when not explicitly set so that domain-specific code (a consumer workspace's own product
 * domains) can import shared libraries. App projects should always provide an explicit domain.
 */
export function createProjectTags<T extends NxProjectOptions>(options: T): NxProjectTags {
  const { scope, type } = options;
  // Tools projects are domain-exempt (no domain:* tag). Otherwise default the domain to 'shared' for
  // library projects so they are reachable by domain-constrained projects via the ESLint boundary
  // rules; apps must set their own domain explicitly.
  const domain =
    scope === 'tools' ? undefined : (options.domain ?? (type !== 'app' ? 'shared' : undefined));
  const tagRecord: Record<string, string> = { scope, type };

  if (domain) {
    tagRecord['domain'] = domain;
  }

  const tags = new NxProjectTags(tagRecord);

  if (options.tags) {
    tags.addTagsString(options.tags);
  }

  return tags;
}

/**
 * A utility class for managing Nx project tags.
 * Allows adding, retrieving, and checking tags
 * in various formats (string, array, record).
 * Also supports predefined tags for common Nx
 * project attributes.
 */
export class NxProjectTags {
  /**
   * A collection of predefined Nx project tags.
   * Used by the `addPredefinedTag` method to add
   * predefined tags to the collection of project tags.
   */
  protected static readonly PREDEFINED_TAGS: Simplify<Required<NxProjectPredefinedTags>> = {
    scope: NX_PROJECT_SCOPES,
    type: NX_PROJECT_TYPES
  } as const;

  /**
   * The separator used to join tags into key-value pairs.
   */
  protected static readonly TAG_SEPARATOR = ':';
  /**
   * The separator used to join multiple tags in a string.
   */
  protected static readonly TAGS_SEPARATOR = ',';

  /**
   * The collection of project tags, stored as a map.
   */
  protected readonly _projectTagsMap = new UniqMultiMap<string, string>();

  /**
   *
   */
  constructor(
    protected readonly _initialTags: string | string[] | Record<string, string | string[]> = {}
  ) {
    if (typeof _initialTags === 'string') {
      this.addTagsString(_initialTags);
    } else if (Array.isArray(_initialTags)) {
      this.addTagsArray(_initialTags);
    } else {
      this.addTagsRecord(_initialTags);
    }
  }

  /**
   * Adds the requested predefined tag to the collection of project tags.
   * If the tag is not found in the predefined tags, it will not be added.
   */
  addPredefinedTag<K extends keyof NxProjectPredefinedTags>(
    key: K,
    value: ArrayElement<NonNullable<NxProjectPredefinedTags[K]>>
  ): this {
    const matchingTag = NxProjectTags.PREDEFINED_TAGS[key]?.find(predValue => predValue === value);

    if (matchingTag) {
      this._projectTagsMap.addOne(key, matchingTag);
    }

    return this;
  }

  /**
   * Adds an array of string tags to the collection of project tags.
   * Each tag should be in the format "key:value".
   * If a tag does not conform to this format, it will be ignored.
   */
  addTagsArray(tags: string[]): this {
    const sanitizedTags = this.sanitizeTags(tags);

    for (const tag of sanitizedTags) {
      const [key, value] = tag.split(NxProjectTags.TAG_SEPARATOR);

      if (key && value) {
        this._projectTagsMap.addOne(key, value);
      }
    }

    return this;
  }

  /**
   * Adds a string of tags to the collection of project tags.
   * The string should contain tags separated by commas,
   * and each tag should be in the format "key:value".
   * If a tag does not conform to this format, it will be ignored.
   */
  addTagsString(tagsStr: string): this {
    const tagsArr = tagsStr.split(NxProjectTags.TAGS_SEPARATOR);

    return this.addTagsArray(tagsArr);
  }

  /**
   * Adds a record of tags to the collection of project tags.
   * Each key in the record represents a tag key,
   * and the value can be a single string or an array of strings.
   */
  addTagsRecord(tags: Record<string, string | string[]>): this {
    Object.entries(tags).forEach(([key, rawValue]) => {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const value of values.map(v => v.trim()).filter(Boolean)) {
        this._projectTagsMap.addOne(key, value);
      }
    });

    return this;
  }

  getTags(key: string): string[] {
    return this._projectTagsMap.getAll(key);
  }

  hasTag(key: string, value: string): boolean {
    return this._projectTagsMap.hasValue(key, value);
  }

  /**
   * Sanitizes the provided tags by trimming whitespace,
   * removing empty tags, and filtering out tags that
   * don't conform to the "key:value" format.
   */
  protected sanitizeTags(tags: string | string[]): string[] {
    const normalized = Array.isArray(tags) ? tags : [tags];

    return normalized.map(tag => tag.trim()).filter(tag => tag.length > 0 && tag.includes(':'));
  }

  /**
   * Converts the collection of project tags into an array of tags,
   * where each tag is formatted as "key:value". The tags are sorted
   * alphabetically.
   */
  toArray(): string[] {
    const tags: string[] = [];

    for (const [key, values] of this._projectTagsMap.entries()) {
      if (key) {
        for (const value of values) {
          if (value) {
            tags.push(`${key}${NxProjectTags.TAG_SEPARATOR}${value}`);
          }
        }
      }
    }

    return tags.sort();
  }

  /**
   * Returns the collection of project tags as a record,
   * where each property consists of a tag key and
   * its corresponding values.
   */
  toRecord(): Record<string, string[]> {
    const record: Record<string, string[]> = {};

    for (const [key, values] of this._projectTagsMap.entries()) {
      record[key] = Array.from(values);
    }

    return record;
  }

  /**
   * Converts the collection of project tags into a string
   * where each tag is in the format "key:value" and
   * tags are separated by commas. The tags are sorted alphabetically.
   */
  toString(): string {
    return this.toArray().join(NxProjectTags.TAGS_SEPARATOR);
  }
}
