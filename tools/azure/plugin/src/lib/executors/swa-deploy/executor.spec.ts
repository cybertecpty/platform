import { logger, type ExecutorContext } from '@nx/devkit';
import { join } from 'node:path';
import { runCommand } from '../../utils/run-command.utils';
import swaDeployExecutor, { TOKEN_VARIABLE } from './executor';

jest.mock('../../utils/run-command.utils', () => ({ runCommand: jest.fn() }));

const runCommandMock = jest.mocked(runCommand);

const createContext = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  root: '/workspace',
  cwd: '/workspace',
  isVerbose: false,
  projectName: 'cybertec-io',
  projectGraph: { nodes: {}, dependencies: {} },
  projectsConfigurations: {
    version: 2,
    projects: { 'cybertec-io': { root: 'apps/cybertec-io' } }
  },
  nxJsonConfiguration: {},
  ...overrides
});

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

  it('deploys the project build output to production by default', async () => {
    await expect(swaDeployExecutor({}, createContext())).resolves.toEqual({ success: true });

    expect(runCommandMock).toHaveBeenCalledWith({
      command: join('/workspace', 'node_modules', '.bin', 'swa'),
      args: ['deploy', 'dist/apps/cybertec-io', '--env', 'production', '--no-use-keychain'],
      cwd: '/workspace',
      notFoundHint: expect.stringContaining('pnpm install') as string
    });
  });

  it('uses the given output path and environment', async () => {
    await swaDeployExecutor({ outputPath: 'dist/custom', env: 'preview' }, createContext());

    expect(runCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['deploy', 'dist/custom', '--env', 'preview', '--no-use-keychain']
      })
    );
  });

  it('never passes the token as an argument', async () => {
    process.env[TOKEN_VARIABLE] = 'secret-token-value';

    await swaDeployExecutor({}, createContext());

    expect(JSON.stringify(runCommandMock.mock.calls)).not.toContain('secret-token-value');
  });

  it('passes through an unsuccessful deploy', async () => {
    runCommandMock.mockResolvedValue({ success: false });

    await expect(swaDeployExecutor({}, createContext())).resolves.toEqual({ success: false });
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

    await expect(swaDeployExecutor({}, createContext())).resolves.toEqual({ success: false });

    expect(runCommandMock).not.toHaveBeenCalled();
    const message = jest.mocked(logger.error).mock.calls[0][0] as string;
    expect(message).toContain(`${TOKEN_VARIABLE} is not set`);
    expect(message).toContain('apps/cybertec-io/.env.deploy');
    expect(message).toContain('Manage deployment token');
  });

  it('fails when run outside a project target', async () => {
    await expect(swaDeployExecutor({}, createContext({ projectName: undefined }))).resolves.toEqual(
      {
        success: false
      }
    );

    expect(runCommandMock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('swa-deploy must run as a project target.');
  });
});
