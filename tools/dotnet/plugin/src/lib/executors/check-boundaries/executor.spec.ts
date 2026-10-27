import {
  createDependencyGraphFixture,
  createExecutorContextFixture,
  createProjectNodeFixture
} from '@cybertecpty/nx-testing';
import {
  DependencyType,
  logger,
  type ProjectGraph,
  type ProjectGraphProjectNode
} from '@nx/devkit';
import checkBoundariesExecutor from './executor';
import type { CheckBoundariesExecutorOptions } from './schema';

// Jest cannot load the real matrix, an `.mts` file, so the executor gets a small one. The rest of
// `nx-utils`, including the check itself, is real.
jest.mock('@cybertecpty/nx-utils', () => ({
  ...jest.requireActual<typeof import('@cybertecpty/nx-utils')>('@cybertecpty/nx-utils'),
  loadDepConstraints: () => [
    { sourceTag: 'type:api', onlyDependOnLibsWithTags: ['type:services'] },
    {
      sourceTag: 'type:testing',
      onlyDependOnLibsWithTags: ['type:*'],
      notDependOnLibsWithTags: ['type:app']
    }
  ]
}));

const DOTNET_METADATA = { technologies: ['dotnet', 'C#'] };

const NO_MATCHING_CONSTRAINT_MESSAGE =
  'A project without tags matching at least one constraint cannot depend on any libraries';

const createDotnetNodeFixture = (name: string, tags: string[]): ProjectGraphProjectNode =>
  createProjectNodeFixture({ name, tags, metadata: DOTNET_METADATA });

describe('checkBoundariesExecutor', () => {
  const options: CheckBoundariesExecutorOptions = {};

  const api = createDotnetNodeFixture('checkout-api', ['scope:backend', 'type:api']);
  const services = createDotnetNodeFixture('checkout-services', ['scope:backend', 'type:services']);
  const infra = createDotnetNodeFixture('checkout-infra', ['scope:backend', 'type:infra']);
  const infraTwo = createDotnetNodeFixture('billing-infra', ['scope:backend', 'type:infra']);

  /** Runs the executor for `projectName` against a graph built from the nodes and references. */
  const runExecutor = (
    projectName: string,
    nodes: ProjectGraphProjectNode[],
    dependencies: [source: string, target: string][] = []
  ) =>
    checkBoundariesExecutor(
      options,
      createExecutorContextFixture(
        { projectName, projectRoot: `libs/${projectName}` },
        { projectGraph: createDependencyGraphFixture(nodes, dependencies) }
      )
    );

  const loggedErrors = (): string[] =>
    jest.mocked(logger.error).mock.calls.map(([message]) => String(message));

  beforeEach(() => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when it cannot check', () => {
    it('fails and logs an error when it runs without a project name', async () => {
      const context = createExecutorContextFixture(
        { projectName: 'checkout-api', projectRoot: 'libs/checkout-api' },
        { projectName: undefined }
      );

      await expect(checkBoundariesExecutor(options, context)).resolves.toEqual({ success: false });

      expect(loggedErrors()).toEqual(['Cannot check module boundaries without a project name.']);
    });

    it('fails and logs an error when the project is not a .NET project', async () => {
      const typescriptProject = createProjectNodeFixture({
        name: 'checkout-ui',
        tags: ['scope:frontend', 'type:ui']
      });

      await expect(runExecutor('checkout-ui', [typescriptProject])).resolves.toEqual({
        success: false
      });

      expect(loggedErrors()).toEqual([
        'Project checkout-ui is not a .NET project. The check-boundaries executor can only be run on .NET projects.'
      ]);
    });
  });

  describe('when every reference is allowed', () => {
    it('succeeds for a project with no dependencies', async () => {
      await expect(runExecutor('checkout-api', [api])).resolves.toEqual({ success: true });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('succeeds, without logging, for a reference the matrix permits', async () => {
      await expect(
        runExecutor('checkout-api', [api, services], [['checkout-api', 'checkout-services']])
      ).resolves.toEqual({ success: true });

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('when a reference is forbidden', () => {
    it('fails and logs the violation with the source and target', async () => {
      await expect(
        runExecutor('checkout-api', [api, infra], [['checkout-api', 'checkout-infra']])
      ).resolves.toEqual({ success: false });

      expect(loggedErrors()).toEqual([
        'checkout-api -> checkout-infra: A project tagged with "type:api" can only depend on libs tagged with "type:services"'
      ]);
    });

    it('reports a banned tag', async () => {
      const testing = createDotnetNodeFixture('checkout-tests', ['scope:backend', 'type:testing']);
      const app = createDotnetNodeFixture('checkout-host', ['scope:backend', 'type:app']);

      await expect(
        runExecutor('checkout-tests', [testing, app], [['checkout-tests', 'checkout-host']])
      ).resolves.toEqual({ success: false });

      expect(loggedErrors()).toEqual([
        'checkout-tests -> checkout-host: A project tagged with "type:testing" can not depend on libs tagged with "type:app"'
      ]);
    });

    it('fails when no constraint applies to the project', async () => {
      const untagged = createDotnetNodeFixture('checkout-api', ['npm:private']);

      await expect(
        runExecutor('checkout-api', [untagged, services], [['checkout-api', 'checkout-services']])
      ).resolves.toEqual({ success: false });

      expect(loggedErrors()).toEqual([
        `checkout-api -> checkout-services: ${NO_MATCHING_CONSTRAINT_MESSAGE}`
      ]);
    });

    it('reports the violations of every bad reference before failing', async () => {
      await expect(
        runExecutor(
          'checkout-api',
          [api, infra, services, infraTwo],
          [
            ['checkout-api', 'checkout-infra'],
            ['checkout-api', 'checkout-services'],
            ['checkout-api', 'billing-infra']
          ]
        )
      ).resolves.toEqual({ success: false });

      const errors = loggedErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatch(/^checkout-api -> checkout-infra: /);
      expect(errors[1]).toMatch(/^checkout-api -> billing-infra: /);
    });

    it('ignores the references of other projects', async () => {
      await expect(
        runExecutor(
          'checkout-api',
          [api, services, infra],
          [
            ['checkout-api', 'checkout-services'],
            ['checkout-services', 'checkout-infra']
          ]
        )
      ).resolves.toEqual({ success: true });
    });
  });

  describe('what it skips', () => {
    it('skips a dependency on an external package that has no node', async () => {
      await expect(
        runExecutor(
          'checkout-api',
          [api, services],
          [
            ['checkout-api', 'npm:zod'],
            ['checkout-api', 'checkout-services']
          ]
        )
      ).resolves.toEqual({ success: true });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('skips a dependency on a project that is not a .NET project', async () => {
      const typescriptProject = createProjectNodeFixture({
        name: 'checkout-client',
        tags: ['scope:frontend', 'type:models']
      });

      await expect(
        runExecutor('checkout-api', [api, typescriptProject], [['checkout-api', 'checkout-client']])
      ).resolves.toEqual({ success: true });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('skips an implicit dependency, which is not a ProjectReference', async () => {
      const graph: ProjectGraph = {
        ...createDependencyGraphFixture([api, infra]),
        dependencies: {
          'checkout-api': [
            { source: 'checkout-api', target: 'checkout-infra', type: DependencyType.implicit }
          ],
          'checkout-infra': []
        }
      };
      const context = createExecutorContextFixture(
        { projectName: 'checkout-api', projectRoot: 'libs/checkout-api' },
        { projectGraph: graph }
      );

      await expect(checkBoundariesExecutor(options, context)).resolves.toEqual({ success: true });

      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
