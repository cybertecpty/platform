import {
  createProjectGraphAsync,
  readJsonFile,
  workspaceRoot,
  type NxJsonConfiguration
} from '@nx/devkit';
import { join } from 'node:path';
import DefaultChangelogRenderer from 'nx/release/changelog-renderer';
import {
  findDependencyChanges,
  type ConventionalCommitTypes
} from '../utils/release-dependency-changes.utils';

/** Nx's own default tag pattern for independently released projects. */
const DEFAULT_TAG_PATTERN = '{projectName}@{version}';

/**
 * Nx's changelog renderer, extended so a project bumped because a workspace library it imports
 * changed lists that change. Nx gives a renderer only the commits that touch the project's own
 * files, so a library-only change would bump the project and leave its changelog empty. Set as
 * `release.changelog.projectChangelogs.renderer` in `nx.json`.
 */
export default class DependencyChangelogRenderer extends DefaultChangelogRenderer {
  override async render(): Promise<string> {
    if (this.project !== null) {
      this.changes.push(
        ...(await findDependencyChanges({
          commitTypes: (this.conventionalCommitsConfig as { types: ConventionalCommitTypes }).types,
          knownHashes: this.changes.flatMap(change => change.shortHash ?? []),
          project: this.project,
          projectGraph: await createProjectGraphAsync(),
          releaseTagPattern:
            readJsonFile<NxJsonConfiguration>(join(workspaceRoot, 'nx.json')).release?.releaseTag
              ?.pattern ?? DEFAULT_TAG_PATTERN
        }))
      );
    }

    return super.render();
  }
}
