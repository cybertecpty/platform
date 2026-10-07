import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { runGh } from './github-cli.utils';
import { createPullRequest, findOpenPullRequest, updatePullRequest } from './pull-request.utils';

jest.mock('./github-cli.utils', () => ({ runGh: jest.fn() }));

const mockRunGh = jest.mocked(runGh);

/** Locates the temp file path following a `--body-file` flag in a `gh` arg list. */
const bodyFileArg = (args: readonly string[]): string => {
  const path = args[args.indexOf('--body-file') + 1];

  if (!path) {
    throw new Error(`no --body-file in args: ${args.join(' ')}`);
  }

  return path;
};

const ghOutput = (stdout: string): { stderr: string; stdout: string } => ({ stderr: '', stdout });

afterEach(() => {
  mockRunGh.mockReset();
});

describe('createPullRequest', () => {
  it('opens the PR for the head → base pair and returns the trimmed URL', async () => {
    mockRunGh.mockResolvedValue(ghOutput('  https://github.com/o/r/pull/7\n'));

    const url = await createPullRequest({
      base: 'main',
      body: 'the body',
      head: 'release/1.2.0',
      title: 'Release 1.2.0'
    });

    expect(url).toBe('https://github.com/o/r/pull/7');
    expect(mockRunGh).toHaveBeenCalledWith([
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      'release/1.2.0',
      '--title',
      'Release 1.2.0',
      '--body-file',
      expect.any(String)
    ]);
  });

  it('passes the body through a temp file that holds the body and is removed afterwards', async () => {
    let seenPath = '';
    let seenContents = '';
    mockRunGh.mockImplementation(async args => {
      seenPath = bodyFileArg(args);
      seenContents = await readFile(seenPath, 'utf8');

      return ghOutput('https://github.com/o/r/pull/7');
    });

    await createPullRequest({ base: 'main', body: 'changelog\nbody', head: 'h', title: 't' });

    expect(seenContents).toBe('changelog\nbody');
    expect(existsSync(seenPath)).toBe(false);
  });

  it('still removes the temp file when gh fails, and propagates the error', async () => {
    let seenPath = '';
    mockRunGh.mockImplementation(args => {
      seenPath = bodyFileArg(args);

      return Promise.reject(new Error('gh pr create failed'));
    });

    await expect(
      createPullRequest({ base: 'main', body: 'b', head: 'h', title: 't' })
    ).rejects.toThrow('gh pr create failed');
    expect(existsSync(seenPath)).toBe(false);
  });
});

describe('findOpenPullRequest', () => {
  it('lists open PRs for the branch pair and returns the first number', async () => {
    mockRunGh.mockResolvedValue(ghOutput(JSON.stringify([{ number: 42 }, { number: 43 }])));

    await expect(findOpenPullRequest('release/1.2.0', 'main')).resolves.toBe(42);
    expect(mockRunGh).toHaveBeenCalledWith([
      'pr',
      'list',
      '--head',
      'release/1.2.0',
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'number'
    ]);
  });

  it('returns null when no open PR exists', async () => {
    mockRunGh.mockResolvedValue(ghOutput('[]'));

    await expect(findOpenPullRequest('h', 'main')).resolves.toBeNull();
  });
});

describe('updatePullRequest', () => {
  it('edits the numbered PR and returns the trimmed URL', async () => {
    mockRunGh.mockResolvedValue(ghOutput('https://github.com/o/r/pull/7\n'));

    const url = await updatePullRequest({ body: 'new body', number: 7, title: 'new title' });

    expect(url).toBe('https://github.com/o/r/pull/7');
    expect(mockRunGh).toHaveBeenCalledWith([
      'pr',
      'edit',
      '7',
      '--title',
      'new title',
      '--body-file',
      expect.any(String)
    ]);
  });

  it('writes the updated body to the temp file', async () => {
    let seenContents = '';
    mockRunGh.mockImplementation(async args => {
      seenContents = await readFile(bodyFileArg(args), 'utf8');

      return ghOutput('https://github.com/o/r/pull/7');
    });

    await updatePullRequest({ body: 'edited body', number: 7, title: 't' });

    expect(seenContents).toBe('edited body');
  });
});
