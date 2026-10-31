import { gitCommitsBetween, gitLatestTagMatching } from '@cybertecpty/git-utils';
import type { ProjectGraph } from '@nx/devkit';
import type { ChangelogChange } from 'nx/release/changelog-renderer';
import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * The conventional-commit types config Nx passes to a changelog renderer.
 */
export type ConventionalCommitTypes = Record<string, { changelog: false | { hidden?: boolean } }>;

/**
 * What {@link findDependencyChanges} needs to know about the project being released.
 */
export interface DependencyChangesOptions {
  /** The project's conventional-commit types; commits of a hidden or unknown type are dropped. */
  readonly commitTypes: ConventionalCommitTypes;
  /** Short hashes of the changes the changelog already lists, so no commit appears twice. */
  readonly knownHashes: readonly string[];
  /** The released project. */
  readonly project: string;
  /** The workspace project graph. */
  readonly projectGraph: ProjectGraph;
}

const SHORT_HASH_LENGTH = 7;
const CONVENTIONAL_SUBJECT =
  /^(?<type>\w+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?: (?<description>.+)$/;

/**
 * Lists the roots of the workspace projects `project` depends on, directly or transitively.
 * External (npm) dependencies are not projects in the graph and are left out.
 */
export function collectDependencyRoots(graph: ProjectGraph, project: string): string[] {
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

  return [...seen].map(name => graph.nodes[name].data.root);
}

/**
 * Finds the commits since the project's last release that touched a workspace dependency but not
 * the project itself, as changelog entries for the project.
 *
 * Nx lists only the commits that touch a project's own files, yet it still bumps the project when
 * a library it imports changed. Without these entries that bump has nothing to show for it.
 */
export async function findDependencyChanges(
  options: DependencyChangesOptions,
  git: SimpleGit = simpleGit()
): Promise<ChangelogChange[]> {
  const { commitTypes, knownHashes, project, projectGraph } = options;
  const roots = collectDependencyRoots(projectGraph, project);

  if (roots.length === 0) {
    return [];
  }

  const lastRelease = await gitLatestTagMatching(`${project}@*`, git);
  const commits = await gitCommitsBetween(lastRelease, 'HEAD', git);
  const changes: ChangelogChange[] = [];

  for (const commit of commits) {
    const shortHash = commit.hash.slice(0, SHORT_HASH_LENGTH);

    if (
      knownHashes.includes(shortHash) ||
      !commit.files.some(file => roots.some(root => isUnder(file, root)))
    ) {
      continue;
    }

    const change = toChange(commit.message, shortHash, project, commitTypes);

    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

function isUnder(file: string, root: string): boolean {
  return file.startsWith(`${root}/`);
}

/**
 * Turns a conventional-commit subject into a changelog entry for `project`, or `null` when the
 * subject is not conventional or its type is hidden from changelogs.
 */
function toChange(
  subject: string,
  shortHash: string,
  project: string,
  commitTypes: ConventionalCommitTypes
): ChangelogChange | null {
  const groups = CONVENTIONAL_SUBJECT.exec(subject)?.groups;

  if (!groups) {
    return null;
  }

  const typeConfig = commitTypes[groups['type']];

  if (!typeConfig || typeConfig.changelog === false || typeConfig.changelog.hidden) {
    return null;
  }

  return {
    affectedProjects: [project],
    authors: [],
    body: '',
    description: groups['description'],
    githubReferences: [],
    isBreaking: Boolean(groups['breaking']),
    scope: groups['scope'] ?? '',
    shortHash,
    type: groups['type']
  };
}
