import type { CreateNodesContext } from '@nx/devkit';
import {
  createCheckBoundariesTarget,
  createNodes,
  createNodesForProjectFile,
  DEFAULT_CHECK_BOUNDARIES_TARGET_NAME,
  DOTNET_PROJECT_FILE_GLOB
} from './plugin';

const [, createNodesFunction] = createNodes;

const context: CreateNodesContext = { nxJsonConfiguration: {}, workspaceRoot: '/workspace' };

describe('createNodes', () => {
  it('looks for the project files of C#, F# and Visual Basic projects', () => {
    expect(createNodes[0]).toBe(DOTNET_PROJECT_FILE_GLOB);
    expect(DOTNET_PROJECT_FILE_GLOB).toBe('**/*.{csproj,fsproj,vbproj}');
  });

  it('adds the target to the project in the folder of each project file', async () => {
    const results = await createNodesFunction(
      ['backend/checkout-api/CheckoutApi.csproj', 'backend/checkout-host/CheckoutHost.fsproj'],
      undefined,
      context
    );

    expect(results.map(([projectFile]) => projectFile)).toEqual([
      'backend/checkout-api/CheckoutApi.csproj',
      'backend/checkout-host/CheckoutHost.fsproj'
    ]);
    expect(results.map(([, result]) => Object.keys(result.projects ?? {}))).toEqual([
      ['backend/checkout-api'],
      ['backend/checkout-host']
    ]);
  });

  it('gives each project the same target', async () => {
    const [[, result]] = await createNodesFunction(
      ['backend/checkout-api/CheckoutApi.csproj'],
      undefined,
      context
    );

    expect(result.projects?.['backend/checkout-api']?.targets).toEqual({
      [DEFAULT_CHECK_BOUNDARIES_TARGET_NAME]: createCheckBoundariesTarget()
    });
  });

  it('uses the target name from the options', async () => {
    const [[, result]] = await createNodesFunction(
      ['backend/checkout-api/CheckoutApi.csproj'],
      { targetName: 'boundaries' },
      context
    );

    expect(Object.keys(result.projects?.['backend/checkout-api']?.targets ?? {})).toEqual([
      'boundaries'
    ]);
  });

  it('returns nothing for no project files', async () => {
    await expect(createNodesFunction([], undefined, context)).resolves.toEqual([]);
  });
});

describe('createNodesForProjectFile', () => {
  it('names the project root after the folder of the project file', () => {
    expect(
      Object.keys(
        createNodesForProjectFile('backend/checkout-api/tests/CheckoutApi.Tests.csproj', undefined)
          .projects ?? {}
      )
    ).toEqual(['backend/checkout-api/tests']);
  });

  it('uses the workspace root for a project file at the top level', () => {
    expect(Object.keys(createNodesForProjectFile('Solo.csproj', undefined).projects ?? {})).toEqual(
      ['.']
    );
  });

  it('defaults the target name to check-boundaries', () => {
    expect(DEFAULT_CHECK_BOUNDARIES_TARGET_NAME).toBe('check-boundaries');
    expect(
      Object.keys(
        createNodesForProjectFile('backend/a/A.csproj', {}).projects?.['backend/a']?.targets ?? {}
      )
    ).toEqual(['check-boundaries']);
  });
});

describe('createCheckBoundariesTarget', () => {
  it('runs the check-boundaries executor of this plugin', () => {
    expect(createCheckBoundariesTarget().executor).toBe(
      '@cybertecpty/dotnet-plugin:check-boundaries'
    );
  });

  it('is cached', () => {
    expect(createCheckBoundariesTarget().cache).toBe(true);
  });

  it('depends on the project, its dependencies and the code that runs the check', () => {
    const inputs = createCheckBoundariesTarget().inputs;

    expect(inputs).toEqual(
      expect.arrayContaining([
        'default',
        '^default',
        '{workspaceRoot}/tools/dotnet/plugin/src/**/*.ts',
        '{workspaceRoot}/tools/nx/utils/src/**/*.{ts,mts}',
        '{workspaceRoot}/libs/shared/utils/src/**/*.ts'
      ])
    );
  });

  it('is described as a .NET target', () => {
    expect(createCheckBoundariesTarget().metadata?.technologies).toEqual(['dotnet']);
  });

  it('returns a new object each time', () => {
    expect(createCheckBoundariesTarget()).not.toBe(createCheckBoundariesTarget());
  });
});
