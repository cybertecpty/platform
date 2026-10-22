import { NxProjectOptions } from '@cybertecpty/nx-types';
import { createProjectTags, isProjectOfType, NxProjectTags } from './nx-project-tags.utils';

describe('nx-project-tags.utils', () => {
  describe('createProjectTags', () => {
    it('creates tags from project options, defaulting domain to shared for lib types', () => {
      const options: NxProjectOptions = {
        name: 'material',
        type: 'ui',
        scope: 'shared',
        tags: 'custom:tag1,custom:tag2'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('custom:tag1,custom:tag2,domain:shared,scope:shared,type:ui');
    });

    it('includes the explicit domain tag when provided', () => {
      const options: NxProjectOptions = {
        name: 'game',
        type: 'models',
        scope: 'shared',
        domain: 'atlas'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('domain:atlas,scope:shared,type:models');
    });

    it('compounds a multi-segment (subdomain) domain into a single hyphenated domain tag', () => {
      const options: NxProjectOptions = {
        name: 'checkout',
        type: 'services',
        scope: 'backend',
        domain: 'billing/checkout'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('domain:billing-checkout,scope:backend,type:services');
    });

    it('throws for a malformed multi-segment domain, same as projectDomainToName', () => {
      const options: NxProjectOptions = {
        name: 'checkout',
        type: 'services',
        scope: 'backend',
        domain: 'billing//checkout'
      };

      expect(() => createProjectTags(options)).toThrow(
        '`domain` segment "" must be lowercase alphanumeric words joined by single hyphens.'
      );
    });

    it('does not add a domain tag for app projects when domain is unspecified', () => {
      const options: NxProjectOptions = {
        name: 'vault',
        type: 'app',
        scope: 'frontend'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('scope:frontend,type:app');
    });

    it('includes the explicit domain tag for app projects when provided', () => {
      const options: NxProjectOptions = {
        name: 'vault',
        type: 'app',
        scope: 'frontend',
        domain: 'vault'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('domain:vault,scope:frontend,type:app');
    });

    it('does not add a domain tag for tools projects when domain is unspecified', () => {
      const options: NxProjectOptions = {
        name: 'github',
        type: 'utils',
        scope: 'tools'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('scope:tools,type:utils');
    });

    it('omits the domain tag for tools projects even when a domain is provided (tools are domain-exempt)', () => {
      const options: NxProjectOptions = {
        name: 'github',
        type: 'plugin',
        scope: 'tools',
        domain: 'atlas'
      };

      const result = createProjectTags(options);
      expect(result.toString()).toBe('scope:tools,type:plugin');
    });
  });

  describe('isProjectOfType', () => {
    it('is true for a project carrying the `type:{type}` tag', () => {
      expect(isProjectOfType({ tags: ['scope:tools', 'type:plugin'] }, 'plugin')).toBe(true);
    });

    it('is false for a project of another type', () => {
      expect(isProjectOfType({ tags: ['scope:tools', 'type:utils'] }, 'plugin')).toBe(false);
    });

    it('is false for a project without tags', () => {
      expect(isProjectOfType({}, 'plugin')).toBe(false);
    });

    it('matches only the `type` key, not the same value under another key', () => {
      expect(isProjectOfType({ tags: ['scope:plugin', 'domain:plugin'] }, 'plugin')).toBe(false);
    });
  });

  describe('NxProjectTags', () => {
    it('initializes from a string', () => {
      const tags = new NxProjectTags('framework:angular,scope:frontend');
      expect(tags.toArray().sort()).toEqual(['framework:angular', 'scope:frontend']);
    });

    it('initializes from an array', () => {
      const tags = new NxProjectTags(['cloud:any', 'ui:shared']);
      expect(tags.getTags('cloud')).toEqual(['any']);
      expect(tags.getTags('ui')).toEqual(['shared']);
    });

    it('initializes from a record', () => {
      const tags = new NxProjectTags({ type: ['app', 'feature'], scope: 'shared' });
      expect(tags.getTags('type').sort()).toEqual(['app', 'feature']);
      expect(tags.getTags('scope')).toEqual(['shared']);
    });

    it('ignores invalid tags in string input', () => {
      const tags = new NxProjectTags('valid:tag,invalidtag,,another:valid');
      expect(tags.toArray().sort()).toEqual(['another:valid', 'valid:tag']);
    });

    it('adds predefined tag if valid', () => {
      const tags = new NxProjectTags();
      tags.addPredefinedTag('scope', 'tools');
      expect(tags.hasTag('scope:tools')).toBe(true);
    });

    it('does not add invalid predefined tag', () => {
      const tags = new NxProjectTags();
      tags.addPredefinedTag('scope', 'node' as any); // not in predefined
      expect(tags.hasTag('scope:node')).toBe(false);
    });

    it('converts to string correctly', () => {
      const tags = new NxProjectTags({ type: ['core'], scope: ['tools'] });
      expect(tags.toString()).toBe('scope:tools,type:core');
    });

    it('converts to record correctly', () => {
      const tags = new NxProjectTags({ ui: ['tailwind'] });
      expect(tags.toRecord()).toEqual({ ui: ['tailwind'] });
    });

    it('can add tags after instantiation from array', () => {
      const tags = new NxProjectTags();
      tags.addTagsArray(['scope:backend', 'type:utils']);
      expect(tags.toArray().sort()).toEqual(['scope:backend', 'type:utils']);
    });

    it('can add tags after instantiation from record', () => {
      const tags = new NxProjectTags();
      tags.addTagsRecord({ framework: 'angular' });
      expect(tags.getTags('framework')).toEqual(['angular']);
    });

    it('can add tags after instantiation from string', () => {
      const tags = new NxProjectTags();
      tags.addTagsString('type:ui,ui:material');
      expect(tags.toRecord()).toEqual({ type: ['ui'], ui: ['material'] });
    });

    describe('hasTag', () => {
      const projectTags = new NxProjectTags('scope:backend,type:api,type:services,domain:shared');

      describe('with an exact key:value tag', () => {
        it.each(['scope:backend', 'type:api', 'type:services', 'domain:shared'])(
          'is true for the tag %s that the project has',
          tag => {
            expect(projectTags.hasTag(tag)).toBe(true);
          }
        );

        it.each(['scope:frontend', 'type:infra', 'domain:checkout'])(
          'is false for the tag %s that the project does not have',
          tag => {
            expect(projectTags.hasTag(tag)).toBe(false);
          }
        );

        it('is false when the key exists but not with that value', () => {
          expect(projectTags.hasTag('type:app')).toBe(false);
        });

        it('is false for a key the project does not have at all', () => {
          expect(projectTags.hasTag('framework:angular')).toBe(false);
        });

        it('is false for every tag when the project has no tags', () => {
          expect(new NxProjectTags().hasTag('type:api')).toBe(false);
        });

        it('is false for a tag without a value', () => {
          expect(projectTags.hasTag('type')).toBe(false);
        });
      });

      describe('with a bare wildcard', () => {
        it('is true for a project that has tags', () => {
          expect(projectTags.hasTag('*')).toBe(true);
        });

        it('is true even for a project without tags', () => {
          expect(new NxProjectTags().hasTag('*')).toBe(true);
        });
      });

      describe('with a wildcard pattern', () => {
        it('is true when any tag has the prefix before the wildcard', () => {
          expect(projectTags.hasTag('type:*')).toBe(true);
          expect(projectTags.hasTag('scope:*')).toBe(true);
        });

        it('is false when no tag has that prefix', () => {
          expect(projectTags.hasTag('framework:*')).toBe(false);
        });

        it('matches a wildcard in the value position of a specific key only', () => {
          expect(new NxProjectTags('scope:backend').hasTag('type:*')).toBe(false);
        });

        it('matches a wildcard in the key position', () => {
          expect(projectTags.hasTag('*:shared')).toBe(true);
          expect(projectTags.hasTag('*:nothing')).toBe(false);
        });

        it('matches a wildcard in the middle of a tag', () => {
          expect(projectTags.hasTag('type:ser*s')).toBe(true);
          expect(projectTags.hasTag('type:ser*x')).toBe(false);
        });

        it('is false for a project without tags', () => {
          expect(new NxProjectTags().hasTag('type:*')).toBe(false);
        });

        it('treats regular-expression characters other than the wildcard literally', () => {
          const tags = new NxProjectTags('type:a.b');

          expect(tags.hasTag('type:a.*')).toBe(true);
          expect(new NxProjectTags('type:axb').hasTag('type:a.b*')).toBe(false);
        });
      });

      describe('with a regular-expression tag', () => {
        it('is true when any tag matches the expression', () => {
          expect(projectTags.hasTag('/^type:(api|app)$/')).toBe(true);
        });

        it('is false when no tag matches the expression', () => {
          expect(projectTags.hasTag('/^type:(app|ui)$/')).toBe(false);
        });

        it('matches against the whole key:value tag', () => {
          expect(projectTags.hasTag('/^scope:/')).toBe(true);
          expect(projectTags.hasTag('/^backend$/')).toBe(false);
        });

        it('is false for a project without tags', () => {
          expect(new NxProjectTags().hasTag('/.*/')).toBe(false);
        });
      });
    });
  });
});
