import { NxProjectOptions } from '@cybertecpty/nx-types';
import { createProjectTags, NxProjectTags } from './nx-project-tags.utils';

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
      expect(tags.hasTag('scope', 'tools')).toBe(true);
    });

    it('does not add invalid predefined tag', () => {
      const tags = new NxProjectTags();
      tags.addPredefinedTag('scope', 'node' as any); // not in predefined
      expect(tags.hasTag('scope', 'node')).toBe(false);
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
  });
});
