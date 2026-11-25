import { joinPathFragments, readJson, type ProjectGraph, type Tree } from '@nx/devkit';
import type { PackageJson } from 'type-fest';

/**
 * Lists the workspace projects `project` depends on, directly or transitively, in the order the
 * walk finds them. External (npm) dependencies are not projects in the graph and are left out, and
 * a dependency cycle does not repeat a project or include `project` itself.
 */
export function collectProjectDependencies(graph: ProjectGraph, project: string): string[] {
  const seen = new Set<string>([project]);
  const queue = [project];

  for (const current of queue) {
    for (const { target } of graph.dependencies[current] ?? []) {
      if (graph.nodes[target] && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }

  seen.delete(project);

  return [...seen];
}

/**
 * Reads the `package.json` in `projectRoot` and returns its contents as a `PackageJson`
 * object, or `undefined` when the project has none.
 *
 * @throws when the file exists but is not valid JSON.
 */
export function readProjectPackageJson(tree: Tree, projectRoot: string): PackageJson | undefined {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');

  return tree.exists(packageJsonPath) ? readJson<PackageJson>(tree, packageJsonPath) : undefined;
}
