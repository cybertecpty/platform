import { createProjectGraphAsync } from '@nx/devkit';
import DefaultChangelogRenderer from 'nx/release/changelog-renderer';
import {
  findDependencyChanges,
  type ConventionalCommitTypes
} from '../utils/release-dependency-changes.utils';

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
          projectGraph: await createProjectGraphAsync()
        }))
      );
    }

    return super.render();
  }
}
