import { lastGitCommitHash } from '@cybertecpty/git-utils';
import {
  createPullRequest,
  findOpenPullRequest,
  updatePullRequest
} from '@cybertecpty/github-utils';
import { NxReleaseChangelogResult, ProjectChangelogs, VersionData } from '@cybertecpty/nx-types';
import { dryRunEnabled, releaseVersion, verboseEnabled } from '@cybertecpty/nx-utils';
import {
  buildReleasePrBody,
  checkoutReleaseBranch,
  releaseChangelog,
  resolveAffectedReleaseProjects,
  resolveReleaseBranchName,
  resolveWorkspaceReleaseType,
  tagReleasedProjects
} from '@cybertecpty/release-utils';
import { formatFiles, logger, type Tree } from '@nx/devkit';
import simpleGit, { SimpleGit } from 'simple-git';
import { packageVersionGenerator } from '../package-version/generator';
import releaseManifestGenerator from '../release-manifest/generator';
import type { NormalizedReleaseGeneratorOptions, ReleaseGeneratorOptions } from './schema';

export type ReleaseCommandOptions = {
  dryRun: boolean;
  gitCommit: false;
  gitPush: false;
  gitTag: false;
  stageChanges: true;
};

/**
 * Shared Git client instance for the entire release generator run.
 */
const git = simpleGit();

/**
 * Subject line of the commit that bundles all release artifacts. Also used to
 * recognize (and exclude) release commits when building the PR body's
 * workspace-changes section.
 */
const RELEASE_COMMIT_MESSAGE = 'chore(release): generate release artifacts';

/**
 * Cuts a release: versions and changelogs the configured projects via Nx's own release
 * engine, writes a per-project release manifest and a workspace version bump, commits it
 * all as one release commit, tags it, and opens the promotion pull request into
 * `targetBranch`. See `README.md` for the option reference and ADR 0011 for why the flow
 * is shaped this way.
 */
