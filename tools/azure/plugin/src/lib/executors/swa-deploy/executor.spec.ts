import { lastCallArg } from '@cybertecpty/jest-testing';
import { createExecutorContextFixture } from '@cybertecpty/nx-testing';
import { runCommand } from '@cybertecpty/nx-utils';
import { logger, type ExecutorContext, type TargetConfiguration } from '@nx/devkit';
import { join } from 'node:path';
import swaDeployExecutor, { TOKEN_VARIABLE } from './executor';

jest.mock('@cybertecpty/nx-utils', () => ({
  ...jest.requireActual<typeof import('@cybertecpty/nx-utils')>('@cybertecpty/nx-utils'),
  runCommand: jest.fn()
}));

const runCommandMock = jest.mocked(runCommand);

const DEFAULT_BUILD: TargetConfiguration = { outputs: ['{workspaceRoot}/dist/{projectRoot}'] };

/** A context fixture whose project graph gives `cybertec-io` the given targets. */
const createContextFixture = (
  targets: Record<string, TargetConfiguration> = { build: DEFAULT_BUILD },
  overrides: Partial<ExecutorContext> = {}
): ExecutorContext =>
  createExecutorContextFixture(
    { projectName: 'cybertec-io', projectRoot: 'apps/cybertec-io', targets },
    overrides
  );

const lastError = (): string =>
  lastCallArg(jest.mocked(logger.error), 0, '`logger.error`') as string;

describe('swaDeployExecutor', () => {
  const originalToken = process.env[TOKEN_VARIABLE];

  beforeEach(() => {
    runCommandMock.mockReset();
    runCommandMock.mockResolvedValue({ success: true });
    process.env[TOKEN_VARIABLE] = 'token';
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env[TOKEN_VARIABLE];
    } else {
      process.env[TOKEN_VARIABLE] = originalToken;
    }
  });

  describe('deploy folder', () => {
    it("deploys the build target's single output to production by default", async () => {
      await expect(swaDeployExecutor({}, createContextFixture())).resolves.toEqual({
        success: true
      });

      expect(runCommandMock).toHaveBeenCalledWith({
        command: join('/workspace', 'node_modules', '.bin', 'swa'),
        args: ['deploy', 'dist/apps/cybertec-io', '--env', 'production', '--no-use-keychain'],
        cwd: '/workspace',
        notFoundHint: expect.stringContaining('pnpm install') as string
      });
    });

    it("resolves option placeholders with the build target's default configuration", async () => {
      const build: TargetConfiguration = {
        outputs: ['{options.outputPath}'],
        options: { outputPath: 'dist/development' },
        configurations: { production: { outputPath: 'dist/production' } },
        defaultConfiguration: 'production'
      };

      await swaDeployExecutor({}, createContextFixture({ build }));

      expect(runCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(['dist/production']) as string[] })
      );
    });

    it('reads the output of the target named by buildTarget', async () => {
      const targets = { 'build-static': { outputs: ['{workspaceRoot}/dist/static'] } };

      await swaDeployExecutor({ buildTarget: 'build-static' }, createContextFixture(targets));

      expect(runCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(['dist/static']) as string[] })
      );
    });

    it('prefers the outputPath option, without needing a build target', async () => {
      await swaDeployExecutor(
        { outputPath: 'dist/custom', env: 'preview' },
        createContextFixture({})
      );

      expect(runCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['deploy', 'dist/custom', '--env', 'preview', '--no-use-keychain']
        })
      );
    });

    it.each<[string, Record<string, TargetConfiguration>, string]>([
      ['there is no build target', {}, 'cybertec-io has no "build" target'],
      ['the build target declares no outputs', { build: {} }, 'declares no outputs'],
      [
        'the build target declares an empty outputs list',
        { build: { outputs: [] } },
        'declares no outputs'
      ],
      [
        'the build target declares several outputs',
        { build: { outputs: ['{workspaceRoot}/dist/a', '{workspaceRoot}/coverage/a'] } },
        'exactly one output folder'
      ],
      [
        'the build target output is a glob',
        { build: { outputs: ['{workspaceRoot}/dist/{projectRoot}/**'] } },
        'exactly one output folder'
      ]
    ])('fails before calling swa when %s', async (_label, targets, expected) => {
      await expect(swaDeployExecutor({}, createContextFixture(targets))).resolves.toEqual({
        success: false
      });

      expect(runCommandMock).not.toHaveBeenCalled();
      expect(lastError()).toContain(expected);
      expect(lastError()).toContain('Set the outputPath option');
    });

    it('reports an unresolvable deploy folder before a missing token', async () => {
      delete process.env[TOKEN_VARIABLE];

      await swaDeployExecutor({}, createContextFixture({}));

      expect(lastError()).toContain('has no "build" target');
    });
  });

  describe('deployment token', () => {
    it('never passes the token as an argument', async () => {
      process.env[TOKEN_VARIABLE] = 'secret-token-value';

      await swaDeployExecutor({}, createContextFixture());

      expect(JSON.stringify(runCommandMock.mock.calls)).not.toContain('secret-token-value');
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['blank', '   ']
    ])('fails before calling swa when the token is %s', async (_label, token) => {
      if (token === undefined) {
        delete process.env[TOKEN_VARIABLE];
      } else {
        process.env[TOKEN_VARIABLE] = token;
      }

      await expect(swaDeployExecutor({}, createContextFixture())).resolves.toEqual({
        success: false
      });

      expect(runCommandMock).not.toHaveBeenCalled();
      expect(lastError()).toContain(`${TOKEN_VARIABLE} is not set`);
      expect(lastError()).toContain('apps/cybertec-io/.env.deploy');
      expect(lastError()).toContain('Manage deployment token');
    });
  });

  it('passes through an unsuccessful deploy', async () => {
    runCommandMock.mockResolvedValue({ success: false });

    await expect(swaDeployExecutor({}, createContextFixture())).resolves.toEqual({
      success: false
    });
  });

  it('fails when run outside a project target', async () => {
    await expect(
      swaDeployExecutor({}, createContextFixture(undefined, { projectName: undefined }))
    ).resolves.toEqual({ success: false });

    expect(runCommandMock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('swa-deploy must run as a project target.');
  });
});
