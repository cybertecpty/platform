import type { TargetConfiguration } from '@nx/devkit';
import {
  createDependencyGraphFixture,
  createProjectGraphFixture,
  createProjectNodeFixture
} from './nx-project-graph.fixture';

describe('createProjectGraphFixture', () => {
  const build: TargetConfiguration = { outputs: ['{workspaceRoot}/dist/{projectRoot}'] };

  it('describes one app project with the given targets and no dependencies', () => {
    const graph = createProjectGraphFixture({
      projectName: 'my-app',
      projectRoot: 'apps/my-app',
      targets: { build }
    });

    expect(graph).toEqual({
      nodes: {
        'my-app': {
          name: 'my-app',
          type: 'app',
          data: { root: 'apps/my-app', targets: { build } }
        }
      },
      dependencies: {}
    });
  });

  it('gives the project no targets by default', () => {
    const graph = createProjectGraphFixture({ projectName: 'my-app', projectRoot: 'apps/my-app' });

    expect(graph.nodes['my-app']?.data.targets).toEqual({});
  });
});

describe('createProjectNodeFixture', () => {
  it('describes a lib at libs/{name} with no targets by default', () => {
    expect(createProjectNodeFixture({ name: 'checkout-api' })).toEqual({
      name: 'checkout-api',
      type: 'lib',
      data: { root: 'libs/checkout-api', targets: {} }
    });
  });

  it('leaves the tags and metadata undefined unless they are given', () => {
    const { data } = createProjectNodeFixture({ name: 'checkout-api' });

    expect(data.tags).toBeUndefined();
    expect(data.metadata).toBeUndefined();
  });

  it('keeps empty tags apart from missing tags', () => {
    expect(createProjectNodeFixture({ name: 'a', tags: [] }).data.tags).toEqual([]);
    expect(createProjectNodeFixture({ name: 'a' }).data.tags).toBeUndefined();
  });

  it('uses the tags, metadata, root, targets and type it is given', () => {
    const build: TargetConfiguration = { executor: 'nx:noop' };

    expect(
      createProjectNodeFixture({
        name: 'checkout-host',
        type: 'app',
        root: 'apps/checkout-host',
        tags: ['scope:backend', 'type:app'],
        targets: { build },
        metadata: { technologies: ['dotnet'] }
      })
    ).toEqual({
      name: 'checkout-host',
      type: 'app',
      data: {
        root: 'apps/checkout-host',
        tags: ['scope:backend', 'type:app'],
        targets: { build },
        metadata: { technologies: ['dotnet'] }
      }
    });
  });

  it('can describe metadata without technologies', () => {
    expect(createProjectNodeFixture({ name: 'a', metadata: {} }).data.metadata).toEqual({});
  });
});

describe('createDependencyGraphFixture', () => {
  const api = createProjectNodeFixture({ name: 'api', tags: ['type:api'] });
  const services = createProjectNodeFixture({ name: 'services', tags: ['type:services'] });

  it('keys the nodes by name', () => {
    const graph = createDependencyGraphFixture([api, services]);

    expect(graph.nodes).toEqual({ api, services });
  });

  it('gives every node an empty dependency list when there are no dependencies', () => {
    const graph = createDependencyGraphFixture([api, services]);

    expect(graph.dependencies).toEqual({ api: [], services: [] });
  });

  it('records each dependency as static, under its source', () => {
    const graph = createDependencyGraphFixture(
      [api, services],
      [
        ['api', 'services'],
        ['services', 'npm:left-pad']
      ]
    );

    expect(graph.dependencies).toEqual({
      api: [{ source: 'api', target: 'services', type: 'static' }],
      services: [{ source: 'services', target: 'npm:left-pad', type: 'static' }]
    });
  });

  it('keeps several dependencies of one project in the order given', () => {
    const utils = createProjectNodeFixture({ name: 'utils' });
    const graph = createDependencyGraphFixture(
      [api, services, utils],
      [
        ['api', 'utils'],
        ['api', 'services']
      ]
    );

    expect(graph.dependencies['api']?.map(dependency => dependency.target)).toEqual([
      'utils',
      'services'
    ]);
  });

  it('allows a dependency on a target that is not a node, like an external package', () => {
    const graph = createDependencyGraphFixture([api], [['api', 'npm:zod']]);

    expect(graph.nodes['npm:zod']).toBeUndefined();
    expect(graph.dependencies['api']).toHaveLength(1);
  });

  it('throws for a dependency whose source is not a node', () => {
    expect(() => createDependencyGraphFixture([api], [['missing', 'api']])).toThrow(
      'The graph fixture has a dependency from "missing", which is not a node.'
    );
  });

  it('throws when two nodes have the same name', () => {
    expect(() => createDependencyGraphFixture([api, api])).toThrow(
      'The graph fixture has two nodes named "api".'
    );
  });

  it('builds an empty graph from no nodes', () => {
    expect(createDependencyGraphFixture([])).toEqual({ nodes: {}, dependencies: {} });
  });
});