export async function releaseGenerator(
  tree: Tree,
  rawOptions: ReleaseGeneratorOptions
): Promise<() => Promise<void>> {
  const opts = await normalizeOpts(tree, rawOptions, git);
  const { baseBranch, skipFormat, releaseDate } = opts;
  const isDryRun = dryRunEnabled();
  const isVerbose = verboseEnabled();

  if (opts.affected && !opts.projects?.length) {
    logger.info(
      'No affected projects matched the configured release project set. Skipping release.'
    );
    return () => Promise.resolve();
  }

  // 1. Move to the release branch. In a dry run we only resolve its name; the
  //    working tree is left untouched.
  const branchOpts = { baseBranch, releaseDate, skipBranch: opts.skipBranch };
  const releaseBranch = resolveReleaseBranchName(branchOpts);

  let restoreBranch: string | null = null;

  if (isDryRun) {
    logger.warn(`Dry run: release would be cut on ${releaseBranch}.`);
  } else {
    ({ restoreBranch } = await checkoutReleaseBranch(branchOpts, git));
  }

  const releaseCommandOptions = getReleaseCommandOptions(isDryRun);

  try {
    // 2. Calculate and stage project package version changes.
    const { firstRelease, projects, vers: schemaVersion } = opts;
    const { projectsVersionData, releaseGraph } = await releaseVersion({
      firstRelease,
      projects,
      specifier: schemaVersion,
      ...releaseCommandOptions
    });

    // 3. Bump the workspace package version from the highest project release level.
    const workspacePackagePath = await bumpWorkspaceVersion(
      tree,
      projectsVersionData,
      opts.skipWorkspaceVersion
    );

    // 4. Generate changelogs and release manifests for the resolved versions.
    let projectChangelogs: NxReleaseChangelogResult['projectChangelogs'] | undefined;

    if (!opts.skipChangelog) {
      projectChangelogs = (
        await releaseChangelog({
          firstRelease: opts.firstRelease,
          projects: opts.projects,
          // Reuses the graph releaseVersion already built instead of having
          // releaseChangelog recompute it from scratch.
          releaseGraph,
          verbose: isVerbose,
          versionData: projectsVersionData,
          createRelease: false,
          ...releaseCommandOptions
        })
      ).projectChangelogs;
    }

    const manifestPaths = await generateReleaseManifests(tree, projectsVersionData, opts);

    // 5. Format files and prepare the post-run commit/push callback.
    if (!skipFormat) {
      await formatFiles(tree);
    }

    return async () => {
      try {
        const releasePaths = [
          ...(manifestPaths ?? []),
          ...(workspacePackagePath ? [workspacePackagePath] : [])
        ];

        if (releasePaths.length) {
          logger.info(`Committing release changes...`);

          await git.add(releasePaths);
          await git.commit(RELEASE_COMMIT_MESSAGE);

          // Tag the release commit per released project before pushing so the
          // tags ride along with the branch push (--follow-tags). Nx resolves
          // the previous release boundary from these tags for both
          // conventional-commit version bumps and changelog commit ranges.
          await tagReleasedProjects(projectsVersionData, opts.skipTag);

          logger.info(`Pushing release commit to origin...`);

          // Refresh remote-tracking refs first so --force-with-lease evaluates
          // against the remote's true state. A same-name release branch deleted
          // out-of-band (e.g. closed-PR branch cleanup) otherwise leaves a stale
          // tracking ref that makes the lease reject the push.
          await git.fetch(['origin', '--prune']);

          // --follow-tags pushes the annotated release tags reachable from the
          // pushed branch in the same operation as the commit.
          await git.push('origin', releaseBranch, ['--force-with-lease', '--follow-tags']);

          // Open or refresh the release PR once the branch is pushed. This is
          // intentionally best-effort: the push already succeeded, so a gh
          // failure must not fail the release or skip the branch restore below.
          await openReleasePullRequest(opts, releaseBranch, projectChangelogs);
        }

        logger.info(`Release complete.`);
      } finally {
        await restoreStartingBranch(restoreBranch, git);
      }
    };
  } catch (error) {
    await restoreStartingBranch(restoreBranch, git);
    throw error;
  }
}

/**
 * Fills in the defaults the rest of the generator assumes are always present
 * (branch names, release date, skip flags) so downstream code never has to
 * re-check them.
 *
 * When `--affected` is passed, the project list is also resolved here and
 * baked into `opts.projects`, so callers see a plain list either way and don't
 * need to know whether it came from the user or the affected scan.
 */
async function normalizeOpts(
  tree: Tree,
  schema: ReleaseGeneratorOptions,
  git = simpleGit()
): Promise<NormalizedReleaseGeneratorOptions> {
  const opts = {
    ...schema,
    baseBranch: schema.baseBranch || 'develop',
    releaseDate: schema.releaseDate || new Date().toISOString(),
    skipBranch: schema.skipBranch ?? false,
    skipPullRequest: schema.skipPullRequest ?? false,
    targetBranch: schema.targetBranch || 'main'
  };

  if (!opts.affected) {
    return opts;
  }

  return {
    ...opts,
    projects: await resolveAffectedReleaseProjects(tree, opts, git)
  };
}

/**
 *
 */
function getReleaseCommandOptions(dryRun: boolean): ReleaseCommandOptions {
  return {
    dryRun,
    // Stage Nx release changes so the final manifest commit can include them in one release commit.
    gitCommit: false,
    gitPush: false,
    gitTag: false,
    stageChanges: true
  };
}

/**
 * Bumps the workspace package version based on the highest project release level in the run
 * and returns the path to the workspace package manifest if it was updated, or null if no update
 * was made.
 */
