import { gitCommitsBetween, type GitLogEntry } from '@cybertecpty/git-utils';
import type { ProjectChangelogs } from '@cybertecpty/nx-types';
import { createProjectRootMappings, findProjectForPath } from '@cybertecpty/nx-utils';
import { createProjectGraphAsync } from '@nx/devkit';
import simpleGit, { type SimpleGit } from 'simple-git';

/** Group heading for commits whose files belong to no Nx project. */
export const WORKSPACE_OTHER_GROUP = 'other';

/** Resolves a workspace-relative file path to the Nx project that owns it. */
export type ProjectForFile = (file: string) => string | null;

/**
 * Everything {@link buildReleasePrBody} needs. The two branch names and the
 * release commit subject come from the generator; `git` is injectable for tests.
 */
export interface ReleasePrBodyOptions {
  /** Git client. Defaults to a `simpleGit()` on the cwd. */
  readonly git?: SimpleGit;
  /** Per-project rendered changelog entries for this release, if any. */
  readonly projectChangelogs: ProjectChangelogs | undefined;
  /** The branch the release artifacts were committed to. */
  readonly releaseBranch: string;
  /** Subject line of the generated release commit, excluded from the PR body. */
  readonly releaseCommitMessage: string;
  /** The branch the release PR merges into (e.g. `main`). */
  readonly targetBranch: string;
}

/**
 * Builds the release pull request body: one Markdown section per released
 * project's changelog entry, followed by a "Workspace changes" section listing
 * the PR's remaining commits (tooling, docs, infra, config) that no project
 * changelog covers.
 *
 * The only I/O here is fetching the PR's commit range and the project graph;
 * every transformation it feeds is a pure function exported from this module.
 */
export async function buildReleasePrBody(options: ReleasePrBodyOptions): Promise<string> {
  const { projectChangelogs, releaseBranch, releaseCommitMessage, targetBranch } = options;
  const git = options.git ?? simpleGit();

  // Compare against the remote target branch: that is what the PR merges into,
  // and the local target branch may be stale or absent on CI runners. The
  // resulting range is by definition the full content of the release PR.
  const commits = await gitCommitsBetween(`origin/${targetBranch}`, releaseBranch, git);

  const uncovered = selectUncoveredCommits(
    commits,
    extractChangelogCommitHashes(projectChangelogs),
    releaseCommitMessage
  );

  const workspaceSection = uncovered.length
    ? renderWorkspaceChangesSection(groupCommitsByProject(uncovered, await createProjectForFile()))
    : null;

  return renderReleasePrBody(projectChangelogs, workspaceSection);
}

/**
 * Drops the commits that should not appear in the "Workspace changes" section:
 * the generated release commit (created after the changelogs, so never
 * changelog-covered, and its manifest footprint touches app files), and any
 * commit already represented in a project changelog entry.
 *
 * @param commits The full release-PR commit range.
 * @param coveredHashes Short commit hashes referenced by the project changelogs
 *   (see {@link extractChangelogCommitHashes}).
 * @param releaseCommitMessage Subject line of the generated release commit.
 */
export function selectUncoveredCommits(
  commits: readonly GitLogEntry[],
  coveredHashes: readonly string[],
  releaseCommitMessage: string
): GitLogEntry[] {
  return commits.filter(
    commit =>
      commit.message !== releaseCommitMessage &&
      !coveredHashes.some(hash => commit.hash.startsWith(hash))
  );
}

/**
 * Groups commits by the Nx projects their touched files belong to, mirroring
 * how Nx attributes commits to project changelogs: a commit touching several
 * projects appears under each of them. Commits whose files belong to no
 * project at all (docs, root config) collect under the 'other' group.
 *
 * @param commits The commits to group.
 * @param projectForFile Maps a file path to its owning project, or `null`. Build
 *   one from the project graph with {@link createProjectForFile}.
 * @returns Groups keyed by project name, sorted alphabetically with 'other' last.
 */
export function groupCommitsByProject(
  commits: readonly GitLogEntry[],
  projectForFile: ProjectForFile
): Map<string, GitLogEntry[]> {
  const groups = new Map<string, GitLogEntry[]>();

  for (const commit of commits) {
    const projectNames = new Set(
      commit.files.map(projectForFile).filter((name): name is string => !!name)
    );

    // The catch-all group exists to surface commits that would otherwise be
    // invisible. A commit already attributed to a project is not repeated
    // under 'other' just because it also touched stray non-project files
    // (docs, root config).
    const groupNames = projectNames.size ? projectNames : new Set([WORKSPACE_OTHER_GROUP]);

    for (const groupName of groupNames) {
      groups.set(groupName, [...(groups.get(groupName) ?? []), commit]);
    }
  }

  return new Map([...groups.entries()].sort(([a], [b]) => compareGroupNames(a, b)));
}

/**
 * Renders the grouped commits as the "Workspace changes" Markdown section, or
 * `null` when there are no groups.
 */
export function renderWorkspaceChangesSection(
  groups: ReadonlyMap<string, readonly GitLogEntry[]>
): string | null {
  if (groups.size === 0) {
    return null;
  }

  const groupSections = [...groups.entries()].map(([groupName, groupCommits]) => {
    // Bare short hashes are auto-linked by GitHub when rendered in a PR body.
    const lines = groupCommits.map(commit => `- ${commit.message} (${commit.hash.slice(0, 7)})`);

    return `### ${groupName}\n\n${lines.join('\n')}`;
  });

  return `## Workspace changes\n\n${groupSections.join('\n\n')}`;
}

/**
 * Assembles the final PR body from the per-project changelog sections and the
 * optional workspace-changes section, falling back to a placeholder when there
 * is nothing to report.
 */
export function renderReleasePrBody(
  projectChangelogs: ProjectChangelogs | undefined,
  workspaceSection: string | null
): string {
  const sections = Object.entries(projectChangelogs ?? {}).map(
    ([project, changelog]) => `## ${project}\n\n${changelog.contents}`
  );

  if (workspaceSection) {
    sections.push(workspaceSection);
  }

  if (!sections.length) {
    return 'This release contains no changelog entries.';
  }

  return sections.join('\n\n');
}

/**
 * Extracts the (short) commit hashes referenced by the rendered project
 * changelog entries, from their `.../commit/<hash>` markdown links.
 */
export function extractChangelogCommitHashes(
  projectChangelogs: ProjectChangelogs | undefined
): string[] {
  const contents = Object.values(projectChangelogs ?? {})
    .map(changelog => changelog.contents)
    .join('\n');

  return Array.from(contents.matchAll(/commit\/([0-9a-f]{6,40})/g), match => match[1]);
}

/**
 * Builds a {@link ProjectForFile} resolver from the current Nx project graph.
 * The one point in this module that reads the graph.
 */
export async function createProjectForFile(): Promise<ProjectForFile> {
  const projectGraph = await createProjectGraphAsync();
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);

  return file => findProjectForPath(file, projectRootMappings);
}

/** Sort comparator that orders named project groups alphabetically, 'other' last. */
function compareGroupNames(a: string, b: string): number {
  if (a === WORKSPACE_OTHER_GROUP) {
    return 1;
  }

  if (b === WORKSPACE_OTHER_GROUP) {
    return -1;
  }

  return a.localeCompare(b);
}
