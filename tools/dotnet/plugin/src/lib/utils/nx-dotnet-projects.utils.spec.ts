import { createProjectNodeFixture } from '@cybertecpty/nx-testing';
import { isDotNetProjectNode } from './nx-dotnet-projects.utils';

describe('nx-dotnet-projects.utils', () => {
  describe('isDotNetProjectNode', () => {
    it('returns true if the technologies metadata includes "dotnet"', () => {
      const node = createProjectNodeFixture({
        name: 'checkout-api',
        metadata: { technologies: ['dotnet', 'other-tech'] }
      });

      expect(isDotNetProjectNode(node)).toBe(true);
    });

    it('returns false if the technologies metadata does not include "dotnet"', () => {
      const node = createProjectNodeFixture({
        name: 'checkout-ui',
        metadata: { technologies: ['other-tech'] }
      });

      expect(isDotNetProjectNode(node)).toBe(false);
    });

    it('returns false if the technologies metadata is undefined', () => {
      const node = createProjectNodeFixture({ name: 'checkout-ui', metadata: {} });

      expect(isDotNetProjectNode(node)).toBe(false);
    });

    it('returns false if the metadata is undefined', () => {
      const node = createProjectNodeFixture({ name: 'checkout-ui' });

      expect(isDotNetProjectNode(node)).toBe(false);
    });
  });
});