async function bumpWorkspaceVersion(
  tree: Tree,
  versionData: VersionData,
  skipWorkspaceVersion: boolean | undefined
): Promise<string | null> {
  if (skipWorkspaceVersion) {
    return null;
  }

  const releaseType = resolveWorkspaceReleaseType(versionData);

  if (!releaseType) {
    logger.warn('No project version bumps found. Skipping workspace package version bump.');
    return null;
  }

  await packageVersionGenerator(tree, {
    path: 'package.json',
    skipFormat: true,
    vers: releaseType
  });

  return 'package.json';
}

/**
 * Generates release manifest files for each project in the project version data.
 *
 * @returns A list of paths to the generated release manifests.
 */
async function generateReleaseManifests(
  tree: Tree,
  versionData: VersionData,
  opts: NormalizedReleaseGeneratorOptions
): Promise<string[]> {
  if (opts.skipManifest) {
    return [];
  }

  const projects = Object.keys(versionData);
  const manifestPaths: string[] = [];

  for (const project of projects) {
    const vers = versionData?.[project]?.newVersion;

    // Only regenerate manifests for projects that were actually released in
    // this run. Rewriting manifests for unchanged projects would make the
    // release commit touch every app, which the next release's conventional
    // commit scan then misreads as an app change and patch-bumps everything.
    if (!vers) {
      continue;
    }

    const sourceCommit = await lastGitCommitHash({ length: 10 }, git);

    const path = await releaseManifestGenerator(tree, {
      author: opts.author,
      project,
      sourceCommit,
      version: vers,
      skipFormat: true
    });

    manifestPaths.push(path);
  }

  return manifestPaths;
}

/**
 * Restores the starting Git branch after a release operation.
 *
 * @param restoreBranch The branch to switch back to.
 * @param git The Git client to use.
 */
async function restoreStartingBranch(restoreBranch: string | null, git: SimpleGit): Promise<void> {
  if (!restoreBranch) {
    return;
  }

  logger.info(`Switching back to starting branch ${restoreBranch}...`);
  await git.checkout(restoreBranch);
}

/**
 * Opens (or refreshes) the GitHub pull request that promotes the pushed release
 * branch into the target branch.
 *
 * Best-effort by design: the release branch is already pushed by the time this
 * runs, so any `gh` failure is logged with a manual fallback command and
 * swallowed rather than failing the release.
 */
async function openReleasePullRequest(
  opts: NormalizedReleaseGeneratorOptions,
  releaseBranch: string,
  projectChangelogs: ProjectChangelogs | undefined
): Promise<void> {
  const { releaseDate, skipBranch, skipPullRequest, targetBranch } = opts;

  // No PR when explicitly skipped, when there is no dedicated release branch, or
  // when the release branch is itself the target (nothing to merge).
  if (skipPullRequest || skipBranch || releaseBranch === targetBranch) {
    return;
  }

  const title = `Release/${releaseDate.split('T')[0]}`;

  try {
    // Built inside the try because the workspace-changes section queries git;
    // a failure there must degrade to the manual-command warning, not throw.
    const body = await buildReleasePrBody({
      git,
      projectChangelogs,
      releaseBranch,
      releaseCommitMessage: RELEASE_COMMIT_MESSAGE,
      targetBranch
    });
    const existingNumber = await findOpenPullRequest(releaseBranch, targetBranch);
    let pullRequestUrl: string;

    if (existingNumber !== null) {
      logger.info(`Updating existing release pull request #${existingNumber}...`);
      pullRequestUrl = await updatePullRequest({ body, number: existingNumber, title });
    } else {
      logger.info(`Opening release pull request from ${releaseBranch} into ${targetBranch}...`);
      pullRequestUrl = await createPullRequest({
        base: targetBranch,
        body,
        head: releaseBranch,
        title
      });
    }

    // Final release output: surface the PR link so it can be opened directly
    // from the terminal.
    logger.info(`Release pull request: ${pullRequestUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.warn(
      `Failed to open the release pull request: ${message}\n` +
        `The release branch was pushed; open the PR manually with:\n` +
        `  gh pr create --base ${targetBranch} --head ${releaseBranch} --title "${title}"`
    );
  }
}

export default releaseGenerator;
