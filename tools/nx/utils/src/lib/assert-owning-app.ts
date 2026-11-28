import type { NxProjectOptions } from '@cybertecpty/nx-types';
import type { ProjectConfiguration, Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import { isProjectOfType, projectTagValues } from './project-tags';

/**
 * Throws unless the app named by `options.app` (the app that owns a lib, ADR 0023) is an app of
 * this workspace on a platform the lib can serve: a `type:app` project, whose `platform:` is the
 * lib's own, or the lib is `platform:shared`. A no-op without `options.app`.
 *
 * The workspace half of the check; `assertValidAppOption` checks the options alone.
 */
export function assertOwningApp(tree: Tree, options: NxProjectOptions): void {
  const { app, platform } = options;

  if (!app) {
    return;
  }

  let project: ProjectConfiguration;

  try {
    project = readProjectConfiguration(tree, app);
  } catch {
    throw new Error(`\`app\` "${app}" is not a project in this workspace.`);
  }

  if (!isProjectOfType(project, 'app')) {
    throw new Error(`\`app\` "${app}" is not tagged \`type:app\`.`);
  }

  const [appPlatform] = projectTagValues(project.tags ?? [], 'platform');

  if (platform !== 'shared' && platform !== appPlatform) {
    throw new Error(
      `A \`platform:${platform}\` lib cannot belong to \`${app}\`, a \`platform:${appPlatform}\` app.`
    );
  }
}
