import {
  DependencyType,
  type ProjectConfiguration,
  type ProjectGraph,
  type ProjectGraphDependency,
  type ProjectGraphProjectNode,
  type TargetConfiguration
} from '@nx/devkit';

export interface CreateProjectGraphFixtureOptions {
  /** The one project, in the graph and anything built around it. */
  projectName: string;

  /** Project root, relative to the workspace root. */
  projectRoot: string;

  /** The project's targets. */
  targets?: Record<string, TargetConfiguration>;
}

export interface CreateProjectNodeFixtureOptions {
  /** The project's name. */
  name: string;

  /** Node metadata, such as `{ technologies: ['dotnet'] }`. Left out unless given. */
  metadata?: ProjectConfiguration['metadata'];

  /** Project root, relative to the workspace root. Defaults to `libs/{name}`. */
  root?: string;

  /** Tags, left `undefined` unless given so a spec can tell "no tags" from "empty tags". */
  tags?: string[];

  /** The project's targets. */
  targets?: Record<string, TargetConfiguration>;

  /** The kind of project. Defaults to `lib`. */
  type?: ProjectGraphProjectNode['type'];
}

/**
 * A dependency between two projects in a graph fixture, as `[source, target]`.
 */
export type ProjectDependencyFixture = readonly [source: string, target: string];

/**
 * Build a `ProjectGraph` fixture for specs from projects and the dependencies between them.
 *
 * Every node gets an entry in `dependencies`, empty if it depends on nothing, as in a graph Nx
 * builds. A dependency's target need not be one of the nodes, which is how a real graph lists
 * an external package. Its source must be, and node names must be unique, or the fixture throws
 * so that a typo in a spec fails loudly instead of building the wrong graph.
 */
export const createDependencyGraphFixture = (
  nodes: readonly ProjectGraphProjectNode[],
  dependencies: readonly ProjectDependencyFixture[] = []
): ProjectGraph => {
  const nodesByName = new Map<string, ProjectGraphProjectNode>();
  const dependenciesBySource = new Map<string, ProjectGraphDependency[]>();

  for (const node of nodes) {
    if (nodesByName.has(node.name)) {
      throw new Error(`The graph fixture has two nodes named "${node.name}".`);
    }

    nodesByName.set(node.name, node);
    dependenciesBySource.set(node.name, []);
  }

  for (const [source, target] of dependencies) {
    const sourceDependencies = dependenciesBySource.get(source);

    if (!sourceDependencies) {
      throw new Error(`The graph fixture has a dependency from "${source}", which is not a node.`);
    }

    sourceDependencies.push({ source, target, type: DependencyType.static });
  }

  return {
    nodes: Object.fromEntries(nodesByName),
    dependencies: Object.fromEntries(dependenciesBySource)
  };
};

/**
 * Build a `ProjectGraph` fixture for specs: one `app` project with the given
 * targets and no dependencies.
 */
export const createProjectGraphFixture = ({
  projectName,
  projectRoot,
  targets = {}
}: CreateProjectGraphFixtureOptions): ProjectGraph => ({
  nodes: {
    [projectName]: { name: projectName, type: 'app', data: { root: projectRoot, targets } }
  },
  dependencies: {}
});

/**
 * Build a `ProjectGraphProjectNode` fixture for specs: a `lib` at `libs/{name}` with no targets,
 * no tags and no metadata unless the options say otherwise.
 */
export const createProjectNodeFixture = ({
  name,
  metadata,
  root = `libs/${name}`,
  tags,
  targets = {},
  type = 'lib'
}: CreateProjectNodeFixtureOptions): ProjectGraphProjectNode => ({
  name,
  type,
  data: { root, targets, tags, metadata }
});
