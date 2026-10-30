import { checkDepConstraints, loadDepConstraints } from '@cybertecpty/nx-utils';
import { logger, type ProjectGraphProjectNode, type PromiseExecutor } from '@nx/devkit';
import { isDotNetProjectNode } from '../../utils/nx-dotnet-projects.utils';
import type { CheckBoundariesExecutorOptions } from './schema';

/**
 * Fails when a .NET project references another .NET project in a way that ADR 0004's dependency
 * constraints forbid (ADR 0019).
 *
 * It checks each of the run project's `ProjectReference` dependencies against the matrix,
 * logs every violation as `source -> target: ...`, and returns `{ success: false }` if there are
 * any. Implicit dependencies, dependencies on external packages and dependencies on projects that
 * are not .NET projects are skipped. It also fails, with a logged error, when it runs without a
 * project name or on a project that is not a .NET project.
 */
const checkBoundariesExecutor: PromiseExecutor<CheckBoundariesExecutorOptions> = (
  _options,
  context
) => {
  const projectName = context.projectName;
  if (!projectName) {
    logger.error('Cannot check module boundaries without a project name.');
    return Promise.resolve({ success: false });
  }

  const srcNode = context.projectGraph.nodes[projectName] as ProjectGraphProjectNode | undefined;

  if (!srcNode || !isDotNetProjectNode(srcNode)) {
    logger.error(
      `Project ${projectName} is not a .NET project. The check-boundaries executor can only be run on .NET projects.`
    );
    return Promise.resolve({ success: false });
  }

  const dependencies = context.projectGraph.dependencies[projectName] || [];
  const violations: string[] = [];

  // Loaded once, before the loop, so that a failure to load the matrix surfaces even for a
  // project with no dependencies, instead of letting the check pass without having run.
  const constraints = loadDepConstraints();

  for (const dependency of dependencies) {
    // An implicit dependency (`DependencyType.implicit`) comes from `implicitDependencies`, not
    // from a `ProjectReference`. `@nx/enforce-module-boundaries` does not check those, so neither
    // do we. It is compared as a string because the graph types `type` as `string`.
    if (dependency.type === 'implicit') {
      continue;
    }

    // A dependency on an external package has no node in the graph, and the matrix only covers
    // edges between .NET projects, so anything that is not a .NET node is skipped.
    const targetNode = context.projectGraph.nodes[dependency.target] as
      ProjectGraphProjectNode | undefined;

    if (!targetNode || !isDotNetProjectNode(targetNode)) {
      continue;
    }

    violations.push(...checkDepConstraints(srcNode, targetNode, constraints));
  }

  // Report every violation, across all of the project's dependencies, before failing.
  for (const violation of violations) {
    logger.error(violation);
  }

  return Promise.resolve({ success: violations.length === 0 });
};

export default checkBoundariesExecutor;
