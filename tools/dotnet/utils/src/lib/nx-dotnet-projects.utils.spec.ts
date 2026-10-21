import { isDotNetProjectNode } from './nx-dotnet-projects.utils';

describe('nx-dotnet-projects.utils', () => {
  describe('isDotNetProjectNode', () => {
    it('returns true if the technologies metadata includes "dotnet"', () => {
      const node = {
        data: {
          metadata: {
            technologies: ['dotnet', 'other-tech']
          }
        }
      } as any;

      expect(isDotNetProjectNode(node)).toBe(true);
    });

    it('returns false if the technologies metadata does not include "dotnet"', () => {
      const node = {
        data: {
          metadata: {
            technologies: ['other-tech']
          }
        }
      } as any;

      expect(isDotNetProjectNode(node)).toBe(false);
    });

    it('returns false if the technologies metadata is undefined', () => {
      const node = {
        data: {
          metadata: {}
        }
      } as any;

      expect(isDotNetProjectNode(node)).toBe(false);
    });

    it('returns false if the metadata is undefined', () => {
      const node = {
        data: {}
      } as any;

      expect(isDotNetProjectNode(node)).toBe(false);
    });
  });
});
