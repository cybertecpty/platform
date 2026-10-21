import type { ProjectGraphProjectNode } from '@nx/devkit';

/**
 * Determines if a given project node is a .NET project .
 *
 * @param node - The project graph node to check.
 * @returns True if the project is a .NET project, false otherwise.
 */
export function isDotNetProjectNode(node: ProjectGraphProjectNode): boolean {
  return node.data.metadata?.technologies?.includes('dotnet') ?? false;
}
