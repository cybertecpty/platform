import type { SimpleGit } from 'simple-git';

import { assertBaseIncludesTarget } from './release-preflight.utils';

describe('assertBaseIncludesTarget', () => {
  // Real git always prints a count here, so only a fake client can reach this guard.
  it('fails rather than passing when git output is not a count', async () => {
    const git = {
      fetch: jest.fn().mockResolvedValue(undefined),
      raw: jest.fn().mockResolvedValue('fatal: nonsense')
    } as unknown as SimpleGit;

    await expect(
      assertBaseIncludesTarget({ baseBranch: 'develop', dryRun: false, targetBranch: 'main' }, git)
    ).rejects.toThrow(/unexpected git output/);
  });
});
