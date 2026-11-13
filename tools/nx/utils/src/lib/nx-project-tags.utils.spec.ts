import { NxProjectOptions } from '@cybertecpty/nx-types';
import {
  createProjectTag,
  formatProjectTags,
  groupProjectTags,
  hasProjectTag,
  isProjectOfType,
  isValidProjectTag,
  parseProjectTags,
  projectTagsFromOptions,
  projectTagValues
} from './nx-project-tags.utils';

describe('nx-project-tags.utils', () => {
  describe('createProjectTag', () => {
    it('joins a key and a value with a colon', () => {
      expect(createProjectTag('type', 'api')).toBe('type:api');
    });
  });

  describe('isValidProjectTag', () => {
    it.each(['platform:backend', 'type:api', 'custom:a:b'])('accepts %p', tag => {
      expect(isValidProjectTag(tag)).toBe(true);
    });

    it.each(['', 'invalidtag', ':value', 'key:', ':'])('rejects %p', tag => {
      expect(isValidProjectTag(tag)).toBe(false);
    });
  });

  describe('parseProjectTags', () => {
    it('reads a comma-separated string', () => {
      expect(parseProjectTags('framework:angular,platform:frontend')).toEqual([
        'framework:angular',
        'platform:frontend'
      ]);
    });

    it('reads an array', () => {
      expect(parseProjectTags(['ui:shared', 'cloud:any'])).toEqual(['cloud:any', 'ui:shared']);
    });

    it('ignores invalid tags', () => {
      expect(parseProjectTags('valid:tag,invalidtag,,another:valid')).toEqual([
        'another:valid',
        'valid:tag'
      ]);
    });

    it('trims whitespace around each tag', () => {
      expect(parseProjectTags(' platform:tools , type:utils ')).toEqual([
        'platform:tools',
        'type:utils'
      ]);
    });

    it('removes duplicate tags', () => {
      expect(parseProjectTags(['type:api', 'type:api', 'platform:backend'])).toEqual([
        'platform:backend',
        'type:api'
      ]);
    });

    it('sorts tags alphabetically', () => {
      expect(parseProjectTags(['type:utils', 'domain:shared', 'platform:tools'])).toEqual([
        'domain:shared',
        'platform:tools',
        'type:utils'
      ]);
    });

    it('returns an empty array for no tags', () => {
      expect(parseProjectTags('')).toEqual([]);
      expect(parseProjectTags([])).toEqual([]);
    });

    it('does not modify the array it is given', () => {
      const input = ['type:utils', 'platform:tools'];

      parseProjectTags(input);

      expect(input).toEqual(['type:utils', 'platform:tools']);
    });
  });

  describe('projectTagsFromOptions', () => {
    it('creates tags from project options, defaulting domain to shared for lib types', () => {
      const options: NxProjectOptions = {
        name: 'material',
        type: 'ui',
        platform: 'shared',
        tags: 'custom:tag1,custom:tag2'
      };

      expect(formatProjectTags(projectTagsFromOptions(options))).toBe(
        'custom:tag1,custom:tag2,domain:shared,platform:shared,type:ui'
      );
    });

    it('tags the project with `platform:` and never with `scope:`', () => {
      const tags = projectTagsFromOptions({ name: 'game', type: 'types', platform: 'backend' });

      expect(tags).toContain('platform:backend');
      expect(tags.some(tag => tag.startsWith('scope:'))).toBe(false);
    });

    it('includes the explicit domain tag when provided', () => {
      const options: NxProjectOptions = {
        name: 'game',
        type: 'types',
        platform: 'shared',
        domain: 'atlas'
      };

      expect(projectTagsFromOptions(options)).toEqual([
        'domain:atlas',
        'platform:shared',
        'type:types'
      ]);
    });

    it('compounds a multi-segment (subdomain) domain into a single hyphenated domain tag', () => {
      const options: NxProjectOptions = {
        name: 'checkout',
        type: 'services',
        platform: 'backend',
        domain: 'billing/checkout'
      };

      expect(projectTagsFromOptions(options)).toEqual([
        'domain:billing-checkout',
        'platform:backend',
        'type:services'
      ]);
    });

    it('throws for a malformed multi-segment domain', () => {
      const options: NxProjectOptions = {
        name: 'checkout',
        type: 'services',
        platform: 'backend',
        domain: 'billing//checkout'
      };

      expect(() => projectTagsFromOptions(options)).toThrow(
        '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });

    it('does not add a domain tag for app projects when domain is unspecified', () => {
      const options: NxProjectOptions = { name: 'vault', type: 'app', platform: 'frontend' };

      expect(projectTagsFromOptions(options)).toEqual(['platform:frontend', 'type:app']);
    });

    it('includes the explicit domain tag for app projects when provided', () => {
      const options: NxProjectOptions = {
        name: 'vault',
        type: 'app',
        platform: 'frontend',
        domain: 'vault'
      };

      expect(projectTagsFromOptions(options)).toEqual([
        'domain:vault',
        'platform:frontend',
        'type:app'
      ]);
    });

    it('does not add a domain tag for tools projects when domain is unspecified', () => {
      const options: NxProjectOptions = { name: 'github', type: 'utils', platform: 'tools' };

      expect(projectTagsFromOptions(options)).toEqual(['platform:tools', 'type:utils']);
    });

    it('omits the domain tag for tools projects even when a domain is provided', () => {
      const options: NxProjectOptions = {
        name: 'github',
        type: 'plugin',
        platform: 'tools',
        domain: 'atlas'
      };

      expect(projectTagsFromOptions(options)).toEqual(['platform:tools', 'type:plugin']);
    });

    it('does not repeat a tag that the options also list explicitly', () => {
      const options: NxProjectOptions = {
        name: 'github',
        type: 'utils',
        platform: 'tools',
        tags: 'platform:tools,custom:one'
      };

      expect(projectTagsFromOptions(options)).toEqual([
        'custom:one',
        'platform:tools',
        'type:utils'
      ]);
    });
  });

  describe('projectTagValues', () => {
    const tags = ['platform:backend', 'type:api', 'type:services'];

    it('returns every value for a key', () => {
      expect(projectTagValues(tags, 'type')).toEqual(['api', 'services']);
    });

    it('returns an empty array for a key the tags do not have', () => {
      expect(projectTagValues(tags, 'domain')).toEqual([]);
    });

    it('does not match a key that only starts with the requested one', () => {
      expect(projectTagValues(['types:x', 'type:api'], 'type')).toEqual(['api']);
    });
  });

  describe('groupProjectTags', () => {
    it('groups values by key', () => {
      expect(groupProjectTags(['type:api', 'type:app', 'platform:backend'])).toEqual({
        type: ['api', 'app'],
        platform: ['backend']
      });
    });

    it('skips tags that are not key:value', () => {
      expect(groupProjectTags(['invalid', 'ui:tailwind'])).toEqual({ ui: ['tailwind'] });
    });

    it('returns an empty record for no tags', () => {
      expect(groupProjectTags([])).toEqual({});
    });
  });

  describe('formatProjectTags', () => {
    it('joins tags with commas', () => {
      expect(formatProjectTags(['platform:tools', 'type:core'])).toBe('platform:tools,type:core');
    });

    it('returns an empty string for no tags', () => {
      expect(formatProjectTags([])).toBe('');
    });
  });

  describe('isProjectOfType', () => {
    it('is true for a project carrying the `type:{type}` tag', () => {
      expect(isProjectOfType({ tags: ['platform:tools', 'type:plugin'] }, 'plugin')).toBe(true);
    });

    it('is false for a project of another type', () => {
      expect(isProjectOfType({ tags: ['platform:tools', 'type:utils'] }, 'plugin')).toBe(false);
    });

    it('is false for a project without tags', () => {
      expect(isProjectOfType({}, 'plugin')).toBe(false);
    });

    it('matches only the `type` key, not the same value under another key', () => {
      expect(isProjectOfType({ tags: ['platform:plugin', 'domain:plugin'] }, 'plugin')).toBe(false);
    });
  });

  describe('hasProjectTag', () => {
    const tags = ['domain:shared', 'platform:backend', 'type:api', 'type:services'];

    describe('with an exact key:value tag', () => {
      it.each(['platform:backend', 'type:api', 'type:services', 'domain:shared'])(
        'is true for the tag %s that the project has',
        tag => {
          expect(hasProjectTag(tags, tag)).toBe(true);
        }
      );

      it.each(['platform:frontend', 'type:infra', 'domain:checkout', 'type:app', 'type'])(
        'is false for %s, which the project does not have',
        tag => {
          expect(hasProjectTag(tags, tag)).toBe(false);
        }
      );

      it('is false for every tag when the project has no tags', () => {
        expect(hasProjectTag([], 'type:api')).toBe(false);
      });
    });

    describe('with a bare wildcard', () => {
      it('is true whether or not the project has tags', () => {
        expect(hasProjectTag(tags, '*')).toBe(true);
        expect(hasProjectTag([], '*')).toBe(true);
      });
    });

    describe('with a wildcard pattern', () => {
      it('is true when any tag has the prefix before the wildcard', () => {
        expect(hasProjectTag(tags, 'type:*')).toBe(true);
        expect(hasProjectTag(tags, 'platform:*')).toBe(true);
      });

      it('is false when no tag has that prefix', () => {
        expect(hasProjectTag(tags, 'framework:*')).toBe(false);
      });

      it('matches a wildcard in the key position', () => {
        expect(hasProjectTag(tags, '*:shared')).toBe(true);
        expect(hasProjectTag(tags, '*:nothing')).toBe(false);
      });

      it('matches a wildcard in the middle of a tag', () => {
        expect(hasProjectTag(tags, 'type:ser*s')).toBe(true);
        expect(hasProjectTag(tags, 'type:ser*x')).toBe(false);
      });

      it('is false for a project without tags', () => {
        expect(hasProjectTag([], 'type:*')).toBe(false);
      });

      it('treats regular-expression characters other than the wildcard literally', () => {
        expect(hasProjectTag(['type:a.b'], 'type:a.*')).toBe(true);
        expect(hasProjectTag(['type:axb'], 'type:a.b*')).toBe(false);
      });
    });

    describe('with a regular-expression tag', () => {
      it('is true when any tag matches the expression', () => {
        expect(hasProjectTag(tags, '/^type:(api|app)$/')).toBe(true);
      });

      it('is false when no tag matches the expression', () => {
        expect(hasProjectTag(tags, '/^type:(app|ui)$/')).toBe(false);
      });

      it('matches against the whole key:value tag', () => {
        expect(hasProjectTag(tags, '/^platform:/')).toBe(true);
        expect(hasProjectTag(tags, '/^backend$/')).toBe(false);
      });

      it('is false for a project without tags', () => {
        expect(hasProjectTag([], '/.*/')).toBe(false);
      });

      it('names the pattern when the expression is invalid', () => {
        expect(() => hasProjectTag(tags, '/(/')).toThrow(
          'Invalid regular expression in tag pattern "/(/"'
        );
      });

      it('treats a lone slash as an exact tag, not an empty expression', () => {
        expect(hasProjectTag(tags, '/')).toBe(false);
      });
    });

    it('works on tags exactly as Nx stores them, including ones that are not key:value', () => {
      expect(hasProjectTag(['npm:private', 'legacy'], 'legacy')).toBe(true);
    });
  });
});
