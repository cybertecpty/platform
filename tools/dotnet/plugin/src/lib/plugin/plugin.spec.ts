import type { CreateNodesContext } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHECK_COVERAGE_OUTPUT_TARGET_NAME,
  COVERAGE_OUTPUT,
  createCheckBoundariesTarget,
  createCheckCoverageOutputTarget,
  createFormatCheckTarget,
  createFormatTarget,
  createNodes,
  createNodesForProjectFile,
  DEFAULT_CHECK_BOUNDARIES_TARGET_NAME,
  DOTNET_PROJECT_FILE_GLOB,
  FORMAT_CHECK_TARGET_NAME,
  FORMAT_TARGET_NAME,
  TESTING_TAG
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
      [DEFAULT_CHECK_BOUNDARIES_TARGET_NAME]: createCheckBoundariesTarget(),
      [FORMAT_CHECK_TARGET_NAME]: createFormatCheckTarget(),
      [FORMAT_TARGET_NAME]: createFormatTarget()
    });
  });

  it('uses the target name from the options', async () => {
    const [[, result]] = await createNodesFunction(
      ['backend/checkout-api/CheckoutApi.csproj'],
      { targetName: 'boundaries' },
      context
    );

    expect(Object.keys(result.projects?.['backend/checkout-api']?.targets ?? {})).toEqual([
      'boundaries',
      'format-check',
      'format'
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
        createNodesForProjectFile(
          'backend/checkout-api/tests/CheckoutApi.Tests.csproj',
          undefined,
          '/workspace'
        ).projects ?? {}
      )
    ).toEqual(['backend/checkout-api/tests']);
  });

  it('uses the workspace root for a project file at the top level', () => {
    expect(
      Object.keys(createNodesForProjectFile('Solo.csproj', undefined, '/workspace').projects ?? {})
    ).toEqual(['.']);
  });

  it('marks the project as a .NET project, which the executor requires', () => {
    expect(
      createNodesForProjectFile('backend/a/A.csproj', undefined, '/workspace').projects?.[
        'backend/a'
      ]?.metadata
    ).toEqual({ technologies: ['dotnet'] });
  });

  it('defaults the target name to check-boundaries', () => {
    expect(DEFAULT_CHECK_BOUNDARIES_TARGET_NAME).toBe('check-boundaries');
    expect(
      Object.keys(
        createNodesForProjectFile('backend/a/A.csproj', {}, '/workspace').projects?.['backend/a']
          ?.targets ?? {}
      )
    ).toEqual(['check-boundaries', 'format-check', 'format']);
  });
});

describe('createFormatCheckTarget', () => {
  it('runs dotnet format on the project and fails when it would change a file', () => {
    expect(FORMAT_CHECK_TARGET_NAME).toBe('format-check');
    expect(createFormatCheckTarget()).toMatchObject({
      executor: 'nx:run-commands',
      options: { command: 'dotnet format {projectRoot} --verify-no-changes' }
    });
  });

  it('is cached', () => {
    expect(createFormatCheckTarget().cache).toBe(true);
  });

  it('depends on the project and the workspace files that decide its rules', () => {
    expect(createFormatCheckTarget().inputs).toEqual([
      'default',
      '{workspaceRoot}/.editorconfig',
      '{workspaceRoot}/global.json',
      '{workspaceRoot}/Directory.Build.props'
    ]);
  });

  it('is described as a .NET target', () => {
    expect(createFormatCheckTarget().metadata?.technologies).toEqual(['dotnet']);
  });

  it('returns a new object each time', () => {
    expect(createFormatCheckTarget()).not.toBe(createFormatCheckTarget());
  });
});

describe('createFormatTarget', () => {
  it('runs dotnet format on the project and rewrites files', () => {
    expect(FORMAT_TARGET_NAME).toBe('format');
    expect(createFormatTarget()).toMatchObject({
      executor: 'nx:run-commands',
      options: { command: 'dotnet format {projectRoot}' }
    });
  });

  it('is not cached', () => {
    expect(createFormatTarget().cache).toBe(false);
  });

  it('is described as a .NET target', () => {
    expect(createFormatTarget().metadata?.technologies).toEqual(['dotnet']);
  });

  it('returns a new object each time', () => {
    expect(createFormatTarget()).not.toBe(createFormatTarget());
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

describe('coverage output of a tests project', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'dotnet-plugin-'));
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function writeProject(root: string, projectJson: object | undefined) {
    mkdirSync(join(workspaceRoot, root), { recursive: true });
    if (projectJson) {
      writeFileSync(join(workspaceRoot, root, 'project.json'), JSON.stringify(projectJson));
    }
  }

  function testTarget(root: string) {
    return createNodesForProjectFile(`${root}/A.csproj`, undefined, workspaceRoot).projects?.[root]
      ?.targets?.['test'];
  }

  it('adds the coverage directory to the test target of a project tagged type:testing', () => {
    writeProject('libs/a/tests', { tags: [TESTING_TAG] });

    expect(COVERAGE_OUTPUT).toBe('{workspaceRoot}/coverage/{projectRoot}');
    expect(testTarget('libs/a/tests')?.outputs).toEqual(['...', COVERAGE_OUTPUT]);
  });

  it('reads the tags from the workspace root the plugin is given', async () => {
    writeProject('libs/a/tests', { tags: [TESTING_TAG] });

    const [[, result]] = await createNodesFunction(['libs/a/tests/A.csproj'], undefined, {
      ...context,
      workspaceRoot
    });

    expect(result.projects?.['libs/a/tests']?.targets?.['test']?.outputs).toEqual([
      '...',
      COVERAGE_OUTPUT
    ]);
  });

  it('leaves other .NET projects without a test target', () => {
    writeProject('libs/a', { tags: ['type:feature'] });

    expect(testTarget('libs/a')).toBeUndefined();
  });

  it('leaves a project without a project.json without a test target', () => {
    writeProject('libs/b', undefined);

    expect(testTarget('libs/b')).toBeUndefined();
  });

  it('leaves a project with no tags without a test target', () => {
    writeProject('libs/c', {});

    expect(testTarget('libs/c')).toBeUndefined();
  });
});

describe('createCheckCoverageOutputTarget', () => {
  it('runs the check-coverage-output executor of this plugin, cached', () => {
    const target = createCheckCoverageOutputTarget();

    expect(target.executor).toBe('@cybertecpty/dotnet-plugin:check-coverage-output');
    expect(target.cache).toBe(true);
  });

  it('is invalidated by whatever changes the resolved outputs of test', () => {
    expect(createCheckCoverageOutputTarget().inputs).toEqual(
      expect.arrayContaining([
        'default',
        '{workspaceRoot}/nx.json',
        { externalDependencies: ['@nx/dotnet'] }
      ])
    );
  });

  describe('on a project file', () => {
    let workspaceRoot: string;

    beforeEach(() => {
      workspaceRoot = mkdtempSync(join(tmpdir(), 'dotnet-plugin-'));
      mkdirSync(join(workspaceRoot, 'libs/a'), { recursive: true });
    });

    afterEach(() => {
      rmSync(workspaceRoot, { recursive: true, force: true });
    });

    const targetsOf = (tags: string[]) => {
      writeFileSync(join(workspaceRoot, 'libs/a/project.json'), JSON.stringify({ tags }));
      return createNodesForProjectFile('libs/a/A.csproj', undefined, workspaceRoot).projects?.[
        'libs/a'
      ]?.targets;
    };

    it('is added to a project tagged type:testing', () => {
      expect(targetsOf([TESTING_TAG])?.[CHECK_COVERAGE_OUTPUT_TARGET_NAME]).toEqual(
        createCheckCoverageOutputTarget()
      );
    });

    it('is not added to other projects', () => {
      expect(targetsOf(['type:feature'])?.[CHECK_COVERAGE_OUTPUT_TARGET_NAME]).toBeUndefined();
    });
  });
});
